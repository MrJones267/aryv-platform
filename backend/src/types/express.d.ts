/**
 * @fileoverview Express type extensions
 * @author Oabona-Majoko
 * @created 2025-01-24
 */

import { User } from './index';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
