import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db.js';
import { User, UserRole } from '../types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'pairly_secure_jwt_secret_production_key_2026';

export interface AuthRequest extends Request {
  user?: User;
}

export function generateToken(user: { id: string; email: string; role: UserRole }): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. No token provided.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: UserRole };
    const user = queryOne<User>('SELECT * FROM users WHERE id = ?', [payload.id]);

    if (!user) {
      res.status(401).json({ error: 'User not found or session invalid.' });
      return;
    }

    if (user.status === 'BANNED') {
      res.status(403).json({ error: 'Your account has been permanently banned.' });
      return;
    }

    if (user.status === 'SUSPENDED') {
      res.status(403).json({ error: 'Your account is currently suspended. Please contact support.' });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function optionalAuthenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: UserRole };
    const user = queryOne<User>('SELECT * FROM users WHERE id = ?', [payload.id]);

    if (user && user.status !== 'BANNED' && user.status !== 'SUSPENDED') {
      req.user = user;
    }
  } catch (err) {
    // Gracefully proceed as guest for optional auth
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
      return;
    }

    next();
  };
}
