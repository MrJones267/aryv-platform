/**
 * @fileoverview Requests for a booking's face photos from today
 * @author Oabona-Majoko
 * @created 2026-11-09
 * @lastModified 2026-11-09
 *
 * The rules live in TripPhotoService; this turns them into responses.
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import tripPhotoService, { TripPhotoError } from '../services/TripPhotoService';
import type { TripPhotoRole } from '../models/TripPhoto';
import { logError } from '../utils/logger';

const now = (): string => new Date().toISOString();

/** JPEG and PNG only, judged by the bytes rather than the declared type. */
export const imageTypeOf = (buffer: Buffer): 'image/jpeg' | 'image/png' | null => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  return null;
};

const fail = (res: Response, error: unknown, action: string): void => {
  if (error instanceof TripPhotoError) {
    res.status(error.status).json({ success: false, error: error.message, code: error.code, timestamp: now() });
    return;
  }
  logError(`Trip photo ${action} failed`, error as Error);
  if (!res.headersSent) {
    res.status(500).json({ success: false, error: 'Something went wrong', code: 'INTERNAL_ERROR', timestamp: now() });
  }
};

export class TripPhotoController {
  /** POST /bookings/:id/trip-photo — multipart field `photo` */
  async upload(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const file = (req as unknown as { file?: { buffer: Buffer } }).file;
      const type = file ? imageTypeOf(file.buffer) : null;
      if (!file || !type) {
        res.status(400).json({ success: false, error: 'A JPEG or PNG photo is required', code: 'INVALID_PHOTO', timestamp: now() });
        return;
      }
      const data = await tripPhotoService.save(req.params['id']!, req.user!.id, file.buffer, type);
      res.status(201).json({ success: true, data, timestamp: now() });
    } catch (error) {
      fail(res, error, 'upload');
    }
  }

  /** GET /bookings/:id/trip-photos — which photos the caller can see */
  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data = await tripPhotoService.list(req.params['id']!, req.user!.id);
      res.json({ success: true, data, timestamp: now() });
    } catch (error) {
      fail(res, error, 'list');
    }
  }

  /** GET /bookings/:id/trip-photos/:role — the image itself */
  async show(req: AuthenticatedRequest, res: Response): Promise<void> {
    await this.sendPhoto(req, res, { userId: req.user!.id });
  }

  /** GET /bookings/:id/trip-photos/:role/admin — for a report or SOS */
  async showToAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
    await this.sendPhoto(req, res, { asAdmin: true });
  }

  private async sendPhoto(req: AuthenticatedRequest, res: Response, viewer: { userId?: string; asAdmin?: boolean }): Promise<void> {
    try {
      const sent = await tripPhotoService.send(res, req.params['id']!, req.params['role'] as TripPhotoRole, viewer);
      if (!sent && !res.headersSent) {
        res.status(404).json({ success: false, error: 'No photo yet', code: 'PHOTO_NOT_FOUND', timestamp: now() });
      }
    } catch (error) {
      fail(res, error, 'download');
    }
  }
}

export default TripPhotoController;
