/**
 * @fileoverview Multer file upload middleware: received on local disk, then
 *               kept in Cloudflare R2 when it is configured
 * @author Oabona-Majoko
 * @created 2026-03-27
 * @lastModified 2026-11-06
 */

import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { fileStorageService, isR2Configured, FileCategory } from '../services/FileStorageService';
import { logError } from '../utils/logger';

/**
 * Where uploaded files live.
 *
 * This defaulted to './uploads' inside the container, which on Railway is
 * ephemeral: every deploy replaced the filesystem and destroyed every file in
 * it, while the database row still said the driver's licence was on record and
 * approved. Nothing surfaced the loss.
 *
 * A mounted volume survives deploys, and Railway exposes its mount point as
 * RAILWAY_VOLUME_MOUNT_PATH, so honouring that is the fix. UPLOADS_DIR still
 * wins when it is set explicitly, for local work and for other hosts.
 */
const VOLUME_MOUNT_PATH = process.env['RAILWAY_VOLUME_MOUNT_PATH'];

export const uploadsAreEphemeral = !process.env['UPLOADS_DIR'] && !VOLUME_MOUNT_PATH && !isR2Configured();

export const UPLOADS_DIR = process.env['UPLOADS_DIR']
  || (VOLUME_MOUNT_PATH ? path.join(VOLUME_MOUNT_PATH, 'uploads') : './uploads');

if (uploadsAreEphemeral && process.env['NODE_ENV'] === 'production') {
  // Loud, because the failure is silent otherwise: uploads appear to work and
  // the files are gone by the next deploy.
  // eslint-disable-next-line no-console
  console.error(
    '[uploads] No persistent storage configured. Files written to ./uploads will be '
    + 'DESTROYED on the next deploy, including driver verification documents. '
    + 'Set the R2_* variables, mount a Railway volume, or set UPLOADS_DIR to a persistent path.',
  );
}
const AVATAR_DIR = path.join(UPLOADS_DIR, 'avatars');
const DOCS_DIR = path.join(UPLOADS_DIR, 'documents');
const VEHICLES_DIR = path.join(UPLOADS_DIR, 'vehicles');

[UPLOADS_DIR, AVATAR_DIR, DOCS_DIR, VEHICLES_DIR].forEach((dir) => {
  fs.mkdirSync(dir, { recursive: true });
});

const sanitizeId = (id: string): string => id.replace(/[^a-zA-Z0-9-]/g, '');

/**
 * The part of a stored filename after the owner's id: a timestamp and 16 hex
 * characters of randomness. These used to be just `${userId}-${Date.now()}`.
 * User ids are public, so a millisecond timestamp was the only unknown, and
 * avatars are served without sign-in: a replaced face photo stayed reachable
 * at a guessable name. The `${userId}-` prefix is kept because the /uploads
 * ownership check in index.ts relies on it.
 */
const unguessable = (): string => `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

// Storage for avatars
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (req: any, _file, cb) => {
    const userId = sanitizeId(req.user?.id || 'unknown');
    const ext = '.jpg';
    cb(null, `${userId}-${unguessable()}${ext}`);
  },
});

// Storage for documents (licenses, verification)
const documentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DOCS_DIR),
  filename: (req: any, file, cb) => {
    const userId = sanitizeId(req.user?.id || 'unknown');
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = allowedExts.includes(ext) ? ext : '.bin';
    cb(null, `${userId}-doc-${unguessable()}${safeExt}`);
  },
});

// Image file filter
const imageFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new Error('Only image files (jpeg, jpg, png, webp) are allowed'));
};

// Document file filter (images + PDF)
const documentFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|webp|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = /image\/(jpeg|jpg|png|webp)|application\/pdf/.test(file.mimetype);
  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new Error('Only image files and PDFs are allowed'));
};

// Storage for vehicle photos
const vehiclePhotoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, VEHICLES_DIR),
  filename: (req: any, _file, cb) => {
    const userId = sanitizeId(req.user?.id || 'unknown');
    const vehicleId = sanitizeId(req.params?.id || 'vehicle');
    cb(null, `${userId}-${vehicleId}-${unguessable()}.jpg`);
  },
});

/**
 * Run a multer middleware, then copy what it wrote into R2.
 *
 * Multer writes each file to UPLOADS_DIR/<category>/; that copy is only a
 * staging area once R2 is configured, and is deleted after the response.
 * The stored URL stays /uploads/<category>/<filename>, which the /uploads
 * route serves from disk or R2.
 *
 * If R2 refuses the file, the upload fails with 503 rather than reporting
 * success for a file the next deploy will destroy.
 */
export const keptInStorage = (receive: RequestHandler): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    receive(req, res, (receiveError?: unknown) => {
      if (receiveError) {
        next(receiveError);
        return;
      }
      const received: Express.Multer.File[] = [
        ...((req as any).file ? [(req as any).file as Express.Multer.File] : []),
        ...(Array.isArray((req as any).files)
          ? (req as any).files as Express.Multer.File[]
          : Object.values(((req as any).files ?? {}) as Record<string, Express.Multer.File[]>).flat()),
      ].filter((file) => file?.path);

      Promise.all(received.map((file) => fileStorageService.persistUpload(
        path.basename(file.destination) as FileCategory, file.filename, file.path, file.mimetype,
      )))
        .then((kept) => {
          if (kept.some(Boolean)) {
            // R2 has them now; the staged copies go once the request is done.
            res.on('finish', () => {
              received.forEach((file) => { fs.promises.unlink(file.path).catch(() => undefined); });
            });
          }
          next();
        })
        .catch((error: unknown) => {
          logError('Could not keep an upload in R2', error as Error, { files: received.map((f) => f.filename) });
          received.forEach((file) => { fs.promises.unlink(file.path).catch(() => undefined); });
          res.status(503).json({
            success: false,
            error: 'The file could not be saved. Please try again.',
            code: 'UPLOAD_STORAGE_FAILED',
            timestamp: new Date().toISOString(),
          });
        });
    });
  };

// Avatar upload middleware (single file, 5MB limit). The app sends the
// photo as `profilePicture`; only `avatar` was accepted, so multer refused
// every profile photo from the app as an unexpected field (400). Either
// name is taken, and the file lands on req.file as before.
const receiveAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFilter,
}).fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'profilePicture', maxCount: 1 },
]);
export const uploadAvatar = keptInStorage((req: Request, res: Response, next: NextFunction) => {
  receiveAvatar(req, res, (error?: unknown) => {
    if (!error) {
      const files = (req as any).files as Record<string, Express.Multer.File[]> | undefined;
      (req as any).file = files?.['avatar']?.[0] ?? files?.['profilePicture']?.[0];
      delete (req as any).files;
    }
    next(error);
  });
});

// Document upload middleware (single file, 10MB limit)
export const uploadDocument = keptInStorage(multer({
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: documentFilter,
}).single('document'));

// Vehicle photo upload middleware (single file, 5MB limit)
export const uploadVehiclePhoto = keptInStorage(multer({
  storage: vehiclePhotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
}).single('photo'));

// Vehicle document upload middleware (single file, 10MB limit)
export const uploadVehicleDocument = keptInStorage(multer({
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: documentFilter,
}).single('document'));

// Helper to get the public URL for an uploaded file
export const getFileUrl = (filename: string, type: 'avatars' | 'documents'): string => {
  const baseUrl = process.env['API_BASE_URL'] || `http://localhost:${process.env['PORT'] || 3001}`;
  return `${baseUrl}/uploads/${type}/${filename}`;
};

// Multer error handler middleware
export const handleMulterError = (err: any, _req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size exceeds the allowed limit',
        code: 'FILE_TOO_LARGE',
        timestamp: new Date().toISOString(),
      });
    }
    return res.status(400).json({
      success: false,
      error: err.message,
      code: 'UPLOAD_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      error: err.message || 'File upload failed',
      code: 'UPLOAD_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
  next();
};
