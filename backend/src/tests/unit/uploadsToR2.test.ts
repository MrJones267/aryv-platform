/**
 * @fileoverview Unit tests for keeping uploads in Cloudflare R2
 * @author Oabona-Majoko
 * @created 2026-11-03
 * @lastModified 2026-11-06
 *
 * FileStorageService could write to R2, but nothing called it: every upload
 * stayed on the container's disk and was lost on the next deploy, with R2
 * configured or not. Uploads are now copied to R2 after multer receives
 * them, and served from disk or R2.
 */

import express from 'express';
import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';

const sent: Array<{ command: string; input: Record<string, any> }> = [];
const r2Objects = new Map<string, { body: Buffer; contentType?: string }>();
let failPuts = false;

jest.mock('@aws-sdk/client-s3', () => {
  class Command {
    constructor(public input: Record<string, any>) {}
  }
  class PutObjectCommand extends Command {}
  class GetObjectCommand extends Command {}
  class DeleteObjectCommand extends Command {}
  class S3Client {
    async send(command: Command): Promise<unknown> {
      const name = command.constructor.name;
      sent.push({ command: name, input: command.input });
      if (name === 'PutObjectCommand') {
        if (failPuts) throw new Error('R2 unavailable');
        r2Objects.set(command.input['Key'], { body: command.input['Body'], contentType: command.input['ContentType'] });
        return {};
      }
      if (name === 'GetObjectCommand') {
        const object = r2Objects.get(command.input['Key']);
        if (!object) throw Object.assign(new Error('missing'), { name: 'NoSuchKey' });
        return { Body: Readable.from(object.body), ContentType: object.contentType, ContentLength: object.body.length };
      }
      r2Objects.delete(command.input['Key']);
      return {};
    }
  }
  return { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand };
});
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn() }));

const UPLOADS = fs.mkdtempSync(path.join(os.tmpdir(), 'aryv-uploads-'));
const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

// The service reads its configuration when it is loaded.
process.env['UPLOADS_DIR'] = UPLOADS;
process.env['R2_ENDPOINT'] = 'https://account.r2.cloudflarestorage.com';
process.env['R2_BUCKET_NAME'] = 'aryv-test-bucket';
process.env['R2_ACCESS_KEY_ID'] = 'key';
process.env['R2_SECRET_ACCESS_KEY'] = 'secret';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { uploadDocument, uploadAvatar } = require('../../middleware/upload');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fileStorageService } = require('../../services/FileStorageService');

const buildApp = () => {
  const app = express();
  app.use((req: any, _res, next) => { req.user = { id: USER_ID }; next(); });
  app.post('/documents', uploadDocument, (req: any, res) => {
    res.json({ filename: req.file.filename, stagedAt: req.file.path });
  });
  app.post('/avatar', uploadAvatar, (req: any, res) => res.json({ filename: req.file.filename }));
  app.get('/uploads/:type/:filename', async (req, res) => {
    const found = await fileStorageService.sendFile(res, req.params['type'], req.params['filename']);
    if (!found) res.status(404).json({ code: 'FILE_NOT_FOUND' });
  });
  return app;
};

const waitFor = async (check: () => boolean): Promise<void> => {
  for (let i = 0; i < 50 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
};

describe('Uploads kept in R2', () => {
  beforeEach(() => {
    sent.length = 0;
    r2Objects.clear();
    failPuts = false;
  });

  afterAll(() => fs.rmSync(UPLOADS, { recursive: true, force: true }));

  it('copies a document into R2 under the path it is served from, and drops the staged copy', async () => {
    const res = await request(buildApp())
      .post('/documents')
      .attach('document', Buffer.from('%PDF-1.4 licence'), { filename: 'licence.pdf', contentType: 'application/pdf' })
      .expect(200);

    const key = `documents/${res.body.filename}`;
    expect(res.body.filename.startsWith(`${USER_ID}-`)).toBe(true);
    // Owner prefix, timestamp, then 16 random hex characters: the name cannot
    // be guessed from the (public) user id and an upload time.
    expect(res.body.filename).toMatch(new RegExp(`^${USER_ID}-doc-\\d{13}-[0-9a-f]{16}\\.pdf$`));
    expect(r2Objects.get(key)).toEqual({ body: Buffer.from('%PDF-1.4 licence'), contentType: 'application/pdf' });
    await waitFor(() => !fs.existsSync(res.body.stagedAt));
    expect(fs.existsSync(res.body.stagedAt)).toBe(false);
  });

  it('keeps avatars under avatars/', async () => {
    const res = await request(buildApp())
      .post('/avatar')
      .attach('avatar', Buffer.from('jpeg-bytes'), { filename: 'me.jpg', contentType: 'image/jpeg' })
      .expect(200);
    expect(r2Objects.has(`avatars/${res.body.filename}`)).toBe(true);
  });

  it('fails the upload, rather than report success, when R2 refuses the file', async () => {
    failPuts = true;
    const res = await request(buildApp())
      .post('/documents')
      .attach('document', Buffer.from('%PDF-1.4'), { filename: 'licence.pdf', contentType: 'application/pdf' })
      .expect(503);
    expect(res.body.code).toBe('UPLOAD_STORAGE_FAILED');
  });

  it('serves a file from R2 once the staged copy is gone', async () => {
    const upload = await request(buildApp())
      .post('/documents')
      .attach('document', Buffer.from('%PDF-1.4 id'), { filename: 'id.pdf', contentType: 'application/pdf' })
      .expect(200);
    await waitFor(() => !fs.existsSync(upload.body.stagedAt));

    const res = await request(buildApp()).get(`/uploads/documents/${upload.body.filename}`).expect(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(Buffer.from(res.body).toString()).toBe('%PDF-1.4 id');
  });

  it('still serves a file that is only on disk, from before R2', async () => {
    const filename = `${USER_ID}-doc-1.pdf`;
    fs.mkdirSync(path.join(UPLOADS, 'documents'), { recursive: true });
    fs.writeFileSync(path.join(UPLOADS, 'documents', filename), 'old file');
    const res = await request(buildApp()).get(`/uploads/documents/${filename}`).expect(200);
    expect(Buffer.from(res.body).toString()).toBe('old file');
    expect(sent.some((s) => s.command === 'GetObjectCommand')).toBe(false);
  });

  it('answers not found when a file is in neither place', async () => {
    await request(buildApp()).get(`/uploads/documents/${USER_ID}-doc-missing.pdf`).expect(404);
  });

  it('removes a file from R2', async () => {
    r2Objects.set('documents/x.pdf', { body: Buffer.from('x') });
    await fileStorageService.removeUpload('documents', 'x.pdf');
    expect(r2Objects.has('documents/x.pdf')).toBe(false);
  });
});
