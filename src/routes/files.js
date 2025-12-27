import express from 'express';
import { upload, uploadToR2 } from '../middleware/uploadMiddleware.js';
import { authenticate } from '../middleware/auth.js';
import R2Service from '../services/r2Service.js';

const router = express.Router();

// Upload profile picture
router.post('/profile-picture', 
  authenticate,
  upload.single('profilePicture'),
  uploadToR2('profile'),
  async (req, res) => {
    try {
      if (!req.uploadedFile) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded',
        });
      }

      // Update user profile with new image URL
      // await User.update({ profilePicture: req.uploadedFile.url }, { where: { id: req.user.id } });

      res.json({
        success: true,
        message: 'Profile picture uploaded successfully',
        file: req.uploadedFile,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Upload failed',
        error: error.message,
      });
    }
  }
);

// Upload driver documents
router.post('/driver-documents',
  authenticate,
  upload.array('documents', 5), // Allow up to 5 documents
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded',
        });
      }

      const uploadPromises = req.files.map(file => {
        const key = R2Service.generateFileKey(req.user.id, 'driver-document', file.originalname);
        return R2Service.uploadFile(file.buffer, key, file.mimetype);
      });

      const uploadResults = await Promise.all(uploadPromises);

      res.json({
        success: true,
        message: 'Documents uploaded successfully',
        files: uploadResults,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Upload failed',
        error: error.message,
      });
    }
  }
);

// Generate presigned URL for direct uploads
router.post('/presigned-upload',
  authenticate,
  async (req, res) => {
    try {
      const { fileType, fileName, contentType } = req.body;
      
      if (!fileType || !fileName || !contentType) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameters',
        });
      }

      const key = R2Service.generateFileKey(req.user.id, fileType, fileName);
      const presignedData = await R2Service.generatePresignedUploadUrl(key, contentType);

      res.json({
        success: true,
        presignedData,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate presigned URL',
        error: error.message,
      });
    }
  }
);

export default router;