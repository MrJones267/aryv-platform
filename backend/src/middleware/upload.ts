/**
 * @fileoverview Multer file upload middleware - local disk with optional S3 upload
 * @author Oabona-Majoko
 * @created 2026-03-27
 * @lastModified 2026-03-27
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Ensure uploads directory exists
const UPLOADS_DIR = process.env['UPLOADS_DIR'] || './uploads';
const AVATAR_DIR = path.join(UPLOADS_DIR, 'avatars');
const DOCS_DIR = path.join(UPLOADS_DIR, 'documents');
const VEHICLES_DIR = path.join(UPLOADS_DIR, 'vehicles');

[UPLOADS_DIR, AVATAR_DIR, DOCS_DIR, VEHICLES_DIR].forEach((dir) => {
  fs.mkdirSync(dir, { recursive: true });
});

const sanitizeId = (id: string): string => id.replace(/[^a-zA-Z0-9-]/g, '');

// Storage for avatars
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (req: any, _file, cb) => {
    const userId = sanitizeId(req.user?.id || 'unknown');
    const ext = '.jpg';
    cb(null, `${userId}-${Date.now()}${ext}`);
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
    cb(null, `${userId}-doc-${Date.now()}${safeExt}`);
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
    cb(null, `${userId}-${vehicleId}-${Date.now()}.jpg`);
  },
});

// Avatar upload middleware (single file, 5MB limit)
export const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFilter,
}).single('avatar');

// Document upload middleware (single file, 10MB limit)
export const uploadDocument = multer({
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: documentFilter,
}).single('document');

// Vehicle photo upload middleware (single file, 5MB limit)
export const uploadVehiclePhoto = multer({
  storage: vehiclePhotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
}).single('photo');

// Vehicle document upload middleware (single file, 10MB limit)
export const uploadVehicleDocument = multer({
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: documentFilter,
}).single('document');

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
