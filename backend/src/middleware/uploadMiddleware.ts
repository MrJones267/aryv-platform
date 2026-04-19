/**
 * @fileoverview Multer + R2 upload middleware for profile pictures and documents
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2026-03-28
 */

import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import R2Service from '../services/r2Service';

// Extend Request to carry the uploaded file result
declare global {
  namespace Express {
    interface Request {
      uploadedFile?: {
        success: boolean;
        key: string;
        url: string;
        etag: string | undefined;
      };
    }
  }
}

const storage = multer.memoryStorage();

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedTypes: Record<string, boolean> = {
    'image/jpeg': true,
    'image/png': true,
    'image/webp': true,
    'application/pdf': true,
    'video/mp4': true,
    'video/webm': true,
  };

  if (allowedTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WebP, PDF, MP4, and WebM are allowed.'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Middleware to handle file upload to R2 after multer processes the file
export const uploadToR2 = (fileType: string) => {
  return async (req: Request & { user?: { id: string } }, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        return next();
      }

      const userId = req.user?.id || 'unknown';
      const key = R2Service.generateFileKey(userId, fileType, req.file.originalname);

      const uploadResult = await R2Service.uploadFile(req.file.buffer, key, req.file.mimetype);

      req.uploadedFile = uploadResult;
      next();
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'File upload failed',
        error: error.message,
      });
    }
  };
};
