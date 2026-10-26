/**
 * @fileoverview Ensures a rejected promise in a route handler becomes an error
 *               response rather than a hung request.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * Express 4 does not catch rejections from async handlers. If one rejects and
 * nothing catches it, no response is ever written and the client waits until
 * its own timeout — the connection stays open the whole time.
 *
 * That is not hypothetical here. 32 handlers across 7 controllers open their
 * transaction *before* entering the try block:
 *
 *     async updateProfile(req, res) {
 *       const transaction = await sequelize.transaction();  // outside try
 *       try { ... } catch { await transaction.rollback(); res.status(500)... }
 *     }
 *
 * If acquiring the transaction fails — an unreachable database, an exhausted
 * pool — the handler rejects before reaching its own error handling, and the
 * request hangs. So exactly when the system is under stress, those endpoints
 * stop answering instead of failing fast, and open connections accumulate.
 *
 * Wrapping at mount time covers every existing handler and every one added
 * later, without touching 32 call sites individually.
 */

import { Router, Request, Response, NextFunction } from 'express';

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;

const wrapHandler = (original: Handler): Handler =>
  function wrapped(this: unknown, req: Request, res: Response, next: NextFunction) {
    try {
      const result = (original as (...args: unknown[]) => unknown).call(this, req, res, next);
      if (result && typeof (result as Promise<unknown>).catch === 'function') {
        (result as Promise<unknown>).catch(next);
      }
      return result;
    } catch (error) {
      next(error);
      return undefined;
    }
  };

/**
 * Wrap every handler in a router so rejections reach the error middleware.
 *
 * Error-handling middleware (arity 4) is left alone: Express identifies it by
 * arity, and wrapping would change that.
 */
export const wrapRouterAsync = <T extends Router>(router: T): T => {
  const stack = (router as unknown as { stack?: any[] }).stack ?? [];

  for (const layer of stack) {
    if (layer.route) {
      for (const entry of layer.route.stack ?? []) {
        if (typeof entry.handle !== 'function' || entry.handle.length >= 4) continue;
        entry.handle = wrapHandler(entry.handle);
      }
      continue;
    }

    // router.use(...) middleware — authenticateToken among them, which is
    // async and would otherwise hang the request if its user lookup rejected.
    if (typeof layer.handle === 'function' && layer.handle.length < 4 && !layer.handle.stack) {
      layer.handle = wrapHandler(layer.handle);
    }
  }

  return router;
};

export default wrapRouterAsync;
