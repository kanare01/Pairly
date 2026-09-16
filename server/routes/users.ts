import { Router } from 'express';
import { query, queryOne, run } from '../db.js';
import { User } from '../types.js';
import { authenticate, AuthRequest } from '../middleware/authMiddleware.js';
import { DiscoveryService } from '../services/discoveryService.js';
import { CreditService } from '../services/creditService.js';

export const usersRouter = Router();

/**
 * Get current user profile details
 */
usersRouter.get('/me', authenticate, (req: AuthRequest, res) => {
  const user = req.user!;
  const wallet = CreditService.getWallet(user.id);
  const { password_hash, verification_token, reset_token, reset_token_expires, ...safeUser } = user;

  // Fetch user posts
  const userPosts = query('SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC', [user.id]);

  res.json({
    user: safeUser,
    wallet,
    posts: userPosts,
  });
});

/**
 * Update current user profile
 */
usersRouter.patch('/me', authenticate, (req: AuthRequest, res) => {
  const user = req.user!;
  const { display_name, bio, avatar_url, location, relationship_intention, about_me, interests } = req.body;

  const now = new Date().toISOString();
  let interestsStr = user.interests;
  if (Array.isArray(interests)) {
    interestsStr = JSON.stringify(interests);
  } else if (typeof interests === 'string') {
    interestsStr = interests;
  }

  run(
    `UPDATE users 
     SET display_name = COALESCE(?, display_name),
         bio = COALESCE(?, bio),
         avatar_url = COALESCE(?, avatar_url),
         location = COALESCE(?, location),
         relationship_intention = COALESCE(?, relationship_intention),
         about_me = COALESCE(?, about_me),
         interests = COALESCE(?, interests),
         updated_at = ?
     WHERE id = ?`,
    [
      display_name ? display_name.trim() : null,
      bio !== undefined ? bio : null,
      avatar_url || null,
      location ? location.trim() : null,
      relationship_intention || null,
      about_me !== undefined ? about_me : null,
      interestsStr,
      now,
      user.id,
    ]
  );

  const updated = queryOne<User>('SELECT * FROM users WHERE id = ?', [user.id])!;
  const { password_hash, verification_token, reset_token, reset_token_expires, ...safeUser } = updated;

  res.json({ user: safeUser, message: 'Profile updated successfully.' });
});

/**
 * View another user's public profile
 */
usersRouter.get('/:id', authenticate, (req: AuthRequest, res) => {
  const currentUserId = req.user!.id;
  const targetId = req.params.id;

  if (DiscoveryService.isBlocked(currentUserId, targetId)) {
    res.status(404).json({ error: 'Profile not found or unavailable.' });
    return;
  }

  const target = queryOne<User>('SELECT * FROM users WHERE id = ?', [targetId]);
  if (!target || target.status !== 'ACTIVE') {
    res.status(404).json({ error: 'User profile not found.' });
    return;
  }

  const { password_hash, verification_token, reset_token, reset_token_expires, ...safeUser } = target;

  // Check relationship status
  const liked = !!queryOne('SELECT 1 FROM likes WHERE sender_id = ? AND target_id = ?', [currentUserId, targetId]);
  const matched = !!queryOne(
    'SELECT 1 FROM matches WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)',
    [currentUserId, targetId, targetId, currentUserId]
  );
  const following = !!queryOne('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?', [
    currentUserId,
    targetId,
  ]);

  const posts = query('SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC', [targetId]);

  res.json({
    user: safeUser,
    relationship: {
      liked,
      matched,
      following,
    },
    posts,
  });
});
