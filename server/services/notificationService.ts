import { v4 as uuidv4 } from 'uuid';
import { run, query } from '../db.js';
import { Notification, NotificationType } from '../types.js';
import { broadcastToUser } from '../websocket/wsServer.js';

export class NotificationService {
  static create(
    userId: string,
    type: NotificationType,
    title: string,
    content: string,
    referenceId?: string | null,
    referenceType?: string | null
  ): Notification {
    const id = uuidv4();
    const now = new Date().toISOString();

    run(
      `INSERT INTO notifications (id, user_id, type, title, content, reference_id, reference_type, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [id, userId, type, title, content, referenceId || null, referenceType || null, now]
    );

    const notif: Notification = {
      id,
      user_id: userId,
      type,
      title,
      content,
      reference_id: referenceId || null,
      reference_type: referenceType || null,
      is_read: false,
      created_at: now,
    };

    // Real-time broadcast if user is connected
    try {
      broadcastToUser(userId, {
        type: 'NOTIFICATION',
        payload: notif,
      });
    } catch {
      // Best-effort push
    }

    return notif;
  }

  static getUserNotifications(userId: string, limit: number = 30): Notification[] {
    return query<Notification>(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    );
  }

  static getUnreadCount(userId: string): number {
    const res = query<{ count: number }>(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    return res.length > 0 ? res[0].count : 0;
  }

  static markAllAsRead(userId: string): void {
    run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
  }

  static markAsRead(notificationId: string, userId: string): void {
    run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [notificationId, userId]);
  }
}
