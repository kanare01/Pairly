import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, run, transaction } from '../db.js';
import { Report, ModerationAction, AuditLog, User, ReportStatus } from '../types.js';
import { CreditService } from './creditService.js';
import { NotificationService } from './notificationService.js';

export class ModerationService {
  static createReport(
    reporterId: string,
    targetUserId: string,
    targetType: 'PROFILE' | 'POST' | 'MESSAGE' | 'MAIL' | 'OTHER',
    targetId: string | null,
    reason: string,
    details?: string
  ): Report {
    if (reporterId === targetUserId) throw new Error('Cannot report yourself.');

    const id = uuidv4();
    const now = new Date().toISOString();

    run(
      `INSERT INTO reports 
      (id, reporter_id, target_user_id, target_type, target_id, reason, details, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      [id, reporterId, targetUserId, targetType, targetId || null, reason, details || null, now, now]
    );

    this.logAudit(
      reporterId,
      'CREATE_REPORT',
      'USER',
      targetUserId,
      JSON.stringify({ reason, targetType, targetId })
    );

    return {
      id,
      reporter_id: reporterId,
      target_user_id: targetUserId,
      target_type: targetType,
      target_id: targetId || null,
      reason,
      details: details || null,
      status: 'PENDING',
      created_at: now,
      updated_at: now,
    };
  }

  static getReports(status?: ReportStatus): { report: Report; reporter: Partial<User>; targetUser: Partial<User> }[] {
    let sql = 'SELECT * FROM reports';
    const params: any[] = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';

    const reports = query<Report>(sql, params);
    return reports
      .map((r) => {
        const reporter = queryOne<User>('SELECT id, display_name, email FROM users WHERE id = ?', [r.reporter_id]);
        const targetUser = queryOne<User>(
          'SELECT id, display_name, email, status, avatar_url, age FROM users WHERE id = ?',
          [r.target_user_id]
        );
        return {
          report: r,
          reporter: reporter || { id: r.reporter_id, display_name: 'Unknown' },
          targetUser: targetUser || { id: r.target_user_id, display_name: 'Deleted User' },
        };
      });
  }

  static resolveReport(reportId: string, moderatorId: string, resolutionNotes: string, actionTaken: 'RESOLVED' | 'DISMISSED'): void {
    const report = queryOne<Report>('SELECT * FROM reports WHERE id = ?', [reportId]);
    if (!report) throw new Error('Report not found.');

    const now = new Date().toISOString();
    run(
      'UPDATE reports SET status = ?, resolution_notes = ?, moderator_id = ?, updated_at = ? WHERE id = ?',
      [actionTaken, resolutionNotes, moderatorId, now, reportId]
    );

    this.logAudit(
      moderatorId,
      `REPORT_${actionTaken}`,
      'REPORT',
      reportId,
      JSON.stringify({ resolutionNotes })
    );
  }

  static performModerationAction(
    moderatorId: string,
    targetUserId: string,
    actionType: 'WARN' | 'SUSPEND' | 'BAN' | 'RESTORE',
    reason: string
  ): void {
    const target = queryOne<User>('SELECT * FROM users WHERE id = ?', [targetUserId]);
    if (!target) throw new Error('Target user not found.');

    const now = new Date().toISOString();
    const actionId = uuidv4();

    transaction(() => {
      run(
        'INSERT INTO moderation_actions (id, moderator_id, target_user_id, action_type, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [actionId, moderatorId, targetUserId, actionType, reason, now]
      );

      let newStatus = target.status;
      if (actionType === 'BAN') newStatus = 'BANNED';
      else if (actionType === 'SUSPEND') newStatus = 'SUSPENDED';
      else if (actionType === 'RESTORE') newStatus = 'ACTIVE';

      run('UPDATE users SET status = ?, updated_at = ? WHERE id = ?', [newStatus, now, targetUserId]);

      this.logAudit(
        moderatorId,
        `USER_${actionType}`,
        'USER',
        targetUserId,
        JSON.stringify({ reason, previousStatus: target.status, newStatus })
      );

      if (actionType === 'WARN') {
        NotificationService.create(
          targetUserId,
          'SYSTEM_NOTIFICATION',
          'Community Guidelines Warning',
          `You received a moderation warning: "${reason}". Please abide by Pairly rules.`
        );
      }
    });
  }

  static logAudit(actorId: string, action: string, targetType: string, targetId: string | null, details: string, ipAddress?: string): void {
    const id = uuidv4();
    const now = new Date().toISOString();
    run(
      'INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, actorId, action, targetType, targetId || null, details, ipAddress || null, now]
    );
  }

  static getAuditLogs(limit: number = 100): AuditLog[] {
    return query<AuditLog>('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?', [limit]);
  }

  static getDashboardMetrics() {
    const userCount = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users');
    const activeUsers = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users WHERE status = "ACTIVE"');
    const suspendedUsers = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users WHERE status = "SUSPENDED" OR status = "BANNED"');
    const postCount = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM posts');
    const messageCount = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM messages');
    const reportsCount = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM reports WHERE status = "PENDING"');

    const totalRevenueRow = queryOne<{ total: number }>(
      'SELECT SUM(amount_usd) as total FROM payment_transactions WHERE status = "SUCCEEDED"'
    );
    const creditsBoughtRow = queryOne<{ total: number }>(
      'SELECT SUM(credits_awarded) as total FROM payment_transactions WHERE status = "SUCCEEDED"'
    );
    const creditsSpentRow = queryOne<{ total: number }>(
      'SELECT SUM(amount) as total FROM credit_transactions WHERE amount < 0'
    );

    return {
      totalUsers: userCount?.count || 0,
      registeredUsers: userCount?.count || 0,
      activeUsers: activeUsers?.count || 0,
      suspendedUsers: suspendedUsers?.count || 0,
      suspendedAccounts: suspendedUsers?.count || 0,
      bannedUsers: suspendedUsers?.count || 0,
      posts: postCount?.count || 0,
      messages: messageCount?.count || 0,
      activeChatSessions: messageCount?.count || 0,
      pendingReports: reportsCount?.count || 0,
      revenueUsd: totalRevenueRow?.total || 0,
      totalRevenueUsd: totalRevenueRow?.total || 0,
      creditsPurchased: creditsBoughtRow?.total || 0,
      creditsConsumed: Math.abs(creditsSpentRow?.total || 0),
      systemHealth: 'OPERATIONAL',
      database: 'ONLINE',
      storage: 'HEALTHY',
    };
  }
}
