import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/authMiddleware.js';
import { DiscoveryService } from '../services/discoveryService.js';

export const interactionsRouter = Router();

// LIKES
interactionsRouter.post('/likes', authenticate, (req: AuthRequest, res) => {
  try {
    const { target_id } = req.body;
    if (!target_id) {
      res.status(400).json({ error: 'Target user ID is required.' });
      return;
    }

    const result = DiscoveryService.likeUser(req.user!.id, target_id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

interactionsRouter.delete('/likes/:targetId', authenticate, (req: AuthRequest, res) => {
  try {
    DiscoveryService.unlikeUser(req.user!.id, req.params.targetId);
    res.json({ success: true, message: 'Unliked successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// MATCHES
interactionsRouter.get('/matches', authenticate, (req: AuthRequest, res) => {
  try {
    const matches = DiscoveryService.getMatches(req.user!.id);
    res.json({ matches });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// FOLLOWS
interactionsRouter.post('/follows', authenticate, (req: AuthRequest, res) => {
  try {
    const { following_id } = req.body;
    if (!following_id) {
      res.status(400).json({ error: 'Following ID required.' });
      return;
    }
    DiscoveryService.followUser(req.user!.id, following_id);
    res.json({ success: true, message: 'Followed user successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

interactionsRouter.delete('/follows/:followingId', authenticate, (req: AuthRequest, res) => {
  try {
    DiscoveryService.unfollowUser(req.user!.id, req.params.followingId);
    res.json({ success: true, message: 'Unfollowed successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// BLOCKS (Global enforcement)
interactionsRouter.get('/blocks', authenticate, (req: AuthRequest, res) => {
  try {
    const blocks = DiscoveryService.getBlockedList(req.user!.id);
    res.json({ blocks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

interactionsRouter.post('/blocks', authenticate, (req: AuthRequest, res) => {
  try {
    const { blocked_id, reason } = req.body;
    if (!blocked_id) {
      res.status(400).json({ error: 'Blocked user ID is required.' });
      return;
    }
    DiscoveryService.blockUser(req.user!.id, blocked_id, reason);
    res.json({ success: true, message: 'User blocked globally.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

interactionsRouter.delete('/blocks/:blockedId', authenticate, (req: AuthRequest, res) => {
  try {
    DiscoveryService.unblockUser(req.user!.id, req.params.blockedId);
    res.json({ success: true, message: 'User unblocked successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
