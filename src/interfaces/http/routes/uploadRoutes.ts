import { Router, Request } from 'express';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { Container } from '../../../config/container';
import { env } from '../../../config/env';
import { requireAuth, requireRole } from '../middleware/auth';
import { ValidationError } from '../../../domain/errors/AppError';

/** Where uploaded images live on disk. `process.cwd()` is the repo root in dev (ts-node) and
 * `/app` in the production image (see Dockerfile's WORKDIR) — either way this resolves to a
 * top-level `uploads/` directory next to `dist/`. Mounted as a docker volume in production
 * (docker-compose.yml) so images survive a redeploy. */
export const uploadsDir = path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${ALLOWED_MIME_TO_EXT[file.mimetype]}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB — plenty for a prize photo, small enough to keep the VPS disk sane.
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TO_EXT[file.mimetype]) {
      cb(new Error('Only JPEG, PNG, WEBP, or GIF images are allowed'));
      return;
    }
    cb(null, true);
  },
});

/** Builds an absolute URL for a path under this server — required because the prize
 * create/update schema validates imageUrl as a full URL (z.string().url()), not a relative path. */
function buildPublicUrl(req: Request, urlPath: string): string {
  const base = env.publicBaseUrl ?? `${req.protocol}://${req.get('host')}`;
  return `${base.replace(/\/$/, '')}${urlPath}`;
}

export function uploadRoutes(container: Container): Router {
  const router = Router();

  router.post(
    '/image',
    requireAuth(container.tokens, container.userRepo),
    requireRole('MODERATOR'),
    (req, res, next) => {
      upload.single('image')(req, res, (err: unknown) => {
        if (err) {
          const message = err instanceof Error ? err.message : 'Invalid image upload';
          next(new ValidationError(message.includes('File too large') ? 'Image must be 5MB or smaller' : message));
          return;
        }
        next();
      });
    },
    (req, res) => {
      if (!req.file) {
        throw new ValidationError('No image file provided (multipart field name: image)');
      }
      res.status(201).json({ url: buildPublicUrl(req, `/uploads/${req.file.filename}`) });
    },
  );

  return router;
}
