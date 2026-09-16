import { Router } from 'express';
import { optionalAuthenticate, AuthRequest } from '../middleware/authMiddleware.js';
import { DiscoveryService } from '../services/discoveryService.js';

export const peopleRouter = Router();

/**
 * Get discovery people cards with filtering & pagination
 */
peopleRouter.get('/', optionalAuthenticate, (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user?.id || '';
    const {
      gender,
      minAge,
      maxAge,
      location,
      intention,
      onlineOnly,
      search,
      page = '1',
      limit = '12',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 12));
    const offset = (pageNum - 1) * limitNum;

    const result = DiscoveryService.getPeople(currentUserId, {
      gender: gender as string,
      minAge: minAge ? parseInt(minAge as string, 10) : undefined,
      maxAge: maxAge ? parseInt(maxAge as string, 10) : undefined,
      location: location as string,
      intention: intention as string,
      onlineOnly: onlineOnly === 'true',
      search: search as string,
      limit: limitNum,
      offset,
    });

    res.json({
      people: result.users,
      total: result.total,
      page: pageNum,
      totalPages: Math.ceil(result.total / limitNum),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch discovery people.' });
  }
});
