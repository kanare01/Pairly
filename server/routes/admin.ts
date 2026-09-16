import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, run } from '../db.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/authMiddleware.js';
import { isAuthorizedAdminEmail, getAuthorizedAdminEmail } from '../utils/adminAuth.js';
import { ModerationService } from '../services/moderationService.js';
import { CreditService } from '../services/creditService.js';
import { User, CreditPackage, Gift } from '../types.js';

export const adminRouter = Router();

// Strictly restrict Admin Portal endpoints to authorized administrator email
adminRouter.use(authenticate);
adminRouter.use((req: AuthRequest, res, next) => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  if (!isAuthorizedAdminEmail(req.user.email)) {
    res.status(403).json({
      error: `Access Denied: The admin portal is strictly restricted to authorized administrator email (${getAuthorizedAdminEmail()}).`,
    });
    return;
  }

  next();
});

// DASHBOARD METRICS
adminRouter.get('/metrics', (req: AuthRequest, res) => {
  try {
    const metrics = ModerationService.getDashboardMetrics();
    res.json({ metrics });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// LIST & SEARCH USERS
adminRouter.get('/users', (req: AuthRequest, res) => {
  try {
    const { search = '', status = '', limit = '50', offset = '0' } = req.query;

    let sql = 'SELECT id, email, display_name, age, gender, location, role, status, is_online, last_active_at, created_at FROM users WHERE 1=1';
    const params: any[] = [];

    if (search) {
      sql += ' AND (email LIKE ? OR display_name LIKE ? OR location LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string, 10), parseInt(offset as string, 10));

    const users = query<Partial<User>>(sql, params);

    // Attach wallet balance
    const enriched = users.map((u) => {
      const wallet = CreditService.getWallet(u.id!);
      return {
        ...u,
        walletBalance: wallet.balance,
      };
    });

    res.json({ users: enriched });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// MODERATION ACTION (Warn, Suspend, Ban, Restore)
adminRouter.post('/users/:id/action', (req: AuthRequest, res) => {
  try {
    const { action_type, reason } = req.body;
    if (!action_type || !reason) {
      res.status(400).json({ error: 'action_type (WARN|SUSPEND|BAN|RESTORE) and reason are required.' });
      return;
    }

    ModerationService.performModerationAction(req.user!.id, req.params.id, action_type, reason);
    res.json({ success: true, message: `Action ${action_type} executed successfully.` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ADMINISTRATIVE CREDIT ADJUSTMENT (Section 91: Requires admin identity, amount, reason, audit log)
adminRouter.post('/users/:id/adjust-credits', requireRole('ADMIN'), (req: AuthRequest, res) => {
  try {
    const { amount, reason } = req.body;
    if (amount === undefined || !reason) {
      res.status(400).json({ error: 'amount and reason are required.' });
      return;
    }

    const numAmount = parseInt(amount, 10);
    const targetUserId = req.params.id;

    if (numAmount > 0) {
      CreditService.addCredits(
        targetUserId,
        numAmount,
        'ADMIN_ADJUSTMENT',
        false,
        req.user!.id,
        `Admin adjustment by ${req.user!.email}: ${reason}`
      );
    } else if (numAmount < 0) {
      CreditService.spendCredits(
        targetUserId,
        Math.abs(numAmount),
        'ADMIN_ADJUSTMENT',
        req.user!.id,
        `Admin adjustment deduction by ${req.user!.email}: ${reason}`
      );
    }

    ModerationService.logAudit(
      req.user!.id,
      'ADMIN_CREDIT_ADJUSTMENT',
      'USER',
      targetUserId,
      JSON.stringify({ amount: numAmount, reason })
    );

    const updatedWallet = CreditService.getWallet(targetUserId);
    res.json({ success: true, wallet: updatedWallet, message: 'Credits adjusted successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// LIST REPORTS
adminRouter.get('/reports', (req: AuthRequest, res) => {
  try {
    const { status } = req.query;
    const list = ModerationService.getReports(status as any);
    res.json({ reports: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// RESOLVE REPORT
adminRouter.post('/reports/:id/resolve', (req: AuthRequest, res) => {
  try {
    const { resolution_notes, action_taken = 'RESOLVED' } = req.body;
    ModerationService.resolveReport(req.params.id, req.user!.id, resolution_notes || 'Resolved', action_taken);
    res.json({ success: true, message: 'Report resolved.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// AUDIT LOGS
adminRouter.get('/audit-logs', requireRole('ADMIN'), (req: AuthRequest, res) => {
  try {
    const logs = ModerationService.getAuditLogs();
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// MANAGE CREDIT PACKAGES (Section 43)
adminRouter.post('/packages', requireRole('ADMIN'), (req: AuthRequest, res) => {
  try {
    const { credits, price_usd } = req.body;
    if (!credits || !price_usd) {
      res.status(400).json({ error: 'credits and price_usd required.' });
      return;
    }
    const id = uuidv4();
    run(
      'INSERT INTO credit_packages (id, credits, price_usd, is_active, created_at) VALUES (?, ?, ?, 1, ?)',
      [id, Number(credits), Number(price_usd), new Date().toISOString()]
    );
    ModerationService.logAudit(
      req.user!.id,
      'CREATE_PACKAGE',
      'PACKAGE',
      id,
      JSON.stringify({ credits, price_usd })
    );
    res.status(201).json({ success: true, message: 'Package created.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.patch('/packages/:id/toggle', requireRole('ADMIN'), (req: AuthRequest, res) => {
  try {
    const pkg = queryOne<CreditPackage>('SELECT * FROM credit_packages WHERE id = ?', [req.params.id]);
    if (!pkg) {
      res.status(404).json({ error: 'Package not found.' });
      return;
    }
    const newState = pkg.is_active ? 0 : 1;
    run('UPDATE credit_packages SET is_active = ? WHERE id = ?', [newState, pkg.id]);
    res.json({ success: true, is_active: newState === 1 });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// MANAGE GIFTS (Section 44)
adminRouter.post('/gifts', requireRole('ADMIN'), (req: AuthRequest, res) => {
  try {
    const { name, icon_name, credit_price } = req.body;
    if (!name || !icon_name || !credit_price) {
      res.status(400).json({ error: 'name, icon_name, and credit_price required.' });
      return;
    }
    const id = uuidv4();
    run(
      'INSERT INTO gifts (id, name, icon_name, credit_price, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
      [id, name, icon_name, Number(credit_price), new Date().toISOString()]
    );
    res.status(201).json({ success: true, message: 'Gift created.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
