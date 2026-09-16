import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, run, transaction } from '../db.js';
import { Post, PostComment, PostReaction, User } from '../types.js';
import { DiscoveryService } from './discoveryService.js';
import { NotificationService } from './notificationService.js';
import { CreditService } from './creditService.js';

export class SocialService {
  static createPost(
    userId: string,
    content: string,
    mediaUrl?: string | null,
    mediaType?: 'IMAGE' | 'VIDEO' | null,
    isExclusive: boolean = false,
    creditPrice: number = 0
  ): Post {
    const id = uuidv4();
    const now = new Date().toISOString();

    run(
      `INSERT INTO posts 
      (id, user_id, content, media_url, media_type, is_exclusive, credit_price, likes_count, comments_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
      [id, userId, content, mediaUrl || null, mediaType || null, isExclusive ? 1 : 0, creditPrice || 0, now, now]
    );

    const author = queryOne<User>(
      'SELECT id, display_name, avatar_url, age, location, gender, role FROM users WHERE id = ?',
      [userId]
    );

    return {
      id,
      user_id: userId,
      content,
      media_url: mediaUrl || null,
      media_type: mediaType || null,
      is_exclusive: isExclusive,
      credit_price: creditPrice,
      likes_count: 0,
      comments_count: 0,
      created_at: now,
      updated_at: now,
      user: author as User,
      user_liked: false,
      is_unlocked: true,
    } as any;
  }

  static getFeed(
    currentUserId: string,
    limit: number = 20,
    offset: number = 0
  ): any[] {
    const blockedIds = currentUserId ? DiscoveryService.getBlockedUserIds(currentUserId) : [];
    const excludeIds = [...blockedIds].filter(Boolean);

    let sql = 'SELECT * FROM posts';
    const params: any[] = [];

    if (excludeIds.length > 0) {
      const placeholders = excludeIds.map(() => '?').join(',');
      sql += ` WHERE user_id NOT IN (${placeholders})`;
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const posts = query<Post>(sql, params);

    return posts
      .map((post) => {
        const author = queryOne<User>(
          'SELECT id, display_name, avatar_url, age, location, gender, role FROM users WHERE id = ?',
          [post.user_id]
        );
        if (!author) return null;

        const reaction = currentUserId
          ? queryOne<PostReaction>(
              'SELECT reaction_type FROM post_reactions WHERE post_id = ? AND user_id = ?',
              [post.id, currentUserId]
            )
          : null;

        const isAuthor = Boolean(currentUserId && post.user_id === currentUserId);
        const hasUnlocked = Boolean(
          currentUserId &&
            queryOne('SELECT id FROM credit_transactions WHERE user_id = ? AND reference_id = ?', [
              currentUserId,
              post.id,
            ])
        );
        const isUnlocked = isAuthor || !post.is_exclusive || hasUnlocked;

        return {
          ...post,
          is_exclusive: Boolean(post.is_exclusive),
          user: author,
          user_liked: Boolean(reaction),
          is_unlocked: isUnlocked,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }

  static getPostById(postId: string, currentUserId: string): any | null {
    const post = queryOne<Post>('SELECT * FROM posts WHERE id = ?', [postId]);
    if (!post) return null;

    if (DiscoveryService.isBlocked(currentUserId, post.user_id)) {
      return null;
    }

    const author = queryOne<User>(
      'SELECT id, display_name, avatar_url, age, location, gender, role FROM users WHERE id = ?',
      [post.user_id]
    );
    if (!author) return null;

    const reaction = currentUserId
      ? queryOne<PostReaction>(
          'SELECT reaction_type FROM post_reactions WHERE post_id = ? AND user_id = ?',
          [post.id, currentUserId]
        )
      : null;

    const isAuthor = Boolean(currentUserId && post.user_id === currentUserId);
    const hasUnlocked = Boolean(
      currentUserId &&
        queryOne('SELECT id FROM credit_transactions WHERE user_id = ? AND reference_id = ?', [
          currentUserId,
          post.id,
        ])
    );
    const isUnlocked = isAuthor || !post.is_exclusive || hasUnlocked;

    return {
      ...post,
      is_exclusive: Boolean(post.is_exclusive),
      user: author,
      user_liked: Boolean(reaction),
      is_unlocked: isUnlocked,
    };
  }

  static deletePost(postId: string, userId: string, isAdminOrMod: boolean = false): void {
    const post = queryOne<Post>('SELECT * FROM posts WHERE id = ?', [postId]);
    if (!post) throw new Error('Post not found.');

    if (post.user_id !== userId && !isAdminOrMod) {
      throw new Error('Unauthorized: You can only delete your own posts.');
    }

    run('DELETE FROM posts WHERE id = ?', [postId]);
  }

  static toggleReaction(postId: string, userId: string, reactionType: string = 'LIKE'): { reaction: string | null; count: number } {
    const post = queryOne<Post>('SELECT * FROM posts WHERE id = ?', [postId]);
    if (!post) throw new Error('Post not found.');

    if (DiscoveryService.isBlocked(userId, post.user_id)) {
      throw new Error('Cannot interact with this post due to privacy/blocking settings.');
    }

    return transaction(() => {
      const existing = queryOne<PostReaction>(
        'SELECT * FROM post_reactions WHERE post_id = ? AND user_id = ?',
        [postId, userId]
      );

      let newReaction: string | null = null;
      if (existing) {
        if (existing.reaction_type === reactionType) {
          // Remove reaction
          run('DELETE FROM post_reactions WHERE post_id = ? AND user_id = ?', [postId, userId]);
          run('UPDATE posts SET likes_count = MAX(0, likes_count - 1) WHERE id = ?', [postId]);
          newReaction = null;
        } else {
          // Update reaction type
          run('UPDATE post_reactions SET reaction_type = ? WHERE post_id = ? AND user_id = ?', [
            reactionType,
            postId,
            userId,
          ]);
          newReaction = reactionType;
        }
      } else {
        // Add new reaction
        const now = new Date().toISOString();
        run('INSERT INTO post_reactions (id, post_id, user_id, reaction_type, created_at) VALUES (?, ?, ?, ?, ?)', [
          uuidv4(),
          postId,
          userId,
          reactionType,
          now,
        ]);
        run('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?', [postId]);
        newReaction = reactionType;

        // Notify post owner
        if (post.user_id !== userId) {
          const user = queryOne<User>('SELECT display_name FROM users WHERE id = ?', [userId]);
          NotificationService.create(
            post.user_id,
            'REACTION',
            'Post Reaction',
            `${user?.display_name || 'Someone'} reacted to your post.`,
            postId,
            'POST'
          );
        }
      }

      const updatedPost = queryOne<Post>('SELECT likes_count FROM posts WHERE id = ?', [postId]);
      return {
        action: newReaction ? 'ADDED' : 'REMOVED',
        reaction_type: newReaction || reactionType,
        reaction: newReaction,
        count: updatedPost ? updatedPost.likes_count : 0,
      };
    });
  }

  static addComment(postId: string, userId: string, content: string, parentId?: string | null): any {
    const post = queryOne<Post>('SELECT * FROM posts WHERE id = ?', [postId]);
    if (!post) throw new Error('Post not found.');

    if (DiscoveryService.isBlocked(userId, post.user_id)) {
      throw new Error('Cannot comment on this post due to privacy/blocking settings.');
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    return transaction(() => {
      run(
        'INSERT INTO post_comments (id, post_id, user_id, content, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, postId, userId, content, parentId || null, now]
      );
      run('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?', [postId]);

      // Notify post owner
      if (post.user_id !== userId) {
        const commenter = queryOne<User>('SELECT display_name FROM users WHERE id = ?', [userId]);
        NotificationService.create(
          post.user_id,
          'COMMENT',
          'New Comment',
          `${commenter?.display_name || 'Someone'} commented on your post: "${content.substring(0, 30)}..."`,
          postId,
          'POST'
        );
      }

      const author = queryOne<User>('SELECT id, display_name, avatar_url FROM users WHERE id = ?', [userId]);

      return {
        id,
        post_id: postId,
        user_id: userId,
        content,
        parent_id: parentId || null,
        created_at: now,
        user: author,
      };
    });
  }

  static getComments(postId: string, currentUserId: string): any[] {
    const post = queryOne<Post>('SELECT * FROM posts WHERE id = ?', [postId]);
    if (!post) return [];

    if (DiscoveryService.isBlocked(currentUserId, post.user_id)) return [];

    const blockedIds = DiscoveryService.getBlockedUserIds(currentUserId);
    let sql = 'SELECT * FROM post_comments WHERE post_id = ?';
    const params: any[] = [postId];

    if (blockedIds.length > 0) {
      const placeholders = blockedIds.map(() => '?').join(',');
      sql += ` AND user_id NOT IN (${placeholders})`;
      params.push(...blockedIds);
    }

    sql += ' ORDER BY created_at ASC';
    const comments = query<PostComment>(sql, params);

    return comments
      .map((c) => {
        const author = queryOne<User>('SELECT id, display_name, avatar_url FROM users WHERE id = ?', [c.user_id]);
        return author ? { ...c, user: author } : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }

  static unlockExclusivePost(postId: string, userId: string): void {
    const post = queryOne<Post>('SELECT * FROM posts WHERE id = ?', [postId]);
    if (!post) throw new Error('Post not found.');
    if (!post.is_exclusive || !post.credit_price) return;

    if (post.user_id === userId) return; // Author already owns it

    CreditService.spendCredits(
      userId,
      post.credit_price,
      'PHOTO_SENT',
      post.id,
      `Unlocked exclusive post content (${post.credit_price} credits)`
    );
  }
}
