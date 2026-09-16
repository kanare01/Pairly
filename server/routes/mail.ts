import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/authMiddleware.js';
import { MessagingService } from '../services/messagingService.js';
import { MailBillingService } from '../services/mailBillingService.js';

export const mailRouter = Router();

// LIST MAIL THREADS
mailRouter.get(['/', '/threads'], authenticate, (req: AuthRequest, res) => {
  try {
    const { folder = 'INBOX' } = req.query;
    const threads = MessagingService.getMailThreads(req.user!.id, folder as any);
    res.json({ threads });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET MAIL THREAD DETAILS
mailRouter.get(['/:id', '/threads/:id'], authenticate, (req: AuthRequest, res) => {
  try {
    const details = MessagingService.getMailThreadDetails(req.params.id, req.user!.id);
    res.json(details);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET SEND COST PREVIEW
mailRouter.get(['/:id/cost-preview', '/threads/:id/cost-preview'], authenticate, (req: AuthRequest, res) => {
  try {
    const sendCost = MailBillingService.getSendLetterCost(req.params.id);
    res.json({
      sendCost,
      rules: {
        firstLetterCost: 10,
        followingLetterCost: 30,
        firstOpenedCost: 0,
        followingOpenedCost: 10,
        photoSendingCost: 0,
        videoOpeningCost: 50,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// SEND MAIL
mailRouter.post('/send', authenticate, (req: AuthRequest, res) => {
  try {
    const { recipient_id, subject, content, media_url, media_type } = req.body;
    if (!recipient_id || !subject || !content) {
      res.status(400).json({ error: 'Recipient, subject, and letter content are required.' });
      return;
    }

    const result = MessagingService.sendMail(
      req.user!.id,
      recipient_id,
      subject.trim(),
      content.trim(),
      media_url,
      media_type
    );

    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// OPEN RECEIVED LETTER (First letter in thread free, following letters 10 credits)
mailRouter.post('/messages/:id/open', authenticate, (req: AuthRequest, res) => {
  try {
    const updatedMessage = MessagingService.openMail(req.params.id, req.user!.id);
    res.json({ message: updatedMessage });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// UNLOCK MAIL VIDEO (50 credits)
mailRouter.post('/messages/:id/unlock-video', authenticate, (req: AuthRequest, res) => {
  try {
    const message = MessagingService.unlockMailVideo(req.params.id, req.user!.id);
    res.json({ success: true, message });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
