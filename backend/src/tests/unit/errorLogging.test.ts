/**
 * @fileoverview What a failed request writes to the log.
 * @author Oabona-Majoko
 * @created 2026-11-06
 * @lastModified 2026-11-06
 *
 * Every 404 used to be logged twice: once as an ERROR with a full stack trace
 * by the global error handler, and again as a WARN by the request logger.
 * A WordPress scanner probing /wp-admin/... produced about 120 lines a minute
 * that way, burying real failures. Now a stack is logged only for 5xx, a 4xx
 * is one WARN line carrying its error code, and a 404 outside /api/ drops to
 * http level, below production's `info`.
 */

import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import Logger, { requestLogger } from '../../utils/logger';
import { globalErrorHandler, notFound } from '../../middleware/errorHandler';
import { AppError } from '../../types';

const buildApp = () => {
  const app = express();
  app.use(requestLogger);
  app.get('/api/bad-input', (_req: Request, _res: Response, next: NextFunction) =>
    next(new AppError('Seats must be between 1 and 4', 400, 'INVALID_SEATS')));
  app.get('/api/broken', (_req: Request, _res: Response, next: NextFunction) =>
    next(new Error('database connection lost')));
  app.use('*', notFound);
  app.use(globalErrorHandler);
  return app;
};

describe('error logging', () => {
  let error: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let http: jest.SpyInstance;

  beforeEach(() => {
    error = jest.spyOn(Logger, 'error').mockImplementation((() => Logger) as any);
    warn = jest.spyOn(Logger, 'warn').mockImplementation((() => Logger) as any);
    http = jest.spyOn(Logger, 'http').mockImplementation((() => Logger) as any);
  });

  afterEach(() => jest.restoreAllMocks());

  it('logs a scanner probe outside /api/ below production level, with no error or stack', async () => {
    const res = await request(buildApp()).get('/wp-admin/includes/xleet-shell.php');

    expect(res.status).toBe(404);
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(http).toHaveBeenCalledTimes(1);
  });

  it('still warns about a 404 under /api/, which can be the app calling a missing route', async () => {
    const res = await request(buildApp()).get('/api/no-such-route');

    expect(res.status).toBe(404);
    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][1]).toMatchObject({ statusCode: 404, errorCode: 'ROUTE_NOT_FOUND' });
  });

  it('logs a 4xx once, as a warning with its error code and no stack', async () => {
    const res = await request(buildApp()).get('/api/bad-input');

    expect(res.status).toBe(400);
    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][1]).toMatchObject({ statusCode: 400, errorCode: 'INVALID_SEATS' });
  });

  it('logs a server fault as an error with its stack', async () => {
    const res = await request(buildApp()).get('/api/broken');

    expect(res.status).toBe(500);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][1]).toMatchObject({ error: 'database connection lost', url: '/api/broken' });
    expect(error.mock.calls[0][1].stack).toEqual(expect.stringContaining('database connection lost'));
  });
});
