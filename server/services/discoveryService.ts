import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, run, transaction } from '../db.js';
import { User, Like, Match, Follow, Block } from '../types.js';
import { NotificationService } from './notificationService.js';

export class DiscoveryService {
  /**
   * Checks if either user has blocked the other.
   * Blocks are enforced globally across all modules!
   */
  static isBlocked(userA: string, userB: string): boolean {
    const block = queryOne<Block>(
      'SELECT id FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
      [userA, userB, userB, userA]
    );
    return !!block;
  }

  /**
   * Returns list of user IDs that either blocked or were blocked by userId.
   */
  static getBlockedUserIds(userId: string): string[] {
    const rows = query<{ other_id: string }>(
      `SELECT blocked_id as other_id FROM blocks WHERE blocker_id = ?
       UNION
       SELECT blocker_id as other_id FROM blocks WHERE blocked_id = ?`,
      [userId, userId]
    );
    return rows.map((r) => r.other_id);
  }

  /**
   * Discovers people excluding self and blocked users.
   */
  static getPeople(
    currentUserId: string,
    options: {
      gender?: string;
      minAge?: number;
      maxAge?: number;
      location?: string;
      intention?: string;
      onlineOnly?: boolean;
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): { users: Partial<User>[]; total: number } {
    const blockedIds = currentUserId ? this.getBlockedUserIds(currentUserId) : [];
    const excludeIds = (currentUserId ? [currentUserId, ...blockedIds] : []).filter(Boolean);

    let sql = 'SELECT * FROM users WHERE status = "ACTIVE"';
    const params: any[] = [];

    if (excludeIds.length > 0) {
      const placeholders = excludeIds.map(() => '?').join(',');
      sql += ` AND id NOT IN (${placeholders})`;
      params.push(...excludeIds);
    }

    if (options.gender && options.gender !== 'ALL') {
      sql += ' AND gender = ?';
      params.push(options.gender);
    }

    if (options.minAge) {
      sql += ' AND age >= ?';
      params.push(options.minAge);
    }

    if (options.maxAge) {
      sql += ' AND age <= ?';
      params.push(options.maxAge);
    }

    if (options.location) {
      sql += ' AND location LIKE ?';
      params.push(`%${options.location}%`);
    }

    if (options.intention) {
      sql += ' AND relationship_intention = ?';
      params.push(options.intention);
    }

    if (options.onlineOnly) {
      sql += ' AND is_online = 1';
    }

    if (options.search) {
      sql += ' AND (display_name LIKE ? OR bio LIKE ? OR interests LIKE ?)';
      params.push(`%${options.search}%`, `%${options.search}%`, `%${options.search}%`);
    }

    // Count query
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countRow = queryOne<{ count: number }>(countSql, params);
    const total = countRow ? countRow.count : 0;

    sql += ' ORDER BY is_online DESC, last_active_at DESC';

    const limit = options.limit || 20;
    const offset = options.offset || 0;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const users = query<User>(sql, params).map((u) => {
      // Omit private fields
      const { password_hash, verification_token, reset_token, reset_token_expires, ...publicData } = u;
      return publicData;
    });

    return { users, total };
  }

  /**
   * Likes a user. If mutual like occurs, automatically creates a Match!
   */
  static likeUser(senderId: string, targetId: string): { liked: boolean; matched: boolean; match?: Match } {
    if (senderId === targetId) {
      throw new Error('You cannot like yourself.');
    }

    if (this.isBlocked(senderId, targetId)) {
      throw new Error('Cannot like this user due to privacy/blocking settings.');
    }

    return transaction(() => {
      const existing = queryOne<Like>('SELECT * FROM likes WHERE sender_id = ? AND target_id = ?', [
        senderId,
        targetId,
      ]);

      if (existing) {
        return { liked: true, matched: false };
      }

      const likeId = uuidv4();
      const now = new Date().toISOString();
      run('INSERT INTO likes (id, sender_id, target_id, created_at) VALUES (?, ?, ?, ?)', [
        likeId,
        senderId,
        targetId,
        now,
      ]);

      // Check if target has liked sender (Mutual match!)
      const reciprocalLike = queryOne<Like>('SELECT * FROM likes WHERE sender_id = ? AND target_id = ?', [
        targetId,
        senderId,
      ]);

      let matched = false;
      let match: Match | undefined;

      const sender = queryOne<User>('SELECT display_name FROM users WHERE id = ?', [senderId]);

      if (reciprocalLike) {
        // Create match
        const matchId = uuidv4();
        // Standardize ordering for uniqueness
        const [u1, u2] = senderId < targetId ? [senderId, targetId] : [targetId, senderId];
        const existingMatch = queryOne<Match>('SELECT * FROM matches WHERE user1_id = ? AND user2_id = ?', [u1, u2]);

        if (!existingMatch) {
          run('INSERT INTO matches (id, user1_id, user2_id, created_at) VALUES (?, ?, ?, ?)', [
            matchId,
            u1,
            u2,
            now,
          ]);

          match = { id: matchId, user1_id: u1, user2_id: u2, created_at: now };
          matched = true;

          // Notify both users of the new match!
          NotificationService.create(
            targetId,
            'NEW_MATCH',
            "It's a Match!",
            `You and ${sender?.display_name || 'someone'} liked each other!`,
            senderId,
            'USER'
          );

          NotificationService.create(
            senderId,
            'NEW_MATCH',
            "It's a Match!",
            `You and your new match connected!`,
            targetId,
            'USER'
          );
        }
      } else {
        // Notify target of new like
        NotificationService.create(
          targetId,
          'LIKE',
          'New Like',
          `${sender?.display_name || 'Someone'} liked your profile!`,
          senderId,
          'USER'
        );
      }

      return { liked: true, matched, match };
    });
  }

  static unlikeUser(senderId: string, targetId: string): void {
    run('DELETE FROM likes WHERE sender_id = ? AND target_id = ?', [senderId, targetId]);
  }

  static getMatches(userId: string): { match: Match; partner: Partial<User> }[] {
    const matches = query<Match>(
      'SELECT * FROM matches WHERE user1_id = ? OR user2_id = ? ORDER BY created_at DESC',
      [userId, userId]
    );

    return matches
      .map((m) => {
        const partnerId = m.user1_id === userId ? m.user2_id : m.user1_id;
        if (this.isBlocked(userId, partnerId)) return null;

        const partner = queryOne<User>('SELECT * FROM users WHERE id = ?', [partnerId]);
        if (!partner || partner.status !== 'ACTIVE') return null;

        const { password_hash, verification_token, reset_token, ...safeData } = partner;
        return { match: m, partner: safeData };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }

  static followUser(followerId: string, followingId: string): void {
    if (followerId === followingId) throw new Error('Cannot follow yourself.');
    if (this.isBlocked(followerId, followingId)) throw new Error('Cannot follow this user.');

    const now = new Date().toISOString();
    const existing = queryOne('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?', [
      followerId,
      followingId,
    ]);
    if (!existing) {
      run('INSERT INTO follows (id, follower_id, following_id, created_at) VALUES (?, ?, ?, ?)', [
        uuidv4(),
        followerId,
        followingId,
        now,
      ]);

      const follower = queryOne<User>('SELECT display_name FROM users WHERE id = ?', [followerId]);
      NotificationService.create(
        followingId,
        'FOLLOW',
        'New Follower',
        `${follower?.display_name || 'Someone'} started following your updates.`,
        followerId,
        'USER'
      );
    }
  }

  static unfollowUser(followerId: string, followingId: string): void {
    run('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [followerId, followingId]);
  }

  static blockUser(blockerId: string, blockedId: string, reason?: string): void {
    if (blockerId === blockedId) throw new Error('Cannot block yourself.');

    const now = new Date().toISOString();
    transaction(() => {
      run('INSERT OR IGNORE INTO blocks (id, blocker_id, blocked_id, reason, created_at) VALUES (?, ?, ?, ?, ?)', [
        uuidv4(),
        blockerId,
        blockedId,
        reason || null,
        now,
      ]);

      // Remove any existing likes, matches, or follows
      run('DELETE FROM likes WHERE (sender_id = ? AND target_id = ?) OR (sender_id = ? AND target_id = ?)', [
        blockerId,
        blockedId,
        blockedId,
        blockerId,
      ]);

      run('DELETE FROM matches WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)', [
        blockerId,
        blockedId,
        blockedId,
        blockerId,
      ]);

      run('DELETE FROM follows WHERE (follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)', [
        blockerId,
        blockedId,
        blockedId,
        blockerId,
      ]);
    });
  }

  static unblockUser(blockerId: string, blockedId: string): void {
    run('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?', [blockerId, blockedId]);
  }

  static getBlockedList(userId: string): { id: string; blocked: Partial<User>; created_at: string }[] {
    const blocks = query<Block>('SELECT * FROM blocks WHERE blocker_id = ? ORDER BY created_at DESC', [userId]);
    return blocks
      .map((b) => {
        const user = queryOne<User>('SELECT id, display_name, avatar_url, age, location FROM users WHERE id = ?', [
          b.blocked_id,
        ]);
        return user ? { id: b.id, blocked: user, created_at: b.created_at } : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }
}
