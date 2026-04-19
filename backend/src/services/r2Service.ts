/**
 * @fileoverview Cloudflare R2 storage service (S3-compatible)
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2026-03-28
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import logger from '../utils/logger';

interface UploadResult {
  success: boolean;
  key: string;
  url: string;
  etag: string | undefined;
}

interface PresignedUploadResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

interface DeleteResult {
  success: boolean;
  deleted: string;
}

class R2Service {
  private client: S3Client;
  private bucketName: string;

  constructor() {
    const endpoint = process.env['R2_ENDPOINT'];
    this.client = new S3Client({
      region: 'auto',
      ...(endpoint ? { endpoint } : {}),
      credentials: {
        accessKeyId: process.env['R2_ACCESS_KEY_ID'] || '',
        secretAccessKey: process.env['R2_SECRET_ACCESS_KEY'] || '',
      },
    });
    this.bucketName = process.env['R2_BUCKET_NAME'] || '';
  }

  async uploadFile(file: Buffer, key: string, contentType = 'application/octet-stream'): Promise<UploadResult> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file,
        ContentType: contentType,
      });

      const result = await this.client.send(command);

      return {
        success: true,
        key,
        url: `${process.env['R2_PUBLIC_URL']}/${key}`,
        etag: result.ETag,
      };
    } catch (error: any) {
      logger.error('R2 upload error', { error: error.message });
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  async generatePresignedUploadUrl(key: string, contentType: string, expiresIn = 3600): Promise<PresignedUploadResult> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
      });

      const presignedUrl = await getSignedUrl(this.client, command, { expiresIn });

      return {
        uploadUrl: presignedUrl,
        publicUrl: `${process.env['R2_PUBLIC_URL']}/${key}`,
        key,
      };
    } catch (error: any) {
      logger.error('Presigned URL generation error', { error: error.message });
      throw new Error(`Presigned URL generation failed: ${error.message}`);
    }
  }

  async deleteFile(key: string): Promise<DeleteResult> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
      return { success: true, deleted: key };
    } catch (error: any) {
      logger.error('R2 delete error', { error: error.message });
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  generateFileKey(userId: string, fileType: string, originalName: string): string {
    const timestamp = Date.now();
    const extension = originalName.split('.').pop();

    switch (fileType) {
      case 'profile':
        return `users/${userId}/profile/${timestamp}.${extension}`;
      case 'driver-document':
        return `users/${userId}/documents/${timestamp}.${extension}`;
      case 'vehicle-photo':
        return `users/${userId}/vehicle/${timestamp}.${extension}`;
      case 'ride-photo':
        return `rides/${userId}/${timestamp}.${extension}`;
      case 'chat-media':
        return `chats/${userId}/${timestamp}.${extension}`;
      default:
        return `misc/${userId}/${timestamp}.${extension}`;
    }
  }
}

export default new R2Service();
