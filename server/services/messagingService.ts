import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, run, transaction } from '../db.js';
import { Conversation, Message, User, Gift, MailThread, MailMessage } from '../types.js';
import { DiscoveryService } from './discoveryService.js';
import { CreditService } from './creditService.js';
import { NotificationService } from './notificationService.js';
import { MailBillingService } from './mailBillingService.js';
import { broadcastToUser } from '../websocket/wsServer.js';

export class MessagingService {
  /**
   * Gets or creates a conversation between two users.
   */
  static getOrCreateConversation(userA: string, userB: string): { conversation: Conversation; partner: Partial<User> } {
    if (userA === userB) throw new Error('Cannot converse with yourself.');
    if (DiscoveryService.isBlocked(userA, userB)) {
      throw new Error('Cannot start conversation due to blocking settings.');
    }

    const partner = queryOne<User>(
      'SELECT id, display_name, avatar_url, age, location, gender, is_online, last_active_at FROM users WHERE id = ?',
      [userB]
    );
    if (!partner) throw new Error('User not found.');

    const existing = queryOne<{ conversation_id: string }>(
      `SELECT cm1.conversation_id 
       FROM conversation_members cm1
       JOIN conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
       WHERE cm1.user_id = ? AND cm2.user_id = ?`,
      [userA, userB]
    );

    if (existing) {
      const conv = queryOne<Conversation>('SELECT * FROM conversations WHERE id = ?', [existing.conversation_id])!;
      return { conversation: conv, partner };
    }

    const convId = uuidv4();
    const now = new Date().toISOString();

    return transaction(() => {
      run('INSERT INTO conversations (id, created_at, updated_at) VALUES (?, ?, ?)', [convId, now, now]);
      run('INSERT INTO conversation_members (conversation_id, user_id, joined_at) VALUES (?, ?, ?)', [convId, userA, now]);
      run('INSERT INTO conversation_members (conversation_id, user_id, joined_at) VALUES (?, ?, ?)', [convId, userB, now]);

      const newConv: Conversation = { id: convId, created_at: now, updated_at: now };
      return { conversation: newConv, partner };
    });
  }

  static getConversations(userId: string): { conversation: Conversation; partner: Partial<User>; lastMessage?: Message; unreadCount: number }[] {
    const memberRows = query<{ conversation_id: string; last_read_at?: string }>(
      'SELECT conversation_id, last_read_at FROM conversation_members WHERE user_id = ?',
      [userId]
    );

    const results: { conversation: Conversation; partner: Partial<User>; lastMessage?: Message; unreadCount: number }[] = [];

    for (const row of memberRows) {
      const conv = queryOne<Conversation>('SELECT * FROM conversations WHERE id = ?', [row.conversation_id]);
      if (!conv) continue;

      const partnerMember = queryOne<{ user_id: string }>(
        'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?',
        [row.conversation_id, userId]
      );
      if (!partnerMember) continue;

      if (DiscoveryService.isBlocked(userId, partnerMember.user_id)) continue;

      const partner = queryOne<User>(
        'SELECT id, display_name, avatar_url, age, location, gender, is_online, last_active_at FROM users WHERE id = ?',
        [partnerMember.user_id]
      );
      if (!partner) continue;

      const lastMessage = queryOne<Message>(
        'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1',
        [row.conversation_id]
      );

      const unreadRow = queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM messages 
         WHERE conversation_id = ? AND sender_id != ? AND created_at > ?`,
        [row.conversation_id, userId, row.last_read_at || '1970-01-01']
      );

      results.push({
        conversation: conv,
        partner,
        lastMessage: lastMessage || undefined,
        unreadCount: unreadRow ? unreadRow.count : 0,
      });
    }

    results.sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : new Date(a.conversation.created_at).getTime();
      const timeB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : new Date(b.conversation.created_at).getTime();
      return timeB - timeA;
    });

    return results;
  }

  static getMessages(conversationId: string, userId: string, limit: number = 50): Message[] {
    const isMember = queryOne('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?', [
      conversationId,
      userId,
    ]);
    if (!isMember) throw new Error('Unauthorized to view this conversation.');

    // Update last_read_at
    run('UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?', [
      new Date().toISOString(),
      conversationId,
      userId,
    ]);

    return query<Message>(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?',
      [conversationId, limit]
    );
  }

  static sendMessage(
    senderId: string,
    conversationId: string,
    content: string,
    mediaUrl?: string | null,
    mediaType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'STICKER' | 'GIFT' | null
  ): Message {
    const isMember = queryOne('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?', [
      conversationId,
      senderId,
    ]);
    if (!isMember) throw new Error('Unauthorized to send messages in this conversation.');

    const partnerMember = queryOne<{ user_id: string }>(
      'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?',
      [conversationId, senderId]
    );
    if (!partnerMember) throw new Error('Recipient not found in conversation.');

    if (DiscoveryService.isBlocked(senderId, partnerMember.user_id)) {
      throw new Error('Cannot send message due to blocking settings.');
    }

    const msgId = uuidv4();
    const now = new Date().toISOString();
    let isPaid = false;
    let creditCost = 0;

    return transaction(() => {
      // Sticker costs 5 credits (Section 29)
      if (mediaType === 'STICKER') {
        creditCost = 5;
        isPaid = true;
        CreditService.spendCredits(
          senderId,
          5,
          'STICKER_SENT',
          msgId,
          'Sent sticker in live chat (5 credits)'
        );
      }

      run(
        `INSERT INTO messages 
        (id, conversation_id, sender_id, content, media_url, media_type, is_paid, credit_cost, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [msgId, conversationId, senderId, content, mediaUrl || null, mediaType || 'TEXT', isPaid ? 1 : 0, creditCost, now]
      );

      run('UPDATE conversations SET updated_at = ? WHERE id = ?', [now, conversationId]);

      const message: Message = {
        id: msgId,
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        media_url: mediaUrl || null,
        media_type: mediaType || 'TEXT',
        is_paid: isPaid,
        credit_cost: creditCost,
        created_at: now,
      };

      // Broadcast real-time message to partner
      broadcastToUser(partnerMember.user_id, {
        type: 'NEW_MESSAGE',
        payload: {
          message,
          conversationId,
        },
      });

      const sender = queryOne<User>('SELECT display_name FROM users WHERE id = ?', [senderId]);
      NotificationService.create(
        partnerMember.user_id,
        'NEW_MESSAGE',
        'New Message',
        `${sender?.display_name || 'Someone'}: ${content.substring(0, 30)}`,
        conversationId,
        'CONVERSATION'
      );

      return message;
    });
  }

  // --- GIFTS ---
  static getActiveGifts(): Gift[] {
    return query<Gift>('SELECT * FROM gifts WHERE is_active = 1 ORDER BY credit_price ASC');
  }

  static sendGift(senderId: string, receiverId: string, giftId: string, messageText?: string): void {
    if (senderId === receiverId) throw new Error('Cannot send gifts to yourself.');
    if (DiscoveryService.isBlocked(senderId, receiverId)) throw new Error('Cannot send gift to this user.');

    const gift = queryOne<Gift>('SELECT * FROM gifts WHERE id = ? AND is_active = 1', [giftId]);
    if (!gift) throw new Error('Gift not found.');

    const sender = queryOne<User>('SELECT display_name FROM users WHERE id = ?', [senderId]);
    const now = new Date().toISOString();
    const txId = uuidv4();

    transaction(() => {
      // 1. Debit credits from sender
      CreditService.spendCredits(
        senderId,
        gift.credit_price,
        'GIFT_SENT',
        gift.id,
        `Sent gift "${gift.name}" (${gift.credit_price} credits)`
      );

      // 2. Record gift transaction
      run(
        `INSERT INTO gift_transactions 
        (id, sender_id, receiver_id, gift_id, gift_name, credit_price, message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [txId, senderId, receiverId, gift.id, gift.name, gift.credit_price, messageText || null, now]
      );

      // 3. Notify receiver
      NotificationService.create(
        receiverId,
        'GIFT',
        'Virtual Gift Received!',
        `${sender?.display_name || 'Someone'} sent you a ${gift.name}! 🎁`,
        gift.id,
        'GIFT'
      );

      // 4. Send message inside conversation if conversation exists
      try {
        const { conversation } = this.getOrCreateConversation(senderId, receiverId);
        this.sendMessage(
          senderId,
          conversation.id,
          `🎁 Sent a ${gift.name}${messageText ? ': ' + messageText : ''}`,
          null,
          'GIFT'
        );
      } catch {
        // Safe fallback if conversation setup fails
      }
    });
  }

  // --- MAIL SUBSYSTEM ---
  static getMailThreads(userId: string, folder: 'INBOX' | 'SENT' | 'ARCHIVE' = 'INBOX'): { thread: MailThread; partner: Partial<User>; lastMessage?: MailMessage; unreadLetters: number }[] {
    const threads = query<MailThread>(
      'SELECT * FROM mail_threads WHERE user1_id = ? OR user2_id = ? ORDER BY last_message_at DESC',
      [userId, userId]
    );

    const results: { thread: MailThread; partner: Partial<User>; lastMessage?: MailMessage; unreadLetters: number }[] = [];

    for (const t of threads) {
      const partnerId = t.user1_id === userId ? t.user2_id : t.user1_id;
      if (DiscoveryService.isBlocked(userId, partnerId)) continue;

      const partner = queryOne<User>(
        'SELECT id, display_name, avatar_url, age, location, gender FROM users WHERE id = ?',
        [partnerId]
      );
      if (!partner) continue;

      const lastMsg = queryOne<MailMessage>(
        'SELECT * FROM mail_messages WHERE thread_id = ? ORDER BY created_at DESC LIMIT 1',
        [t.id]
      );

      // Filter by folder logic
      if (folder === 'ARCHIVE') {
        const hasArchived = queryOne(
          `SELECT 1 FROM mail_messages 
           WHERE thread_id = ? AND ((sender_id = ? AND is_archived_sender = 1) OR (recipient_id = ? AND is_archived_recipient = 1))`,
          [t.id, userId, userId]
        );
        if (!hasArchived) continue;
      } else if (folder === 'SENT') {
        const hasSent = queryOne(
          'SELECT 1 FROM mail_messages WHERE thread_id = ? AND sender_id = ? AND is_archived_sender = 0',
          [t.id, userId]
        );
        if (!hasSent) continue;
      } else {
        // INBOX: messages where user is recipient and not archived
        const hasInbox = queryOne(
          'SELECT 1 FROM mail_messages WHERE thread_id = ? AND recipient_id = ? AND is_archived_recipient = 0',
          [t.id, userId]
        );
        if (!hasInbox && t.message_count > 0) continue;
      }

      const unreadRow = queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM mail_messages WHERE thread_id = ? AND recipient_id = ? AND is_opened = 0',
        [t.id, userId]
      );

      results.push({
        thread: t,
        partner,
        lastMessage: lastMsg || undefined,
        unreadLetters: unreadRow ? unreadRow.count : 0,
      });
    }

    return results;
  }

  static getMailThreadDetails(threadId: string, userId: string): { thread: MailThread; partner: Partial<User>; messages: MailMessage[] } {
    const thread = queryOne<MailThread>('SELECT * FROM mail_threads WHERE id = ?', [threadId]);
    if (!thread) throw new Error('Mail thread not found.');
    if (thread.user1_id !== userId && thread.user2_id !== userId) throw new Error('Unauthorized.');

    const partnerId = thread.user1_id === userId ? thread.user2_id : thread.user1_id;
    const partner = queryOne<User>(
      'SELECT id, display_name, avatar_url, age, location, gender FROM users WHERE id = ?',
      [partnerId]
    )!;

    const messages = query<MailMessage>(
      'SELECT * FROM mail_messages WHERE thread_id = ? ORDER BY created_at ASC',
      [threadId]
    );

    return { thread, partner, messages };
  }

  static sendMail(
    senderId: string,
    recipientId: string,
    subject: string,
    content: string,
    mediaUrl?: string | null,
    mediaType?: 'IMAGE' | 'VIDEO' | null
  ): { thread: MailThread; message: MailMessage } {
    if (senderId === recipientId) throw new Error('Cannot mail yourself.');
    if (DiscoveryService.isBlocked(senderId, recipientId)) throw new Error('Cannot send mail to this user.');

    return transaction(() => {
      // Order user IDs consistently
      const [u1, u2] = senderId < recipientId ? [senderId, recipientId] : [recipientId, senderId];

      let thread = queryOne<MailThread>(
        'SELECT * FROM mail_threads WHERE user1_id = ? AND user2_id = ?',
        [u1, u2]
      );

      const now = new Date().toISOString();
      let threadId = thread ? thread.id : uuidv4();

      if (!thread) {
        run(
          `INSERT INTO mail_threads (id, user1_id, user2_id, subject, message_count, photo_count, last_message_at, created_at)
           VALUES (?, ?, ?, ?, 0, 0, ?, ?)`,
          [threadId, u1, u2, subject, now, now]
        );
        thread = {
          id: threadId,
          user1_id: u1,
          user2_id: u2,
          subject,
          message_count: 0,
          photo_count: 0,
          last_message_at: now,
          created_at: now,
        };
      }

      // Calculate credit cost for sending mail (Section 26)
      const cost = MailBillingService.getSendLetterCost(thread.id);

      CreditService.spendCredits(
        senderId,
        cost,
        'MAIL_SENT',
        thread.id,
        `Sent mail letter: "${subject.substring(0, 25)}" (${cost} credits)`
      );

      const msgId = uuidv4();
      const isPhoto = mediaType === 'IMAGE';
      const isVideo = mediaType === 'VIDEO';

      run(
        `INSERT INTO mail_messages 
        (id, thread_id, sender_id, recipient_id, subject, content, media_url, media_type, is_opened, credit_cost_sent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [msgId, thread.id, senderId, recipientId, subject, content, mediaUrl || null, mediaType || null, cost, now]
      );

      const newMsgCount = thread.message_count + 1;
      const newPhotoCount = thread.photo_count + (isPhoto ? 1 : 0);
      run(
        'UPDATE mail_threads SET message_count = ?, photo_count = ?, last_message_at = ?, subject = ? WHERE id = ?',
        [newMsgCount, newPhotoCount, now, subject, thread.id]
      );

      const sender = queryOne<User>('SELECT display_name FROM users WHERE id = ?', [senderId]);
      NotificationService.create(
        recipientId,
        'NEW_MAIL',
        'New Letter in Mailbox',
        `${sender?.display_name || 'Someone'} sent you a letter: "${subject}"`,
        thread.id,
        'MAIL'
      );

      const message: MailMessage = {
        id: msgId,
        thread_id: thread.id,
        sender_id: senderId,
        recipient_id: recipientId,
        subject,
        content,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
        is_opened: false,
        credit_cost_sent: cost,
        credit_cost_opened: 0,
        is_archived_sender: false,
        is_archived_recipient: false,
        created_at: now,
      };

      return {
        thread: { ...thread, message_count: newMsgCount, photo_count: newPhotoCount, last_message_at: now },
        message,
      };
    });
  }

  static openMail(messageId: string, recipientId: string): MailMessage {
    const msg = queryOne<MailMessage>('SELECT * FROM mail_messages WHERE id = ?', [messageId]);
    if (!msg) throw new Error('Message not found.');
    if (msg.recipient_id !== recipientId) throw new Error('Unauthorized to open this message.');

    if (msg.is_opened) {
      return msg; // Already opened
    }

    return transaction(() => {
      // Calculate opening cost:
      // First letter: free
      // Following letters: 10 credits
      const openCost = MailBillingService.getOpenLetterCost(msg.thread_id, recipientId);

      if (openCost > 0) {
        CreditService.spendCredits(
          recipientId,
          openCost,
          'MAIL_OPENED',
          msg.id,
          `Opened mail letter (${openCost} credits)`
        );
      }

      const now = new Date().toISOString();
      run('UPDATE mail_messages SET is_opened = 1, opened_at = ?, credit_cost_opened = ? WHERE id = ?', [
        now,
        openCost,
        msg.id,
      ]);

      return {
        ...msg,
        is_opened: true,
        opened_at: now,
        credit_cost_opened: openCost,
      };
    });
  }

  static unlockMailVideo(messageId: string, recipientId: string): MailMessage {
    const msg = queryOne<MailMessage>('SELECT * FROM mail_messages WHERE id = ?', [messageId]);
    if (!msg) throw new Error('Message not found.');
    if (msg.recipient_id !== recipientId) throw new Error('Unauthorized.');
    if (msg.media_type !== 'VIDEO') throw new Error('No video attached to this letter.');

    // 50 credits to open video (Section 26)
    CreditService.spendCredits(
      recipientId,
      50,
      'VIDEO_OPENED',
      msg.id,
      'Unlocked mail video (50 credits)'
    );

    return msg;
  }
}
