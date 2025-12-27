import multer from 'multer';
import R2Service from '../services/r2Service.js';

// Configure multer for memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedTypes = {
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
    cb(new Error('Invalid file type. Only JPEG, PNG, WebP, PDF, MP4, and WebM are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Middleware to handle file upload to R2
export const uploadToR2 = (fileType) => {
  return async (req, res, next) => {
    try {
      if (!req.file) {
        return next();
      }

      const userId = req.user.id;
      const key = R2Service.generateFileKey(userId, fileType, req.file.originalname);
      
      const uploadResult = await R2Service.uploadFile(
        req.file.buffer,
        key,
        req.file.mimetype
      );

      req.uploadedFile = uploadResult;
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'File upload failed',
        error: error.message,
      });
    }
  };
};
