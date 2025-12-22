import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

class R2Service {
  constructor() {
    this.client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
    this.bucketName = process.env.R2_BUCKET_NAME;
  }

  // Upload file to R2
  async uploadFile(file, key, contentType = 'application/octet-stream') {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file,
        ContentType: contentType,
        ACL: 'public-read',
      });

      const result = await this.client.send(command);
      
      return {
        success: true,
        key: key,
        url: `${process.env.R2_PUBLIC_URL}/${key}`,
        etag: result.ETag,
      };
    } catch (error) {
      console.error('R2 upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  // Generate presigned URL for secure uploads
  async generatePresignedUploadUrl(key, contentType, expiresIn = 3600) {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
      });

      const presignedUrl = await getSignedUrl(this.client, command, {
        expiresIn: expiresIn,
      });

      return {
        uploadUrl: presignedUrl,
        publicUrl: `${process.env.R2_PUBLIC_URL}/${key}`,
        key: key,
      };
    } catch (error) {
      console.error('Presigned URL generation error:', error);
      throw new Error(`Presigned URL generation failed: ${error.message}`);
    }
  }

  // Delete file from R2
  async deleteFile(key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
      return { success: true, deleted: key };
    } catch (error) {
      console.error('R2 delete error:', error);
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  // Generate key for different file types
  generateFileKey(userId, fileType, originalName) {
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