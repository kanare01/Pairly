import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, run, transaction } from '../db.js';
import { User } from '../types.js';
import { generateToken, authenticate, AuthRequest } from '../middleware/authMiddleware.js';
import { isAuthorizedAdminEmail } from '../utils/adminAuth.js';
import { CreditService } from '../services/creditService.js';
import { NotificationService } from '../services/notificationService.js';

export const authRouter = Router();

function calculateAge(dobString: string): number {
  const birthDate = new Date(dobString);
  if (isNaN(birthDate.getTime())) {
    throw new Error('Invalid date of birth format. Use YYYY-MM-DD.');
  }
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Registration (Section 14 & 48: 18+ strict enforcement on backend)
 */
authRouter.post('/register', async (req, res) => {
  try {
    const { email, password, display_name, date_of_birth, gender, location } = req.body;

    if (!email || !password || !display_name || !date_of_birth || !gender || !location) {
      res.status(400).json({ error: 'All registration fields are required.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    // Strict 18+ enforcement on backend
    const age = calculateAge(date_of_birth);
    if (age < 18) {
      res.status(400).json({ error: 'Pairly is strictly 18+. You must be at least 18 years old to join.' });
      return;
    }

    // Check unique email
    const existing = queryOne<User>('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing) {
      res.status(400).json({ error: 'An account with this email address already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const now = new Date().toISOString();
    const verificationToken = uuidv4();

    // Default avatar
    const defaultAvatar = gender === 'FEMALE' 
      ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'
      : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80';

    const initialRole = isAuthorizedAdminEmail(email) ? 'ADMIN' : 'MEMBER';

    transaction(() => {
      run(
        `INSERT INTO users 
        (id, email, password_hash, display_name, date_of_birth, age, gender, location, role, status, email_verified, verification_token, avatar_url, is_online, last_active_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 0, ?, ?, 1, ?, ?, ?)`,
        [
          userId,
          email.toLowerCase().trim(),
          passwordHash,
          display_name.trim(),
          date_of_birth,
          age,
          gender,
          location.trim(),
          initialRole,
          verificationToken,
          defaultAvatar,
          now,
          now,
          now,
        ]
      );

      // Section 31: 20 Complimentary welcome credits awarded upon registration!
      run(
        'INSERT INTO credit_wallets (user_id, balance, complimentary_balance, purchased_balance, updated_at) VALUES (?, 20, 20, 0, ?)',
        [userId, now]
      );

      run(
        `INSERT INTO credit_transactions 
        (id, user_id, type, amount, balance_before, balance_after, description, created_at)
        VALUES (?, ?, 'WELCOME_BONUS', 20, 0, 20, 'Welcome gift: 20 complimentary credits', ?)`,
        [uuidv4(), userId, now]
      );

      // Welcome Notification
      NotificationService.create(
        userId,
        'SYSTEM_NOTIFICATION',
        'Welcome to Pairly!',
        'Welcome to Pairly! We have granted you 20 complimentary credits to explore, match, and chat.'
      );
    });

    const user = queryOne<User>('SELECT * FROM users WHERE id = ?', [userId])!;
    const token = generateToken(user);
    const wallet = CreditService.getWallet(userId);

    const { password_hash, verification_token, reset_token, reset_token_expires, ...safeUser } = user;

    res.status(201).json({
      user: safeUser,
      token,
      wallet,
      message: 'Account successfully registered! 20 complimentary credits have been added to your wallet.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Registration failed.' });
  }
});

/**
 * Login
 */
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = queryOne<User>('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Ensure authorized admin email holds ADMIN role
    if (isAuthorizedAdminEmail(user.email) && user.role !== 'ADMIN') {
      run("UPDATE users SET role = 'ADMIN' WHERE id = ?", [user.id]);
      user.role = 'ADMIN';
    }

    if (user.status === 'BANNED') {
      res.status(403).json({ error: 'Your account has been permanently banned from Pairly.' });
      return;
    }

    if (user.status === 'SUSPENDED') {
      res.status(403).json({ error: 'Your account is suspended. Please contact support.' });
      return;
    }

    // Update presence
    const now = new Date().toISOString();
    run('UPDATE users SET is_online = 1, last_active_at = ? WHERE id = ?', [now, user.id]);

    const token = generateToken(user);
    const wallet = CreditService.getWallet(user.id);
    const { password_hash, verification_token, reset_token, reset_token_expires, ...safeUser } = user;

    res.json({
      user: safeUser,
      token,
      wallet,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login failed.' });
  }
});

/**
 * Current Authenticated User & Wallet
 */
authRouter.get('/me', authenticate, (req: AuthRequest, res) => {
  const user = req.user!;
  if (isAuthorizedAdminEmail(user.email) && user.role !== 'ADMIN') {
    run("UPDATE users SET role = 'ADMIN' WHERE id = ?", [user.id]);
    user.role = 'ADMIN';
  }
  const wallet = CreditService.getWallet(user.id);
  const { password_hash, verification_token, reset_token, reset_token_expires, ...safeUser } = user;

  res.json({
    user: safeUser,
    wallet,
  });
});

/**
 * Email verification (Section 14)
 */
authRouter.post('/verify-email', authenticate, (req: AuthRequest, res) => {
  const user = req.user!;
  run('UPDATE users SET email_verified = 1 WHERE id = ?', [user.id]);
  res.json({ success: true, message: 'Email verified successfully.' });
});

/**
 * Password reset request
 */
authRouter.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: 'Email is required.' });
    return;
  }

  const user = queryOne<User>('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
  if (!user) {
    // Return success to avoid email enumeration
    res.json({ message: 'If an account exists with that email, reset instructions have been sent.' });
    return;
  }

  const resetToken = uuidv4();
  const expires = new Date(Date.now() + 3600000).toISOString(); // 1 hour

  run('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?', [resetToken, expires, user.id]);

  res.json({
    message: 'Reset token generated successfully.',
    resetToken, // Returned in dev/preview for convenience
  });
});

/**
 * Reset password with token
 */
authRouter.post('/reset-password', async (req, res) => {
  const { reset_token, new_password } = req.body;
  if (!reset_token || !new_password || new_password.length < 6) {
    res.status(400).json({ error: 'Valid reset token and new password (min 6 chars) required.' });
    return;
  }

  const user = queryOne<User>('SELECT * FROM users WHERE reset_token = ?', [reset_token]);
  if (!user || !user.reset_token_expires || new Date(user.reset_token_expires).getTime() < Date.now()) {
    res.status(400).json({ error: 'Invalid or expired password reset token.' });
    return;
  }

  const passwordHash = await bcrypt.hash(new_password, 10);
  run('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = ? WHERE id = ?', [
    passwordHash,
    null,
    user.id,
  ]);

  res.json({ success: true, message: 'Password has been reset successfully. You can now login.' });
});

/**
 * Logout
 */
authRouter.post('/logout', authenticate, (req: AuthRequest, res) => {
  const user = req.user!;
  run('UPDATE users SET is_online = 0, last_active_at = ? WHERE id = ?', [new Date().toISOString(), user.id]);
  res.json({ success: true, message: 'Logged out successfully.' });
});
