/**
 * @fileoverview Commission Controller — driver commission balance, settlement,
 *               and ledger history endpoints.
 * @author Oabona-Majoko
 * @created 2026-06-17
 * @lastModified 2026-06-17
 */

import { Response } from 'express';
import { validationResult } from 'express-validator';
import CommissionService from '../services/CommissionService';
import { SettlementMethod } from '../models/CommissionLedger';
import { AuthenticatedRequest } from '../types';
import { UserRole } from '../types';
import { logError } from '../utils/logger';

export class CommissionController {
  private commissionService: CommissionService;

  constructor() {
    this.commissionService = new CommissionService();
  }

  /**
   * Get the authenticated driver's commission balance.
   * GET /api/payments/commission/balance
   */
  async getBalance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const driverId = req.user?.id;
      if (!driverId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const balance = await this.commissionService.getBalance(driverId);
      res.status(200).json({ success: true, data: balance });
    } catch (error) {
      logError('Error fetching commission balance', error as Error);
      res.status(500).json({ success: false, error: 'Failed to fetch commission balance' });
    }
  }

  /**
   * Settle (pay down) commission owed.
   * - A driver may settle their own balance via wallet deduction.
   * - An admin may record a settlement for any driver via any method
   *   (e.g. the driver paid cash at an agent).
   * POST /api/payments/commission/settle
   */
  async settle(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
        return;
      }

      const actorId = req.user?.id;
      const actorRole = req.user?.role;
      if (!actorId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const isAdmin = actorRole === UserRole.ADMIN;
      const { amount, method } = req.body;
      const targetDriverId: string = isAdmin && req.body.driverId ? req.body.driverId : actorId;

      // Non-admins may only settle their own balance, and only by deducting
      // from their digital wallet (offline methods must be recorded by an admin
      // who has verified the payment).
      let settlementMethod: SettlementMethod = method;
      if (!isAdmin) {
        if (req.body.driverId && req.body.driverId !== actorId) {
          res.status(403).json({ success: false, error: 'Cannot settle commission for another driver' });
          return;
        }
        settlementMethod = SettlementMethod.WALLET_DEDUCTION;
      }

      const result = await this.commissionService.settleCommission(
        targetDriverId,
        parseFloat(amount),
        settlementMethod,
        isAdmin ? actorId : undefined,
        req.body.description,
      );

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      logError('Error settling commission', error as Error);
      res.status(500).json({ success: false, error: 'Failed to settle commission' });
    }
  }

  /**
   * Get the authenticated driver's commission ledger history.
   * GET /api/payments/commission/ledger
   */
  async getLedger(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const driverId = req.user?.id;
      if (!driverId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const limit = Math.min(parseInt(String(req.query['limit'] ?? '50'), 10) || 50, 100);
      const offset = parseInt(String(req.query['offset'] ?? '0'), 10) || 0;

      const { rows, count } = await this.commissionService.getLedger(driverId, limit, offset);
      res.status(200).json({ success: true, data: rows, pagination: { limit, offset, total: count } });
    } catch (error) {
      logError('Error fetching commission ledger', error as Error);
      res.status(500).json({ success: false, error: 'Failed to fetch commission ledger' });
    }
  }
}

export default CommissionController;
