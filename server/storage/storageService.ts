import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export interface StorageResult {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
]);

export class StorageService {
  static validate(file: Express.Multer.File): void {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new Error(`Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WEBP, GIF, MP4, WEBM.`);
    }

    const isVideo = file.mimetype.startsWith('video/');
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;

    if (file.size > maxSize) {
      throw new Error(`File exceeds maximum permitted size of ${maxSize / (1024 * 1024)}MB.`);
    }
  }

  static save(file: Express.Multer.File): StorageResult {
    this.validate(file);

    const ext = path.extname(file.originalname).toLowerCase() || (file.mimetype.startsWith('image/') ? '.jpg' : '.mp4');
    const safeHash = crypto.randomBytes(16).toString('hex');
    const filename = `${Date.now()}-${safeHash}${ext}`;
    const destinationPath = path.join(UPLOAD_DIR, filename);

    fs.writeFileSync(destinationPath, file.buffer);

    return {
      url: `/uploads/${filename}`,
      filename,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  static delete(filename: string): boolean {
    const safeFilename = path.basename(filename);
    const targetPath = path.join(UPLOAD_DIR, safeFilename);
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      return true;
    }
    return false;
  }
}
