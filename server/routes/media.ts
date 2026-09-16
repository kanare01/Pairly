import { Router } from 'express';
import multer from 'multer';
import { authenticate, AuthRequest } from '../middleware/authMiddleware.js';
import { StorageService } from '../storage/storageService.js';

export const mediaRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

mediaRouter.post('/upload', authenticate, upload.single('file'), (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded.' });
      return;
    }

    const result = StorageService.save(req.file);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
