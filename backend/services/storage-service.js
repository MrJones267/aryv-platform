/**
 * Storage Service - Cloudflare R2 Integration
 * S3-compatible API for file uploads
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');

class StorageService {
  constructor() {
    // Use Cloudflare R2 (S3-compatible)
    this.client = new S3Client({
      region: 'auto',
      endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY,
      },
      forcePathStyle: true, // Required for R2
    });
    
    this.bucket = process.env.CLOUDFLARE_R2_BUCKET || 'aryv-uploads';
    this.publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL || `https://${this.bucket}.r2.cloudflarestorage.com`;
  }

  /**
   * Generate unique filename
   */
  generateFileName(originalName, userId) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(6).toString('hex');
    const extension = path.extname(originalName);
    return `${userId}/${timestamp}_${random}${extension}`;
  }

  /**
   * Upload file to R2
   */
  async uploadFile(file, userId, folder = 'general') {
    try {
      const fileName = this.generateFileName(file.originalname, userId);
      const key = `${folder}/${fileName}`;

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'public, max-age=31536000', // 1 year cache
        Metadata: {
          userId: userId.toString(),
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.client.send(command);

      return {
        success: true,
        fileName: key,
        url: `${this.publicUrl}/${key}`,
        size: file.size,
        type: file.mimetype,
      };
    } catch (error) {
      console.error('File upload error:', error);
      throw new Error('Failed to upload file');
    }
  }

  /**
   * Delete file from R2
   */
  async deleteFile(fileName) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: fileName,
      });

      await this.client.send(command);
      return { success: true, message: 'File deleted successfully' };
    } catch (error) {
      console.error('File deletion error:', error);
      throw new Error('Failed to delete file');
    }
  }

  /**
   * Generate presigned URL for direct upload (mobile apps)
   */
  async generatePresignedUploadUrl(fileName, contentType, userId) {
    try {
      const key = `uploads/${userId}/${fileName}`;
      
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        Metadata: {
          userId: userId.toString(),
          uploadedAt: new Date().toISOString(),
        },
      });

      const signedUrl = await getSignedUrl(this.client, command, { expiresIn: 300 }); // 5 minutes

      return {
        success: true,
        uploadUrl: signedUrl,
        fileName: key,
        publicUrl: `${this.publicUrl}/${key}`,
      };
    } catch (error) {
      console.error('Presigned URL error:', error);
      throw new Error('Failed to generate upload URL');
    }
  }

  /**
   * Get file metadata
   */
  async getFileInfo(fileName) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileName,
      });

      const response = await this.client.send(command);
      
      return {
        success: true,
        fileName,
        size: response.ContentLength,
        type: response.ContentType,
        lastModified: response.LastModified,
        metadata: response.Metadata,
      };
    } catch (error) {
      console.error('File info error:', error);
      throw new Error('File not found');
    }
  }

  /**
   * List user files
   */
  async listUserFiles(userId, folder = '') {
    try {
      const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
      
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: `${folder}${folder ? '/' : ''}${userId}/`,
      });

      const response = await this.client.send(command);
      
      const files = response.Contents?.map(file => ({
        fileName: file.Key,
        url: `${this.publicUrl}/${file.Key}`,
        size: file.Size,
        lastModified: file.LastModified,
      })) || [];

      return {
        success: true,
        files,
        count: files.length,
      };
    } catch (error) {
      console.error('List files error:', error);
      throw new Error('Failed to list files');
    }
  }
}

// Export singleton instance
const storageService = new StorageService();

module.exports = {
  storageService,
  StorageService,
};