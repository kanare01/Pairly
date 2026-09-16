import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/authMiddleware.js';
import { PaymentService, GatewayProvider } from '../services/paymentService.js';
import { query } from '../db.js';
import { PaymentTransaction } from '../types.js';

export const paymentsRouter = Router();

// CREATE CHECKOUT SESSION
paymentsRouter.post('/checkout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { package_id } = req.body;
    if (!package_id) {
      res.status(400).json({ error: 'package_id is required.' });
      return;
    }

    const session = await PaymentService.createCheckout(req.user!.id, package_id);
    res.json(session);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// VERIFIED PAYMENT WEBHOOK (Section 36 & 37)
paymentsRouter.post('/webhook', (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-pairly-signature'] as string || req.headers['stripe-signature'] as string;
    const rawBody = JSON.stringify(req.body);

    const result = PaymentService.processWebhook(rawBody, signature, req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Webhook error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// TEST / SANDBOX INSTANT PAYMENT EXECUTION
// This runs the full server-side verification: generates HMAC signature, triggers webhook verification,
// allocates credits idempotently, updates wallet, and records audit trail!
paymentsRouter.post('/simulate-checkout-success', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { package_id, idempotency_key, session_id, amount_usd, credits } = req.body;
    if (!package_id || !idempotency_key) {
      res.status(400).json({ error: 'package_id and idempotency_key are required.' });
      return;
    }

    const provider = PaymentService.getProvider() as GatewayProvider;

    const payload = {
      externalTransactionId: session_id || `sim_${Date.now()}`,
      idempotencyKey: idempotency_key,
      packageId: package_id,
      userId: req.user!.id,
      amountUsd: Number(amount_usd),
      credits: Number(credits),
      status: 'SUCCEEDED',
    };

    const rawBody = JSON.stringify(payload);
    const signature = provider.generateSignature(rawBody);

    const result = PaymentService.processWebhook(rawBody, signature, payload);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PAYMENT HISTORY
paymentsRouter.get('/history', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const history = query<PaymentTransaction>(
      'SELECT * FROM payment_transactions WHERE user_id = ? ORDER BY created_at DESC',
      [req.user!.id]
    );
    res.json({ history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
