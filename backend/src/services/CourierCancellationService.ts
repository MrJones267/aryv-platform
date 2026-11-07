/**
 * @fileoverview Cancelling a courier delivery, by the sender or the courier
 * @author Oabona-Majoko
 * @created 2026-11-07
 * @lastModified 2026-11-07
 *
 * There was no way to cancel anything. A sender could not withdraw a package
 * nobody had taken, nor drop a courier who accepted and never came; a courier
 * could not hand back a delivery they could not do. CourierEscrowService.
 * cancelDelivery existed, but nothing called it, so such a delivery waited
 * for pickup for ever.
 *
 *   sender, nobody has accepted        -> the package is withdrawn
 *   sender, accepted but not picked up -> that courier is dropped, and the
 *                                         package is withdrawn or reopened
 *   courier, accepted but not picked up -> the delivery is handed back and
 *                                         the package reopens for others
 *   once picked up                      -> refused: the package is with the
 *                                         courier, so it is a dispute
 *
 * The other party is notified. Every check and write happens under a row
 * lock in one transaction, so a cancel cannot race a pickup.
 */

import { Op, Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import { DeliveryAgreement, DeliveryStatus } from '../models/DeliveryAgreement';
import Package from '../models/Package';
import courierEscrowService from './CourierEscrowService';
import { notificationService } from './NotificationService';
import { logInfo, logError } from '../utils/logger';

/** A reopened package stays visible to couriers for at least this long. */
const REOPEN_MIN_HOURS = 24;

export interface CancelRefusal {
  ok: false;
  status: number;
  code: string;
  error: string;
}

export interface SenderCancelResult {
  ok: true;
  packageState: 'withdrawn' | 'reopened';
  cancelledDeliveryId: string | null;
}

export interface CourierCancelResult {
  ok: true;
  packageState: 'reopened';
}

const refuse = (status: number, code: string, error: string): CancelRefusal => ({ ok: false, status, code, error });

/** Why a delivery past pickup cannot simply be cancelled. */
const refusalForStatus = (status: DeliveryStatus): CancelRefusal | null => {
  switch (status) {
    case DeliveryStatus.IN_TRANSIT:
      return refuse(409, 'DELIVERY_IN_TRANSIT',
        'The courier already has the package, so it cannot be cancelled. Raise a dispute instead.');
    case DeliveryStatus.COMPLETED:
      return refuse(409, 'DELIVERY_COMPLETED', 'This delivery is already complete.');
    case DeliveryStatus.DISPUTED:
      return refuse(409, 'DELIVERY_DISPUTED', 'This delivery is under dispute; ARYV support will resolve it.');
    default:
      return null;
  }
};

/** Make sure a reopened package does not vanish from couriers at once. */
const keepVisible = (pkg: Package): void => {
  const floor = new Date(Date.now() + REOPEN_MIN_HOURS * 60 * 60 * 1000);
  if (pkg.expiresAt && pkg.expiresAt < floor) {
    pkg.expiresAt = floor;
  }
};

const notify = async (userId: string, title: string, message: string, data: Record<string, unknown>): Promise<void> => {
  try {
    await notificationService.sendToUser(userId, {
      type: 'delivery_cancelled',
      title,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logError('Could not notify about a cancelled delivery', error as Error, { userId, ...data });
  }
};

export class CourierCancellationService {
  /**
   * The sender withdraws their package, or drops the courier who accepted
   * it and either withdraws it or reopens it for another courier.
   */
  async cancelBySender(
    packageId: string,
    userId: string,
    options: { reason?: string; findAnotherCourier?: boolean } = {},
  ): Promise<SenderCancelResult | CancelRefusal> {
    const t = await sequelize.transaction();
    let droppedCourierId: string | null = null;
    try {
      const pkg = await Package.findByPk(packageId, { transaction: t, lock: Transaction.LOCK.UPDATE });
      // Anyone but the sender is told it does not exist.
      if (!pkg || pkg.senderId !== userId) {
        await t.rollback();
        return refuse(404, 'PACKAGE_NOT_FOUND', 'Package not found');
      }

      const live = await DeliveryAgreement.findOne({
        where: { packageId, status: { [Op.ne]: DeliveryStatus.CANCELLED } },
        order: [['createdAt', 'DESC']],
        transaction: t,
        lock: Transaction.LOCK.UPDATE,
      });

      if (live) {
        const refusal = refusalForStatus(live.status);
        if (refusal) {
          await t.rollback();
          return refusal;
        }
      } else if (!pkg.isActive) {
        await t.rollback();
        return refuse(409, 'PACKAGE_ALREADY_WITHDRAWN', 'This package has already been withdrawn.');
      }

      let cancelledDeliveryId: string | null = null;
      if (live) {
        // Waiting for pickup: drop the courier. cancelDelivery reopens the
        // package; it is closed again below unless another courier is wanted.
        await courierEscrowService.cancelDelivery(
          live.id,
          options.reason?.trim() || 'Cancelled by the sender before pickup',
          userId,
          t,
        );
        cancelledDeliveryId = live.id;
        droppedCourierId = live.courierId;
        await pkg.reload({ transaction: t });
      }

      const reopen = Boolean(live && options.findAnotherCourier);
      pkg.isActive = reopen;
      if (reopen) keepVisible(pkg);
      await pkg.save({ transaction: t });
      await t.commit();

      logInfo('Package cancelled by sender', { packageId, cancelledDeliveryId, reopened: reopen });
      if (droppedCourierId) {
        await notify(
          droppedCourierId,
          'Delivery cancelled',
          `The sender cancelled the delivery of "${pkg.title}". You do not need to collect it.`,
          { packageId, deliveryAgreementId: cancelledDeliveryId },
        );
      }
      return { ok: true, packageState: reopen ? 'reopened' : 'withdrawn', cancelledDeliveryId };
    } catch (error) {
      await t.rollback();
      logError('Error cancelling a package for its sender', error as Error, { packageId, userId });
      return refuse(500, 'CANCEL_FAILED', 'Could not cancel this package');
    }
  }

  /** The courier hands back a delivery they have accepted but not picked up. */
  async cancelByCourier(
    agreementId: string,
    userId: string,
    options: { reason?: string } = {},
  ): Promise<CourierCancelResult | CancelRefusal> {
    const t = await sequelize.transaction();
    try {
      const agreement = await DeliveryAgreement.findByPk(agreementId, {
        transaction: t,
        lock: Transaction.LOCK.UPDATE,
      });
      if (!agreement || agreement.courierId !== userId) {
        await t.rollback();
        return refuse(404, 'DELIVERY_NOT_FOUND', 'Delivery not found');
      }
      if (agreement.status === DeliveryStatus.CANCELLED) {
        await t.rollback();
        return refuse(409, 'DELIVERY_CANCELLED', 'This delivery is already cancelled.');
      }
      const refusal = refusalForStatus(agreement.status);
      if (refusal) {
        await t.rollback();
        return refusal;
      }

      await courierEscrowService.cancelDelivery(
        agreement.id,
        options.reason?.trim() || 'Handed back by the courier before pickup',
        userId,
        t,
      );
      const pkg = await Package.findByPk(agreement.packageId, { transaction: t, lock: Transaction.LOCK.UPDATE });
      if (pkg) {
        pkg.isActive = true;
        keepVisible(pkg);
        await pkg.save({ transaction: t });
      }
      await t.commit();

      logInfo('Delivery handed back by courier', { agreementId, packageId: agreement.packageId });
      if (pkg) {
        await notify(
          pkg.senderId,
          'Courier cancelled',
          `Your courier can no longer deliver "${pkg.title}". It is open again for another courier to accept.`,
          { packageId: pkg.id, deliveryAgreementId: agreement.id },
        );
      }
      return { ok: true, packageState: 'reopened' };
    } catch (error) {
      await t.rollback();
      logError('Error handing back a delivery', error as Error, { agreementId, userId });
      return refuse(500, 'CANCEL_FAILED', 'Could not cancel this delivery');
    }
  }
}

export const courierCancellationService = new CourierCancellationService();
export default courierCancellationService;
