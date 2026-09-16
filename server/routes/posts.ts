import { Router } from 'express';
import { authenticate, optionalAuthenticate, AuthRequest } from '../middleware/authMiddleware.js';
import { SocialService } from '../services/socialService.js';

export const postsRouter = Router();

// GET FEED
postsRouter.get(['/', '/feed'], optionalAuthenticate, (req: AuthRequest, res) => {
  try {
    const { limit = '20', offset = '0' } = req.query;
    const feed = SocialService.getFeed(
      req.user?.id || '',
      parseInt(limit as string, 10),
      parseInt(offset as string, 10)
    );
    res.json({ feed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE POST
postsRouter.post('/', authenticate, (req: AuthRequest, res) => {
  try {
    const { content, media_url, media_type, is_exclusive, credit_price } = req.body;
    if (!content && !media_url) {
      res.status(400).json({ error: 'Post must contain text content or media.' });
      return;
    }

    const post = SocialService.createPost(
      req.user!.id,
      content || '',
      media_url,
      media_type,
      !!is_exclusive,
      credit_price ? Number(credit_price) : 0
    );

    res.status(201).json({ post });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET POST BY ID
postsRouter.get('/:id', authenticate, (req: AuthRequest, res) => {
  try {
    const item = SocialService.getPostById(req.params.id, req.user!.id);
    if (!item) {
      res.status(404).json({ error: 'Post not found or unavailable.' });
      return;
    }
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE POST
postsRouter.delete('/:id', authenticate, (req: AuthRequest, res) => {
  try {
    const isStaff = req.user!.role === 'ADMIN' || req.user!.role === 'MODERATOR';
    SocialService.deletePost(req.params.id, req.user!.id, isStaff);
    res.json({ success: true, message: 'Post deleted successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// TOGGLE REACTION
postsRouter.post('/:id/reactions', authenticate, (req: AuthRequest, res) => {
  try {
    const { reaction_type = 'LIKE' } = req.body;
    const result = SocialService.toggleReaction(req.params.id, req.user!.id, reaction_type);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET COMMENTS
postsRouter.get('/:id/comments', authenticate, (req: AuthRequest, res) => {
  try {
    const comments = SocialService.getComments(req.params.id, req.user!.id);
    res.json({ comments });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ADD COMMENT
postsRouter.post('/:id/comments', authenticate, (req: AuthRequest, res) => {
  try {
    const { content, parent_id } = req.body;
    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Comment content cannot be empty.' });
      return;
    }

    const comment = SocialService.addComment(req.params.id, req.user!.id, content.trim(), parent_id);
    res.status(201).json({ comment });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// UNLOCK EXCLUSIVE POST
postsRouter.post('/:id/unlock', authenticate, (req: AuthRequest, res) => {
  try {
    SocialService.unlockExclusivePost(req.params.id, req.user!.id);
    res.json({ success: true, message: 'Exclusive post unlocked.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
