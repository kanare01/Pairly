import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/authMiddleware.js';
import { MessagingService } from '../services/messagingService.js';
import { ChatBillingService } from '../services/chatBillingService.js';

export const messagesRouter = Router();

// LIST CONVERSATIONS
messagesRouter.get(['/', '/conversations'], authenticate, (req: AuthRequest, res) => {
  try {
    const list = MessagingService.getConversations(req.user!.id);
    res.json({ conversations: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET OR CREATE CONVERSATION WITH USER
messagesRouter.post(['/', '/conversations'], authenticate, (req: AuthRequest, res) => {
  try {
    const { partner_id } = req.body;
    if (!partner_id) {
      res.status(400).json({ error: 'Partner ID required.' });
      return;
    }
    const result = MessagingService.getOrCreateConversation(req.user!.id, partner_id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET MESSAGES IN CONVERSATION
messagesRouter.get(['/:id/messages', '/conversations/:id/messages'], authenticate, (req: AuthRequest, res) => {
  try {
    const messages = MessagingService.getMessages(req.params.id, req.user!.id);
    res.json({ messages });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// SEND MESSAGE (Text, Sticker [5 credits], or Media)
messagesRouter.post(['/:id/messages', '/conversations/:id/messages'], authenticate, (req: AuthRequest, res) => {
  try {
    const { content, media_url, media_type } = req.body;
    if (!content && !media_url) {
      res.status(400).json({ error: 'Message content or media is required.' });
      return;
    }

    const message = MessagingService.sendMessage(
      req.user!.id,
      req.params.id,
      content || '',
      media_url,
      media_type
    );

    res.status(201).json({ message });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- CHAT BILLING SESSIONS (Section 24: 2 credits per minute) ---
messagesRouter.post('/chat/session/start', authenticate, (req: AuthRequest, res) => {
  try {
    const { conversation_id, partner_id } = req.body;
    if (!conversation_id || !partner_id) {
      res.status(400).json({ error: 'conversation_id and partner_id are required.' });
      return;
    }

    const session = ChatBillingService.startOrResumeSession(req.user!.id, conversation_id, partner_id);
    res.json({ session, ratePerMinute: 2 });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

messagesRouter.post('/chat/session/heartbeat', authenticate, (req: AuthRequest, res) => {
  try {
    const { conversation_id } = req.body;
    const session = ChatBillingService.getActiveSession(req.user!.id, conversation_id);
    if (!session) {
      res.json({ active: false });
      return;
    }
    res.json({ session, active: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

messagesRouter.post('/chat/session/end', authenticate, (req: AuthRequest, res) => {
  try {
    const { session_id } = req.body;
    if (!session_id) {
      res.status(400).json({ error: 'session_id is required.' });
      return;
    }
    ChatBillingService.endSession(session_id, req.user!.id);
    res.json({ success: true, message: 'Chat session ended.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
