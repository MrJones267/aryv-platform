/**
 * @fileoverview Admin review and resolution of cash ride payment disputes
 * @author Oabona-Majoko
 * @created 2026-10-29
 * @lastModified 2026-10-29
 *
 * A rider or driver reports a problem with a cash payment from the app. The
 * platform never holds that cash, so resolving a dispute moves no money: the
 * admin records what happened to the cash, and the payment and the driver's
 * commission follow from it.
 *
 *   paid_in_full  the payment completes; commission on the whole fare
 *   part_paid     the payment completes; commission on the part paid
 *   not_paid      the payment fails; no commission
 *
 * Commission already charged for the payment (it accrues when both sides
 * confirm, and a dispute can be raised after that) is corrected to the
 * outcome, up or down, through the commission ledger, so the ledger still
 * explains every change to what the driver owes.
 */

// External imports
import { Op, Transaction } from 'sequelize';

// Internal imports
import { sequelize, QueryTypes } from '../config/database';
import CashDispute, { CASH_DISPUTE_OUTCOMES, CashDisputeOutcome } from '../models/CashDispute';
import CashTransaction, { CashPaymentStatus } from '../models/CashTransaction';
import CommissionLedger, { CommissionEntryType } from '../models/CommissionLedger';
import TrustHold from '../models/TrustHold';
import UserWallet from '../models/UserWallet';
import { CommissionService } from './CommissionService';
import { round2 } from '../utils/fees';
import { logInfo } from '../utils/logger';

// Constants
const REASON_MIN = 5;
const REASON_MAX = 1000;

export type ResolveResult =
  | { success: true; outcome: CashDisputeOutcome; commissionBefore: number; commissionAfter: number }
  | { success: false; status: number; code: string; error: string };

const fail = (status: number, code: string, error: string): ResolveResult => ({ success: false, status, code, error });

const name = (alias: string) => `NULLIF(TRIM(CONCAT(${alias}.first_name, ' ', ${alias}.last_name)), '')`;

// Never the confirmation codes: they are what lets a payment be confirmed.
const DISPUTE_SELECT = `
  SELECT d.id, d.reason, d.description, d.evidence, d.priority, d.status,
         d.transaction_status_before AS "transactionStatusBefore",
         d.outcome, d.amount_paid::float AS "amountPaid", d.resolution_notes AS "resolutionNotes",
         d.resolved_at AS "resolvedAt", d.created_at AS "createdAt",
         ra.email AS "resolvedByEmail", ${name('ra')} AS "resolvedByName",
         d.reporter_id AS "reporterId", ${name('rep')} AS "reporterName",
         CASE WHEN d.reporter_id = t.driver_id THEN 'driver' ELSE 'rider' END AS "reportedBy",
         t.id AS "transactionId", t.status AS "transactionStatus", t.amount::float AS amount, t.currency,
         t.platform_fee::float AS "platformFee", t.actual_amount_claimed::float AS "amountClaimedByDriver",
         t.rider_confirmed_at AS "riderConfirmedAt", t.driver_confirmed_at AS "driverConfirmedAt",
         t.risk_score AS "riskScore", t.fraud_flags AS "fraudFlags", t.created_at AS "paymentStartedAt",
         t.rider_id AS "riderId", ${name('r')} AS "riderName", r.phone_number AS "riderPhone",
         t.driver_id AS "driverId", ${name('dr')} AS "driverName", dr.phone_number AS "driverPhone",
         t.booking_id AS "bookingId", b.ride_id AS "rideId",
         ride.origin_address AS "origin", ride.destination_address AS "destination", ride.departure_time AS "departureTime"
    FROM cash_disputes d
    JOIN cash_transactions t ON t.id = d.transaction_id
    LEFT JOIN users r ON r.id = t.rider_id
    LEFT JOIN users dr ON dr.id = t.driver_id
    LEFT JOIN users rep ON rep.id = d.reporter_id
    LEFT JOIN admin_users ra ON ra.id = d.resolved_by
    LEFT JOIN bookings b ON b.id = t.booking_id
    LEFT JOIN rides ride ON ride.id = b.ride_id`;

class CashDisputeService {
  private commissionService = new CommissionService();

  /** Open disputes first, highest priority first, then newest. */
  async list(params: { status?: 'open' | 'resolved' | undefined; page: number; limit: number }) {
    const where = params.status ? 'WHERE d.status = :status' : '';
    const replacements = { status: params.status ?? null, limit: params.limit, offset: (params.page - 1) * params.limit };
    const [disputes, [{ total }], [{ open }]] = await Promise.all([
      sequelize.query(
        `${DISPUTE_SELECT} ${where}
          ORDER BY (d.status = 'open') DESC, d.priority DESC, d.created_at DESC
          LIMIT :limit OFFSET :offset`,
        { type: QueryTypes.SELECT, replacements },
      ),
      sequelize.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM cash_disputes d ${where}`,
        { type: QueryTypes.SELECT, replacements },
      ),
      sequelize.query<{ open: number }>(
        `SELECT COUNT(*)::int AS open FROM cash_disputes WHERE status = 'open'`,
        { type: QueryTypes.SELECT },
      ),
    ]);
    return {
      disputes,
      openCount: open,
      pagination: { page: params.page, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) },
    };
  }

  /** One dispute, with the commission charged so far for its payment. */
  async get(id: string) {
    const [dispute] = await sequelize.query<Record<string, unknown>>(
      `${DISPUTE_SELECT} WHERE d.id = :id`,
      { type: QueryTypes.SELECT, replacements: { id } },
    );
    if (!dispute) return null;
    const commission = await sequelize.query(
      `SELECT entry_type AS "entryType", amount::float AS amount, balance_after::float AS "balanceAfter",
              description, created_at AS "createdAt"
         FROM commission_ledger
        WHERE cash_transaction_id = :transactionId
        ORDER BY created_at ASC`,
      { type: QueryTypes.SELECT, replacements: { transactionId: dispute['transactionId'] } },
    );
    return { ...dispute, commission };
  }

  /** Commission currently charged for one cash payment: accruals less reversals. */
  private async chargedFor(cashTransactionId: string, transaction: Transaction): Promise<number> {
    const entries = await CommissionLedger.findAll({
      where: {
        cashTransactionId,
        entryType: { [Op.in]: [CommissionEntryType.ACCRUAL, CommissionEntryType.WAIVER] },
      },
      transaction,
    });
    return round2(entries.reduce(
      (sum, e) => sum + (e.entryType === CommissionEntryType.ACCRUAL ? Number(e.amount) : -Number(e.amount)),
      0,
    ));
  }

  async resolve(
    id: string,
    adminId: string,
    input: { outcome?: unknown; reason?: unknown; amountPaid?: unknown },
  ): Promise<ResolveResult> {
    const outcome = input.outcome as CashDisputeOutcome;
    if (!CASH_DISPUTE_OUTCOMES.includes(outcome)) {
      return fail(400, 'INVALID_OUTCOME', `outcome must be one of ${CASH_DISPUTE_OUTCOMES.join(', ')}`);
    }
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if (reason.length < REASON_MIN || reason.length > REASON_MAX) {
      return fail(400, 'REASON_REQUIRED', `Give a reason of ${REASON_MIN} to ${REASON_MAX} characters`);
    }

    return sequelize.transaction(async t => {
      const dispute = await CashDispute.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!dispute) return fail(404, 'DISPUTE_NOT_FOUND', 'Dispute not found');
      if (dispute.status !== 'open') return fail(409, 'ALREADY_RESOLVED', 'This dispute has already been resolved');

      const payment = await CashTransaction.findByPk(dispute.transactionId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!payment) return fail(404, 'PAYMENT_NOT_FOUND', 'The disputed payment no longer exists');

      const fare = Number(payment.amount);
      let paid: number;
      if (outcome === 'part_paid') {
        const amount = Number(input.amountPaid);
        if (!Number.isFinite(amount) || amount <= 0 || amount >= fare) {
          return fail(400, 'INVALID_AMOUNT', `amountPaid must be more than 0 and less than the fare (${fare.toFixed(2)})`);
        }
        paid = round2(amount);
      } else {
        paid = outcome === 'paid_in_full' ? fare : 0;
      }

      // Commission follows the cash: the full fee on the full fare, a share
      // of it on part of the fare, none when nothing was paid.
      const target = fare > 0 ? round2(Number(payment.platformFee) * (paid / fare)) : 0;
      const before = await this.chargedFor(payment.id, t);
      const delta = round2(target - before);
      const metadata = { cashDisputeId: dispute.id, outcome };

      if (delta > 0) {
        await this.commissionService.accrueCommission(payment.driverId, delta, payment.id, t, {
          description: 'Commission after a payment dispute',
          metadata,
        });
      } else if (delta < 0) {
        let wallet = await UserWallet.findOne({ where: { userId: payment.driverId }, transaction: t, lock: t.LOCK.UPDATE });
        if (!wallet) wallet = await UserWallet.create({ userId: payment.driverId }, { transaction: t });
        // May go below zero when the driver had already paid it: a credit
        // against their next commission.
        const newOwed = round2(Number(wallet.commissionOwed) + delta);
        await wallet.update({ commissionOwed: newOwed }, { transaction: t });
        await CommissionLedger.create({
          driverId: payment.driverId,
          entryType: CommissionEntryType.WAIVER,
          amount: -delta,
          balanceAfter: newOwed,
          cashTransactionId: payment.id,
          recordedBy: adminId,
          description: 'Commission reversed after a payment dispute',
          metadata,
        }, { transaction: t });
      }

      await payment.update({
        status: paid > 0 ? CashPaymentStatus.COMPLETED : CashPaymentStatus.FAILED,
        disputeResolvedAt: new Date(),
      }, { transaction: t });
      await TrustHold.destroy({ where: { transactionId: payment.id }, transaction: t });

      await dispute.update({
        status: 'resolved',
        outcome,
        amountPaid: paid,
        resolutionNotes: reason,
        resolvedBy: adminId,
        resolvedAt: new Date(),
      }, { transaction: t });

      logInfo('Cash payment dispute resolved', { disputeId: id, outcome, paid, commissionBefore: before, commissionAfter: target, adminId });
      return { success: true as const, outcome, commissionBefore: before, commissionAfter: target };
    });
  }
}

export const cashDisputeService = new CashDisputeService();
export default CashDisputeService;
