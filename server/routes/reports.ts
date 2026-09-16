import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/authMiddleware.js';
import { ModerationService } from '../services/moderationService.js';

export const reportsRouter = Router();

reportsRouter.post('/', authenticate, (req: AuthRequest, res) => {
  try {
    const { target_user_id, target_type = 'PROFILE', target_id, reason, details } = req.body;
    if (!target_user_id || !reason) {
      res.status(400).json({ error: 'target_user_id and reason are required.' });
      return;
    }

    const report = ModerationService.createReport(
      req.user!.id,
      target_user_id,
      target_type,
      target_id,
      reason,
      details
    );

    res.status(201).json({ report, message: 'Report submitted for moderation review.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
