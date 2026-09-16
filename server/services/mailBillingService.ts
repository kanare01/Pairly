import { query, queryOne } from '../db.js';
import { MailThread, MailMessage } from '../types.js';

export class MailBillingService {
  /**
   * Calculates credit cost for sending a mail letter in a thread.
   * First letter in thread: 10 credits.
   * Following letters: 30 credits.
   */
  static getSendLetterCost(threadId: string): number {
    const thread = queryOne<MailThread>('SELECT * FROM mail_threads WHERE id = ?', [threadId]);
    if (!thread || thread.message_count === 0) {
      return 10;
    }
    return 30;
  }

  /**
   * Calculates credit cost to open a received mail message.
   * First letter opened in thread: 0 credits (free).
   * Following letters: 10 credits.
   */
  static getOpenLetterCost(threadId: string, recipientId: string): number {
    const openedLetters = query<{ id: string }>(
      'SELECT id FROM mail_messages WHERE thread_id = ? AND recipient_id = ? AND is_opened = 1',
      [threadId, recipientId]
    );

    if (openedLetters.length === 0) {
      return 0; // First letter is free
    }
    return 10; // Following letters are 10 credits
  }

  /**
   * Calculates cost for photos or videos in mail:
   * Photos: Sending is free. Opening: first photo in thread is free, following photos 10 credits.
   * Videos: Opening video is 50 credits.
   */
  static getMediaUnlockCost(threadId: string, mediaType: 'IMAGE' | 'VIDEO', recipientId: string): number {
    if (mediaType === 'VIDEO') {
      return 50; // Video opening: 50 credits
    }

    if (mediaType === 'IMAGE') {
      // Check if any opened photos exist in this thread for this recipient
      const openedPhotos = query<{ id: string }>(
        `SELECT id FROM mail_messages 
         WHERE thread_id = ? AND recipient_id = ? AND media_type = 'IMAGE' AND is_opened = 1`,
        [threadId, recipientId]
      );
      if (openedPhotos.length === 0) {
        return 0; // First photo is free
      }
      return 10; // Following photos: 10 credits
    }

    return 0;
  }
}
