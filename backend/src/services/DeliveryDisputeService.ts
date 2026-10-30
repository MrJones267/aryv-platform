/**
 * @fileoverview Raising, reviewing and resolving courier delivery disputes
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * A sender or a courier reports a problem with a delivery from the app; an
 * admin decides what happened. Before this, nobody could raise one (the
 * controller for it was never mounted), and resolving one from the admin
 * panel ignored the decision the admin picked.
 *
 * Deliveries are paid cash on delivery: the recipient pays the courier at
 * the door and ARYV holds nothing. So, as with cash ride disputes, a
 * resolution moves no money. The admin records what the courier earned, and
 * the delivery's status and the courier's commission follow:
 *
 *   delivered      the delivery completes; commission on the whole price
 *   part           the delivery completes; commission on the part earned
 *   not_delivered  the delivery is cancelled; no commission (any cash the
 *                  courier collected is theirs to return, off the platform)
 *
 * A delivery paid through escrow needs a payment provider to refund or
 * release, which production does not have, so those are refused here.
 */

// External imports
import { Transaction } from 'sequelize';

// Internal imports
import { sequelize, QueryTypes } from '../config/database';
import { DeliveryAgreement, DeliveryStatus, DeliveryEvent } from '../models/DeliveryAgreement';
import { DeliveryDispute, DisputeStatus, DisputeType } from '../models/DeliveryDispute';
import CommissionLedger, { CommissionEntryType } from '../models/CommissionLedger';
import UserWallet from '../models/UserWallet';
import { Package } from '../models';
import { CommissionService } from './CommissionService';
import { notificationService } from './NotificationService';
import { formatMoneyInCurrency } from '../utils/money';
import { round2 } from '../utils/fees';
import { logInfo, logError } from '../utils/logger';

// Constants
export const DELIVERY_DISPUTE_OUTCOMES = ['delivered', 'part', 'not_delivered'] as const;
export type DeliveryDisputeOutcome = typeof DELIVERY_DISPUTE_OUTCOMES[number];
const DISPUTE_TYPES = Object.values(DisputeType) as string[];
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 1000;
const REASON_MIN = 5;
const REASON_MAX = 1000;
const MAX_EVIDENCE = 5;
/** A dispute may be raised once the courier has the package, or after delivery. */
const DISPUTABLE: string[] = [DeliveryStatus.IN_TRANSIT, DeliveryStatus.COMPLETED];

type Failure = { success: false; status: number; code: string; error: string };
const fail = (status: number, code: string, error: string): Failure => ({ success: false, status, code, error });

const name = (alias: string) => `NULLIF(TRIM(CONCAT(${alias}.first_name, ' ', ${alias}.last_name)), '')`;

const DISPUTE_SELECT = `
  SELECT d.id, d.dispute_type AS "disputeType", d.description, d.evidence_images AS "evidenceImages",
         d.status::text AS status, d.admin_notes AS "resolutionNotes",
         d.resolution_amount::float AS "courierEarned", d.resolved_at AS "resolvedAt", d.created_at AS "createdAt",
         ra.email AS "resolvedByEmail", ${name('ra')} AS "resolvedByName",
         d.raised_by_user_id AS "raisedById", ${name('rb')} AS "raisedByName",
         CASE WHEN d.raised_by_user_id = a.courier_id THEN 'courier' ELSE 'sender' END AS "raisedBy",
         a.id AS "agreementId", a.status::text AS "deliveryStatus", a.payment_method AS "paymentMethod",
         a.agreed_price::float AS price, a.platform_fee::float AS "platformFee", a.currency,
         a.pickup_confirmed_at AS "pickedUpAt", a.delivery_confirmed_at AS "deliveredAt",
         a.cash_collected_at AS "cashCollectedAt", a.created_at AS "acceptedAt",
         p.id AS "packageId", p.title AS "packageTitle", p.pickup_address AS "pickupAddress", p.dropoff_address AS "dropoffAddress",
         p.sender_id AS "senderId", ${name('s')} AS "senderName", s.phone_number AS "senderPhone",
         a.courier_id AS "courierId", ${name('c')} AS "courierName", c.phone_number AS "courierPhone"
    FROM delivery_disputes d
    JOIN delivery_agreements a ON a.id = d.delivery_agreement_id
    JOIN packages p ON p.id = a.package_id
    LEFT JOIN users s ON s.id = p.sender_id
    LEFT JOIN users c ON c.id = a.courier_id
    LEFT JOIN users rb ON rb.id = d.raised_by_user_id
    LEFT JOIN admin_users ra ON ra.id = d.resolved_by_admin_id`;

const OPEN_STATUSES = `('open', 'under_review')`;

/** Appends to an agreement's event log, which the admin panel shows as its timeline. */
const withEvent = (agreement: DeliveryAgreement, eventType: string, data: Record<string, unknown>, userId = ''): DeliveryEvent[] => [
  ...(agreement.eventLog ?? []),
  { timestamp: new Date().toISOString(), event_type: eventType, user_id: userId, data },
];

class DeliveryDisputeService {
  private commissionService = new CommissionService();

  /** A sender or courier reports a problem with a delivery. */
  async raise(
    userId: string,
    agreementId: string,
    input: { disputeType?: unknown; description?: unknown; evidenceImages?: unknown },
  ): Promise<{ success: true; disputeId: string } | Failure> {
    const disputeType = String(input.disputeType ?? '');
    if (!DISPUTE_TYPES.includes(disputeType)) {
      return fail(400, 'INVALID_TYPE', `disputeType must be one of ${DISPUTE_TYPES.join(', ')}`);
    }
    const description = typeof input.description === 'string' ? input.description.trim() : '';
    if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
      return fail(400, 'INVALID_DESCRIPTION', `Describe the problem in ${DESCRIPTION_MIN} to ${DESCRIPTION_MAX} characters`);
    }
    const evidence = input.evidenceImages ?? [];
    if (!Array.isArray(evidence) || evidence.length > MAX_EVIDENCE || evidence.some(e => typeof e !== 'string' || e.length > 2000)) {
      return fail(400, 'INVALID_EVIDENCE', `evidenceImages must be up to ${MAX_EVIDENCE} links`);
    }

    let otherPartyId = '';
    const result = await sequelize.transaction(async (t): Promise<{ success: true; disputeId: string } | Failure> => {
      const agreement = await DeliveryAgreement.findByPk(agreementId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!agreement) return fail(404, 'DELIVERY_NOT_FOUND', 'Delivery not found');
      const pkg = await Package.findByPk(agreement.packageId, { transaction: t });
      const isSender = pkg?.senderId === userId;
      const isCourier = agreement.courierId === userId;
      // Not found rather than forbidden: a stranger learns nothing about the delivery.
      if (!isSender && !isCourier) return fail(404, 'DELIVERY_NOT_FOUND', 'Delivery not found');

      const open = await DeliveryDispute.findOne({
        where: { deliveryAgreementId: agreementId, status: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW] },
        transaction: t,
      });
      if (open) return fail(409, 'DISPUTE_EXISTS', 'This delivery already has an open dispute');
      if (!DISPUTABLE.includes(agreement.status)) {
        return fail(409, 'NOT_DISPUTABLE', 'A problem can be reported once the courier has the package, or after delivery');
      }

      const dispute = await DeliveryDispute.create({
        deliveryAgreementId: agreementId,
        raisedByUserId: userId,
        disputeType,
        description,
        evidenceImages: evidence as string[],
        status: DisputeStatus.OPEN,
      } as any, { transaction: t });

      await agreement.update({
        status: DeliveryStatus.DISPUTED,
        eventLog: withEvent(agreement, 'dispute_raised', {
          dispute_id: dispute.id, dispute_type: disputeType, from: agreement.status, raised_by: isCourier ? 'courier' : 'sender',
        }, userId),
      }, { transaction: t });

      otherPartyId = isCourier ? (pkg?.senderId ?? '') : agreement.courierId;
      return { success: true as const, disputeId: dispute.id };
    });

    if (result.success && otherPartyId) {
      void notificationService.sendToUser(otherPartyId, {
        type: 'delivery_dispute_raised',
        title: 'A problem was reported with a delivery',
        message: 'ARYV will review it and tell you both what was decided.',
        data: { agreementId, disputeId: result.disputeId },
        timestamp: new Date().toISOString(),
      });
    }
    return result;
  }

  /** The latest dispute on a delivery, for the sender or the courier. */
  async forParticipant(userId: string, agreementId: string) {
    const [row] = await sequelize.query<Record<string, unknown>>(
      `${DISPUTE_SELECT}
        WHERE a.id = :agreementId AND (p.sender_id = :userId OR a.courier_id = :userId)
        ORDER BY d.created_at DESC LIMIT 1`,
      { type: QueryTypes.SELECT, replacements: { agreementId, userId } },
    );
    if (!row) return null;
    // Only what either party already knows, plus the decision.
    const { id, disputeType, description, status, resolutionNotes, courierEarned, resolvedAt, createdAt, raisedBy, currency } = row;
    return { id, disputeType, description, status, resolutionNotes, courierEarned, resolvedAt, createdAt, raisedBy, currency };
  }

  /** Open disputes first, oldest open first, then the newest resolved. */
  async list(params: { status?: 'open' | 'resolved' | undefined; page: number; limit: number }) {
    const where = params.status === 'open'
      ? `WHERE d.status::text IN ${OPEN_STATUSES}`
      : params.status === 'resolved' ? `WHERE d.status::text NOT IN ${OPEN_STATUSES}` : '';
    const replacements = { limit: params.limit, offset: (params.page - 1) * params.limit };
    const [disputes, [{ total }]] = await Promise.all([
      sequelize.query(
        `${DISPUTE_SELECT} ${where}
          ORDER BY (d.status::text IN ${OPEN_STATUSES}) DESC,
                   CASE WHEN d.status::text IN ${OPEN_STATUSES} THEN d.created_at END ASC,
                   d.created_at DESC
          LIMIT :limit OFFSET :offset`,
        { type: QueryTypes.SELECT, replacements },
      ),
      sequelize.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM delivery_disputes d ${where}`,
        { type: QueryTypes.SELECT },
      ),
    ]);
    return { disputes, pagination: { page: params.page, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) } };
  }

  /** One dispute, with the delivery's timeline and the commission charged on it. */
  async get(id: string) {
    const [dispute] = await sequelize.query<Record<string, any>>(
      `${DISPUTE_SELECT} WHERE d.id = :id`,
      { type: QueryTypes.SELECT, replacements: { id } },
    );
    if (!dispute) return null;
    const [[timeline], commission] = await Promise.all([
      sequelize.query<{ events: DeliveryEvent[] | null }>(
        'SELECT event_log AS events FROM delivery_agreements WHERE id = :agreementId',
        { type: QueryTypes.SELECT, replacements: { agreementId: dispute['agreementId'] } },
      ),
      sequelize.query(
        `SELECT entry_type AS "entryType", amount::float AS amount, description, created_at AS "createdAt"
           FROM commission_ledger
          WHERE metadata->>'deliveryAgreementId' = :agreementId
          ORDER BY created_at ASC`,
        { type: QueryTypes.SELECT, replacements: { agreementId: dispute['agreementId'] } },
      ),
    ]);
    // Event data can hold verification details (codes, coordinates); the
    // timeline needs what happened and when.
    const events = (timeline?.events ?? []).map(e => ({ timestamp: e.timestamp, type: e.event_type, byUserId: e.user_id || null }));
    return { ...dispute, timeline: events, commission };
  }

  /** Commission currently charged for one delivery: accruals less reversals. */
  private async chargedFor(agreementId: string, t: Transaction): Promise<number> {
    const [row] = await sequelize.query<{ charged: number }>(
      `SELECT COALESCE(SUM(CASE WHEN entry_type = 'accrual' THEN amount ELSE -amount END), 0)::float AS charged
         FROM commission_ledger
        WHERE metadata->>'deliveryAgreementId' = :agreementId AND entry_type IN ('accrual', 'waiver')`,
      { type: QueryTypes.SELECT, replacements: { agreementId }, transaction: t },
    );
    return round2(row?.charged ?? 0);
  }

  async resolve(
    id: string,
    adminId: string,
    input: { outcome?: unknown; reason?: unknown; courierEarned?: unknown },
  ): Promise<{ success: true; outcome: DeliveryDisputeOutcome; commissionBefore: number; commissionAfter: number } | Failure> {
    const outcome = input.outcome as DeliveryDisputeOutcome;
    if (!DELIVERY_DISPUTE_OUTCOMES.includes(outcome)) {
      return fail(400, 'INVALID_OUTCOME', `outcome must be one of ${DELIVERY_DISPUTE_OUTCOMES.join(', ')}`);
    }
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if (reason.length < REASON_MIN || reason.length > REASON_MAX) {
      return fail(400, 'REASON_REQUIRED', `Give a reason of ${REASON_MIN} to ${REASON_MAX} characters`);
    }

    let notify: { senderId: string; courierId: string; earned: number; price: number; currency: string; title: string } | null = null;
    const result = await sequelize.transaction(async (t) => {
      const dispute = await DeliveryDispute.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!dispute) return fail(404, 'DISPUTE_NOT_FOUND', 'Dispute not found');
      if (!dispute.canBeResolved()) return fail(409, 'ALREADY_RESOLVED', 'This dispute has already been resolved');

      const agreement = await DeliveryAgreement.findByPk(dispute.deliveryAgreementId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!agreement) return fail(404, 'DELIVERY_NOT_FOUND', 'The disputed delivery no longer exists');
      if ((agreement.paymentMethod ?? 'cash_on_delivery') !== 'cash_on_delivery') {
        return fail(409, 'ESCROW_NOT_SUPPORTED', 'This delivery was paid through escrow, which needs a payment provider to refund or release. Resolve it with the payment provider.');
      }

      const price = Number(agreement.agreedPrice);
      let earned: number;
      if (outcome === 'part') {
        const amount = Number(input.courierEarned);
        if (!Number.isFinite(amount) || amount <= 0 || amount >= price) {
          return fail(400, 'INVALID_AMOUNT', `courierEarned must be more than 0 and less than the price (${price.toFixed(2)})`);
        }
        earned = round2(amount);
      } else {
        earned = outcome === 'delivered' ? price : 0;
      }

      const target = price > 0 ? round2(Number(agreement.platformFee) * (earned / price)) : 0;
      const before = await this.chargedFor(agreement.id, t);
      const delta = round2(target - before);
      const metadata = { deliveryAgreementId: agreement.id, deliveryDisputeId: dispute.id, outcome };

      if (delta > 0) {
        await this.commissionService.accrueCommission(agreement.courierId, delta, null, t, {
          description: 'Commission after a delivery dispute',
          metadata,
        });
      } else if (delta < 0) {
        let wallet = await UserWallet.findOne({ where: { userId: agreement.courierId }, transaction: t, lock: t.LOCK.UPDATE });
        if (!wallet) wallet = await UserWallet.create({ userId: agreement.courierId }, { transaction: t });
        // May go below zero when the courier had already paid it: a credit.
        const newOwed = round2(Number(wallet.commissionOwed) + delta);
        await wallet.update({ commissionOwed: newOwed }, { transaction: t });
        await CommissionLedger.create({
          driverId: agreement.courierId,
          entryType: CommissionEntryType.WAIVER,
          amount: -delta,
          balanceAfter: newOwed,
          cashTransactionId: null,
          recordedBy: adminId,
          description: 'Commission reversed after a delivery dispute',
          metadata,
        }, { transaction: t });
      }

      const completed = earned > 0;
      await agreement.update({
        status: completed ? DeliveryStatus.COMPLETED : DeliveryStatus.CANCELLED,
        ...(completed && !agreement.deliveryConfirmedAt ? { deliveryConfirmedAt: new Date() } : {}),
        eventLog: withEvent(agreement, 'dispute_resolved', { dispute_id: dispute.id, outcome, courier_earned: earned }),
      }, { transaction: t });

      await dispute.update({
        status: DisputeStatus.RESOLVED,
        resolutionAmount: earned,
        adminNotes: reason,
        resolvedByAdminId: adminId,
        resolvedAt: new Date(),
      }, { transaction: t });

      const pkg = await Package.findByPk(agreement.packageId, { transaction: t });
      notify = {
        senderId: pkg?.senderId ?? '', courierId: agreement.courierId, earned, price,
        currency: agreement.currency, title: pkg?.title ?? 'your delivery',
      };
      logInfo('Delivery dispute resolved', { disputeId: id, outcome, earned, commissionBefore: before, commissionAfter: target, adminId });
      return { success: true as const, outcome, commissionBefore: before, commissionAfter: target };
    });

    if (result.success && notify) void this.notifyParties(id, outcome, reason, notify);
    return result;
  }

  private async notifyParties(
    disputeId: string,
    outcome: DeliveryDisputeOutcome,
    reason: string,
    n: { senderId: string; courierId: string; earned: number; price: number; currency: string; title: string },
  ): Promise<void> {
    try {
      const [earned, price] = await Promise.all([
        formatMoneyInCurrency(n.earned, n.currency),
        formatMoneyInCurrency(n.price, n.currency),
      ]);
      const decided = {
        delivered: `ARYV found "${n.title}" was delivered as agreed (${price}).`,
        part: `ARYV found the courier earned ${earned} of the ${price} price for "${n.title}".`,
        not_delivered: `ARYV found "${n.title}" was not delivered, so the delivery has been cancelled.`,
      }[outcome];
      const notification = {
        type: 'delivery_dispute_resolved',
        title: 'Your delivery dispute was resolved',
        message: `${decided} Reason: ${reason}`,
        data: { disputeId, outcome },
        timestamp: new Date().toISOString(),
      };
      await Promise.all([n.senderId, n.courierId].filter(Boolean).map(u => notificationService.sendToUser(u, notification)));
    } catch (error) {
      logError('Could not notify the parties to a resolved delivery dispute', error as Error, { disputeId });
    }
  }
}

export const deliveryDisputeService = new DeliveryDisputeService();
export default DeliveryDisputeService;
