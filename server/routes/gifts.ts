import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/authMiddleware.js';
import { MessagingService } from '../services/messagingService.js';

export const giftsRouter = Router();

// GET GIFTS CATALOGUE
giftsRouter.get('/', (req, res) => {
  try {
    const gifts = MessagingService.getActiveGifts();
    res.json({ gifts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// SEND GIFT (Section 30)
giftsRouter.post('/send', authenticate, (req: AuthRequest, res) => {
  try {
    const { receiver_id, gift_id, message } = req.body;
    if (!receiver_id || !gift_id) {
      res.status(400).json({ error: 'receiver_id and gift_id are required.' });
      return;
    }

    MessagingService.sendGift(req.user!.id, receiver_id, gift_id, message);
    res.json({ success: true, message: 'Gift sent successfully!' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
