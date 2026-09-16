import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/authMiddleware.js';
import { NotificationService } from '../services/notificationService.js';

export const notificationsRouter = Router();

notificationsRouter.get('/', authenticate, (req: AuthRequest, res) => {
  try {
    const list = NotificationService.getUserNotifications(req.user!.id);
    const unreadCount = NotificationService.getUnreadCount(req.user!.id);
    res.json({ notifications: list, unreadCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

notificationsRouter.post('/read-all', authenticate, (req: AuthRequest, res) => {
  try {
    NotificationService.markAllAsRead(req.user!.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

notificationsRouter.post('/:id/read', authenticate, (req: AuthRequest, res) => {
  try {
    NotificationService.markAsRead(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
