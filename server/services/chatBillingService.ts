import { v4 as uuidv4 } from 'uuid';
import { queryOne, run } from '../db.js';
import { ChatSession } from '../types.js';
import { CreditService } from './creditService.js';
import { NotificationService } from './notificationService.js';

export class ChatBillingService {
  private static CHAT_RATE_PER_MINUTE = 2;

  /**
   * Starts or resumes a billable chat session between two users in a conversation.
   */
  static startOrResumeSession(userId: string, conversationId: string, partnerId: string): ChatSession {
    // Check if an active session already exists for this user in this conversation
    let session = queryOne<ChatSession>(
      'SELECT * FROM chat_sessions WHERE conversation_id = ? AND user_id = ? AND is_active = 1',
      [conversationId, userId]
    );

    const now = new Date().toISOString();

    if (session) {
      // Process any pending unbilled minutes up to now
      return this.processSessionBilling(session);
    }

    // Verify user has at least 2 credits before starting
    const wallet = CreditService.getWallet(userId);
    if (wallet.balance < this.CHAT_RATE_PER_MINUTE) {
      throw new Error(`Insufficient credits to start live chat. You need at least ${this.CHAT_RATE_PER_MINUTE} credits.`);
    }

    const sessionId = uuidv4();
    run(
      `INSERT INTO chat_sessions 
      (id, conversation_id, user_id, partner_id, started_at, last_billed_at, total_minutes_billed, total_credits_billed, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, 1)`,
      [sessionId, conversationId, userId, partnerId, now, now]
    );

    return {
      id: sessionId,
      conversation_id: conversationId,
      user_id: userId,
      partner_id: partnerId,
      started_at: now,
      last_billed_at: now,
      total_minutes_billed: 0,
      total_credits_billed: 0,
      is_active: true,
    };
  }

  /**
   * Heartbeat / interval billing check for an active session.
   * Charges 2 credits per full 60-second block elapsed.
   */
  static processSessionBilling(session: ChatSession): ChatSession {
    if (!session.is_active) return session;

    const lastBilled = new Date(session.last_billed_at).getTime();
    const nowMs = Date.now();
    const elapsedMinutes = Math.floor((nowMs - lastBilled) / (60 * 1000));

    if (elapsedMinutes <= 0) {
      return session;
    }

    const creditsToCharge = elapsedMinutes * this.CHAT_RATE_PER_MINUTE;
    const wallet = CreditService.getWallet(session.user_id);

    if (wallet.balance < creditsToCharge) {
      // End the session due to insufficient funds
      this.endSession(session.id, session.user_id);
      NotificationService.create(
        session.user_id,
        'LOW_CREDIT_BALANCE',
        'Chat Session Ended',
        'Your live chat session was ended because your credit balance is empty.'
      );
      throw new Error('Chat session ended due to insufficient credits.');
    }

    // Atomically debit credits
    CreditService.spendCredits(
      session.user_id,
      creditsToCharge,
      'CHAT_USAGE',
      session.id,
      `Live chat billing: ${elapsedMinutes} min (${creditsToCharge} credits)`
    );

    const newLastBilled = new Date(lastBilled + elapsedMinutes * 60 * 1000).toISOString();
    const newMinutesBilled = session.total_minutes_billed + elapsedMinutes;
    const newCreditsBilled = session.total_credits_billed + creditsToCharge;

    run(
      `UPDATE chat_sessions 
       SET last_billed_at = ?, total_minutes_billed = ?, total_credits_billed = ? 
       WHERE id = ?`,
      [newLastBilled, newMinutesBilled, newCreditsBilled, session.id]
    );

    return {
      ...session,
      last_billed_at: newLastBilled,
      total_minutes_billed: newMinutesBilled,
      total_credits_billed: newCreditsBilled,
    };
  }

  /**
   * Ends a chat session.
   */
  static endSession(sessionId: string, userId: string): void {
    const session = queryOne<ChatSession>(
      'SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?',
      [sessionId, userId]
    );
    if (!session || !session.is_active) return;

    const now = new Date().toISOString();
    run(
      'UPDATE chat_sessions SET is_active = 0, ended_at = ? WHERE id = ?',
      [now, sessionId]
    );
  }

  /**
   * Get active session for user in conversation if any.
   */
  static getActiveSession(userId: string, conversationId: string): ChatSession | null {
    const session = queryOne<ChatSession>(
      'SELECT * FROM chat_sessions WHERE conversation_id = ? AND user_id = ? AND is_active = 1',
      [conversationId, userId]
    );
    if (!session) return null;
    return this.processSessionBilling(session);
  }
}
