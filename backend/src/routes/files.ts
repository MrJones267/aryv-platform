/**
 * @fileoverview File upload routes for profile pictures, driver documents, and presigned URLs
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-03-28
 */

import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import R2Service from '../services/r2Service';
import { upload as r2Upload, uploadToR2 } from '../middleware/uploadMiddleware';

const ALLOWED_FILE_TYPES = ['profile', 'driver-document', 'vehicle', 'package'];
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  'application/pdf',
  'video/mp4', 'video/quicktime',
];

const router = express.Router();

// Upload profile picture
router.post(
  '/profile-picture',
  authenticateToken,
  r2Upload.single('profilePicture'),
  uploadToR2('profile'),
  async (req: AuthenticatedRequest & { uploadedFile?: Record<string, any> }, res: Response) => {
    try {
      if (!req.uploadedFile) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Profile picture uploaded successfully',
        file: req.uploadedFile,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Upload failed',
        error: error.message,
      });
    }
  },
);

// Upload driver documents
router.post(
  '/driver-documents',
  authenticateToken,
  r2Upload.array('documents', 5),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;

      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          message: 'No files uploaded',
        });
        return;
      }

      const uploadPromises = files.map((file: Express.Multer.File) => {
        const key = R2Service.generateFileKey(req.user!.id, 'driver-document', file.originalname);
        return R2Service.uploadFile(file.buffer, key, file.mimetype);
      });

      const uploadResults = await Promise.all(uploadPromises);

      res.json({
        success: true,
        message: 'Documents uploaded successfully',
        files: uploadResults,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Upload failed',
        error: error.message,
      });
    }
  },
);

// Generate presigned URL for direct uploads
router.post(
  '/presigned-upload',
  authenticateToken,
  [
    body('fileType').isIn(ALLOWED_FILE_TYPES).withMessage(`fileType must be one of: ${ALLOWED_FILE_TYPES.join(', ')}`),
    body('fileName').notEmpty().isLength({ min: 1, max: 200 }).matches(/^[\w\-. ]+$/).withMessage('fileName contains invalid characters'),
    body('contentType').isIn(ALLOWED_CONTENT_TYPES).withMessage('Unsupported content type'),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    return;
  }
  try {
    const { fileType, fileName, contentType } = req.body as {
      fileType: string;
      fileName: string;
      contentType: string;
    };

    const key = R2Service.generateFileKey(req.user!.id, fileType, fileName);
    const presignedData = await R2Service.generatePresignedUploadUrl(key, contentType);

    res.json({
      success: true,
      presignedData,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate presigned URL',
      error: error.message,
    });
  }
  },
);

export default router;
