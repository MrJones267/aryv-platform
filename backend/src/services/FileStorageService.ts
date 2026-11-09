/**
 * @fileoverview Where uploaded files are kept.
 * @author Oabona-Majoko
 * @created 2026-08-24
 * @lastModified 2026-11-03
 *
 * The problem this solves:
 *
 * Uploads were written to ./uploads inside the container. On Railway that
 * filesystem is replaced on every deploy, so a driver's licence and ID
 * uploaded on Monday were gone by Tuesday's release — while the database row
 * still said the driver was verified and approved. Nothing surfaced the loss;
 * the record and the evidence for it simply diverged.
 *
 * Cloudflare R2 is where these belong: it survives deploys, it is already part
 * of the stack, and it is where the marketing site's assets live. Files go
 * there when R2 is configured and to disk when it is not, so local development
 * needs no cloud account.
 *
 * Identity documents are deliberately NOT public. They are written to a
 * private key space and read back through short-lived signed URLs, so a
 * guessed filename does not expose someone's passport.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import type { Response } from 'express';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logInfo, logWarning, logError } from '../utils/logger';

export type FileCategory = 'avatars' | 'documents' | 'vehicles' | 'trip-photos';

export interface StoredFile {
  /** Opaque handle to give back to `urlFor` / `remove`. */
  key: string;
  /** Where the backend put it: 'r2' or 'local'. */
  backend: 'r2' | 'local';
}

/**
 * Categories nobody but the owner and staff may read.
 *
 * Avatars are shown to other users by design; identity documents are not.
 */
const PRIVATE_CATEGORIES: ReadonlySet<FileCategory> = new Set(['documents', 'trip-photos']);

/** How long a signed link to a private document stays valid. */
const SIGNED_URL_TTL_SECONDS = 300;

const R2_ENDPOINT = process.env['R2_ENDPOINT'] || process.env['CLOUDFLARE_R2_ENDPOINT'] || '';
const R2_BUCKET = process.env['R2_BUCKET_NAME'] || process.env['CLOUDFLARE_R2_BUCKET'] || '';
const R2_ACCESS_KEY = process.env['R2_ACCESS_KEY_ID'] || process.env['CLOUDFLARE_R2_ACCESS_KEY'] || '';
const R2_SECRET_KEY = process.env['R2_SECRET_ACCESS_KEY'] || process.env['CLOUDFLARE_R2_SECRET_KEY'] || '';

/**
 * Public base for files that are meant to be readable, e.g.
 * https://cdn.aryv-app.com. Without it, even public files are served through
 * a signed URL — correct, just less cacheable.
 */
const R2_PUBLIC_BASE = (process.env['R2_PUBLIC_BASE_URL'] || '').replace(/\/$/, '');

const VOLUME_MOUNT_PATH = process.env['RAILWAY_VOLUME_MOUNT_PATH'];

export const LOCAL_UPLOADS_DIR = process.env['UPLOADS_DIR']
  || (VOLUME_MOUNT_PATH ? path.join(VOLUME_MOUNT_PATH, 'uploads') : './uploads');

export const isR2Configured = (): boolean =>
  Boolean(R2_ENDPOINT && R2_BUCKET && R2_ACCESS_KEY && R2_SECRET_KEY);

/**
 * True when files are going somewhere a deploy will erase. Checked at startup
 * so the failure is loud instead of silent months later.
 */
export const storageIsEphemeral = (): boolean =>
  !isR2Configured() && !process.env['UPLOADS_DIR'] && !VOLUME_MOUNT_PATH;

/**
 * The stored file behind a profile-photo URL
 * ("https://api.aryv-app.com/uploads/avatars/<file>"), or null for anything
 * else, such as a Google account photo.
 */
export const avatarFileFromUrl = (url: string | null | undefined): string | null => {
  const match = /\/uploads\/avatars\/([^/?#]+)$/.exec(url ?? '');
  return match ? path.basename(match[1]!) : null;
};

export class FileStorageService {
  private client: S3Client | null = null;

  private getClient(): S3Client {
    if (!this.client) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: R2_ENDPOINT,
        credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
      });
    }

    return this.client;
  }

  /**
   * Store a file and return a handle to it.
   *
   * The key carries random bytes rather than only the owner's id and a
   * timestamp: those are guessable, and for identity documents a guessable
   * path is the whole exposure.
   */
  async store(
    buffer: Buffer,
    category: FileCategory,
    ownerId: string,
    extension: string,
    contentType: string,
  ): Promise<StoredFile> {
    const safeExtension = extension.startsWith('.') ? extension : `.${extension}`;
    const filename = `${ownerId}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExtension}`;
    const key = `${category}/${filename}`;

    if (isR2Configured()) {
      await this.getClient().send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );

      logInfo('Stored upload in R2', { key, category, bytes: buffer.length });
      return { key, backend: 'r2' };
    }

    const directory = path.join(LOCAL_UPLOADS_DIR, category);
    await fs.promises.mkdir(directory, { recursive: true });
    await fs.promises.writeFile(path.join(directory, filename), buffer);

    return { key, backend: 'local' };
  }

  /**
   * A URL the client can use.
   *
   * Private categories always get a short-lived signed URL. Public ones get a
   * plain CDN URL when a public base is configured, because an avatar behind a
   * five-minute signature cannot be cached.
   */
  async urlFor(key: string): Promise<string> {
    const category = key.split('/')[0] as FileCategory;

    if (!isR2Configured()) {
      // Served by the authenticated /uploads route in index.ts.
      return `/uploads/${key}`;
    }

    if (!PRIVATE_CATEGORIES.has(category) && R2_PUBLIC_BASE) {
      return `${R2_PUBLIC_BASE}/${key}`;
    }

    return getSignedUrl(
      this.getClient(),
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    );
  }

  /** Remove a file. Never throws: a failed cleanup must not fail the request. */
  async remove(key: string): Promise<boolean> {
    try {
      if (isR2Configured()) {
        await this.getClient().send(
          new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }),
        );
        return true;
      }

      await fs.promises.unlink(path.join(LOCAL_UPLOADS_DIR, key));
      return true;
    } catch (error) {
      logWarning('Could not remove stored file', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Copy a file the upload middleware wrote to disk into R2, under the same
   * `<category>/<filename>` it is served from, so stored URLs and the
   * ownership rule (filenames start with the owner's id) are unchanged.
   *
   * Until 2026-11-03 nothing called this service: every upload stayed on
   * the container's disk and was lost on the next deploy, R2 or not.
   *
   * @returns true when the file is now in R2; false when R2 is not configured
   */
  async persistUpload(category: FileCategory, filename: string, filePath: string, contentType: string): Promise<boolean> {
    if (!isR2Configured()) return false;
    const body = await fs.promises.readFile(filePath);
    const key = `${category}/${path.basename(filename)}`;
    await this.getClient().send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
    logInfo('Stored upload in R2', { key, bytes: body.length });
    return true;
  }

  /**
   * Send a stored file: from local disk if it is there (development, or a
   * file from before R2), otherwise from R2. The caller has already checked
   * that the requester may see it.
   *
   * @returns false when the file is in neither place; nothing has been sent
   */
  async sendFile(res: Response, category: FileCategory, filename: string): Promise<boolean> {
    const safe = path.basename(filename);
    const localPath = path.resolve(LOCAL_UPLOADS_DIR, category, safe);

    if (await fs.promises.access(localPath).then(() => true, () => false)) {
      await new Promise<void>((resolve, reject) => {
        res.sendFile(localPath, (err) => (err ? reject(err) : resolve()));
      });
      return true;
    }

    if (!isR2Configured()) return false;

    try {
      const object = await this.getClient().send(
        new GetObjectCommand({ Bucket: R2_BUCKET, Key: `${category}/${safe}` }),
      );
      if (!object.Body) return false;
      if (object.ContentType) res.setHeader('Content-Type', object.ContentType);
      if (object.ContentLength !== undefined) res.setHeader('Content-Length', String(object.ContentLength));
      await new Promise<void>((resolve, reject) => {
        (object.Body as Readable).on('error', reject).pipe(res).on('finish', resolve).on('error', reject);
      });
      return true;
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (name === 'NoSuchKey' || name === 'NotFound') return false;
      throw error;
    }
  }

  /** Remove a stored file from R2, if R2 is in use. Never throws. */
  async removeUpload(category: FileCategory, filename: string): Promise<void> {
    if (!isR2Configured()) return;
    await this.remove(`${category}/${path.basename(filename)}`);
  }

  /**
   * Say plainly at startup where files are going.
   *
   * The ephemeral case is an error, not a warning: in production it means
   * verification documents are being accepted and then destroyed.
   */
  reportConfiguration(): void {
    if (isR2Configured()) {
      logInfo('File storage: Cloudflare R2', { bucket: R2_BUCKET });
      return;
    }

    if (storageIsEphemeral() && process.env['NODE_ENV'] === 'production') {
      logError(
        'File storage is EPHEMERAL',
        new Error('No R2 credentials and no persistent volume'),
        {
          consequence:
            'Uploads written to ./uploads will be destroyed on the next deploy, '
            + 'including driver verification documents, while their database rows '
            + 'still read as approved.',
          fix: 'Set R2_ENDPOINT, R2_BUCKET_NAME, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.',
        },
      );
      return;
    }

    logInfo('File storage: local disk', { directory: LOCAL_UPLOADS_DIR });
  }
}

export const fileStorageService = new FileStorageService();
export default fileStorageService;
