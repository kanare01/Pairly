import { Router } from 'express';
import { query } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/authMiddleware.js';
import { CreditService } from '../services/creditService.js';
import { CreditPackage, CreditTransaction } from '../types.js';

export const creditsRouter = Router();

// GET USER WALLET
creditsRouter.get('/wallet', authenticate, (req: AuthRequest, res) => {
  try {
    const wallet = CreditService.getWallet(req.user!.id);
    res.json({ wallet });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET CREDIT PACKAGES (Section 32)
creditsRouter.get('/packages', (req, res) => {
  try {
    const packages = query<CreditPackage>(
      'SELECT * FROM credit_packages WHERE is_active = 1 ORDER BY credits ASC'
    );
    res.json({ packages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET TRANSACTION HISTORY (Section 34: Immutable records)
creditsRouter.get('/transactions', authenticate, (req: AuthRequest, res) => {
  try {
    const { limit = '50' } = req.query;
    const transactions = query<CreditTransaction>(
      'SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [req.user!.id, parseInt(limit as string, 10)]
    );
    res.json({ transactions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
