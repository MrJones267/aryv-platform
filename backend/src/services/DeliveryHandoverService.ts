/**
 * @fileoverview Delivery handover protocol — issuing a confirmation code at
 *               pickup and verifying it at the door.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * The problem this solves: a package's recipient is a name and a phone number
 * on the package, not an account. There is usually no recipient app, so
 * "the recipient confirms in the app" is not available, and the courier
 * confirming their own delivery is worthless as evidence — it is the courier
 * who is paid when the delivery completes.
 *
 * The protocol:
 *
 *   1. The courier confirms pickup. A code is generated and sent by SMS to the
 *      recipient. It is never returned to the courier, in any response.
 *   2. At the door the recipient reads the code out.
 *   3. The courier submits it. The escrow releases.
 *
 * The security property is only that the courier cannot know the code in
 * advance, so possessing it is evidence they reached the recipient. That makes
 * two things load-bearing, and both are enforced below: the code must never
 * reach the courier through any other path, and it must not be guessable —
 * which, for a code short enough to read aloud, means capping attempts rather
 * than relying on length alone.
 *
 * What this deliberately does not claim: it does not prove the package was
 * handed over, only that the courier reached someone holding the recipient's
 * phone. A recipient who reads their code out over the phone defeats it. That
 * is the same trust model as every other courier PIN, and disputes exist for
 * the rest.
 */

import crypto from 'crypto';
import { Op, Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import { DeliveryQRCode, QRCodeStatus } from '../models/DeliveryQRCode';
import { DeliveryAgreement, DeliveryStatus } from '../models/DeliveryAgreement';
import Package from '../models/Package';
import User from '../models/User';
import smsService from './SMSService';
import { logInfo, logError, logWarning } from '../utils/logger';
import { formatMoneyForUser } from '../utils/money';

/**
 * Unambiguous alphabet: no O/0, I/1, S/5, B/8. Codes get read aloud down a
 * phone line and typed by someone standing in a doorway.
 */
const CODE_ALPHABET = 'ACDEFGHJKLMNPQRTUVWXYZ234679';
const CODE_LENGTH = 6;

/** How long a code stays good for. Long enough for a same-day delivery. */
export const CODE_TTL_HOURS = 24;

/**
 * Wrong submissions before the code locks. With a 6-character code from a
 * 26-symbol alphabet there are ~309 million possibilities, so five attempts is
 * generous; the cap exists so an unbounded guessing loop is not on the table.
 */
export const MAX_FAILED_ATTEMPTS = 5;

export interface IssueCodeResult {
  success: boolean;
  /** Never returned to the courier — for logs and tests only. */
  codeId?: string;
  channel?: 'recipient_sms' | 'sender_sms' | 'none';
  sentTo?: string | null;
  error?: string;
}

export interface VerifyResult {
  ok: boolean;
  agreement?: DeliveryAgreement;
  error?: string;
  code?: string;
}

const generateCode = (): string => {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return out;
};

export class DeliveryHandoverService {
  /**
   * Issue a handover code for an agreement and send it to the recipient.
   *
   * Called when pickup is confirmed. Failure to send is not fatal to the
   * pickup: the delivery is already physically in progress, and refusing to
   * record that because an SMS bounced would be worse. The channel is recorded
   * so a dispute can see what happened.
   */
  async issueCode(
    agreementId: string,
    transaction?: Transaction,
  ): Promise<IssueCodeResult> {
    try {
      const agreement = await DeliveryAgreement.findByPk(agreementId, {
        ...(transaction ? { transaction } : {}),
      });

      if (!agreement) {
        return { success: false, error: 'Delivery agreement not found' };
      }

      const packageData = await Package.findByPk(agreement.packageId, {
        ...(transaction ? { transaction } : {}),
      });

      if (!packageData) {
        return { success: false, error: 'Package not found' };
      }

      // Supersede any code still outstanding for this agreement, so a reissue
      // cannot leave two working codes in circulation.
      await DeliveryQRCode.update(
        { status: QRCodeStatus.EXPIRED },
        {
          where: {
            deliveryAgreementId: agreementId,
            status: QRCodeStatus.ACTIVE,
          },
          ...(transaction ? { transaction } : {}),
        },
      );

      // Codes are short, so collisions are possible; retry rather than fail.
      let record: DeliveryQRCode | null = null;
      let code = '';
      for (let attempt = 0; attempt < 5 && !record; attempt += 1) {
        code = generateCode();
        try {
          record = await DeliveryQRCode.create(
            {
              deliveryAgreementId: agreementId,
              qrToken: code,
              status: QRCodeStatus.ACTIVE,
              generatedAt: new Date(),
              expiresAt: new Date(Date.now() + CODE_TTL_HOURS * 60 * 60 * 1000),
            },
            { ...(transaction ? { transaction } : {}) },
          );
        } catch (error) {
          const name = (error as { name?: string }).name;
          if (name !== 'SequelizeUniqueConstraintError') throw error;
        }
      }

      if (!record) {
        return { success: false, error: 'Could not allocate a handover code' };
      }

      // Prefer the recipient. Falling back to the sender keeps the delivery
      // completable when no dropoff contact was given — the sender can pass
      // the code on — and is recorded so it is visible in a dispute.
      let channel: 'recipient_sms' | 'sender_sms' | 'none' = 'none';
      let destination: string | null = packageData.dropoffContactPhone ?? null;

      // Fetched regardless: the sender's country is what makes a locally
      // written recipient number resolvable, not just a fallback destination.
      const sender = await User.findByPk(packageData.senderId, {
        ...(transaction ? { transaction } : {}),
      });

      if (destination) {
        channel = 'recipient_sms';
      } else if (sender?.phone) {
        destination = sender.phone;
        channel = 'sender_sms';
      }

      if (destination) {
        const recipient = packageData.dropoffContactName || 'there';

        // The sender's country resolves a locally-written number. Without it a
        // dropoff contact entered as 71234567 never receives the code, and the
        // courier arrives at a door where nobody can complete the delivery.
        const senderCountry = (sender as unknown as { countryCode?: string })?.countryCode;

        // On cash on delivery the recipient has to know what to pay before the
        // courier arrives. A code with no amount attached leaves them working
        // it out at the door, with the courier as the only source of the
        // figure — which is the wrong party to take it from.
        const isCash = (agreement.paymentMethod ?? 'cash_on_delivery') === 'cash_on_delivery';
        const amountDue = isCash
          ? await formatMoneyForUser(agreement.agreedPrice, packageData.senderId)
          : null;

        const sent = await smsService.sendMessage(
          destination,
          `ARYV: Hi ${recipient}, your delivery code is ${code}.`
            + (amountDue ? ` Amount due on delivery: ${amountDue}.` : '')
            + ' Give the code to the courier only once you have paid and have your package.'
            + ` Valid for ${CODE_TTL_HOURS} hours.`,
          senderCountry,
        );

        await record.update(
          {
            sentToPhone: destination,
            sentAt: new Date(),
            deliveryChannel: channel,
          },
          { ...(transaction ? { transaction } : {}) },
        );

        if (!sent) {
          logWarning('Handover code generated but SMS was not delivered', {
            agreementId,
            channel,
          });
        }
      } else {
        await record.update(
          { deliveryChannel: 'none' },
          { ...(transaction ? { transaction } : {}) },
        );
        logWarning('Handover code generated with no phone number to send it to', {
          agreementId,
          packageId: packageData.id,
        });
      }

      logInfo('Handover code issued', {
        agreementId,
        codeId: record.id,
        channel,
        // The code itself is deliberately absent: logs are read by staff, and
        // anyone who can read a code can complete a delivery.
      });

      return {
        success: true,
        codeId: record.id,
        channel,
        sentTo: destination,
      };
    } catch (error) {
      logError('Error issuing handover code', error as Error, { agreementId });
      return { success: false, error: 'Could not issue handover code' };
    }
  }

  /**
   * Verify a code submitted by the courier at handover.
   *
   * The caller must be the courier assigned to the agreement. Without that,
   * anyone who learned a code — including a different courier — could complete
   * someone else's delivery and collect on it.
   */
  async verifyCode(
    submittedCode: string,
    submittedByUserId: string,
    location?: [number, number],
    transaction?: Transaction,
  ): Promise<VerifyResult> {
    const t = transaction || (await sequelize.transaction());
    const ownTransaction = !transaction;

    try {
      const normalised = (submittedCode || '').trim().toUpperCase();

      const record = await DeliveryQRCode.findOne({
        where: { qrToken: normalised },
        transaction: t,
      });

      if (!record) {
        if (ownTransaction) await t.rollback();
        return { ok: false, error: 'That code is not valid', code: 'CODE_NOT_FOUND' };
      }

      const agreement = await DeliveryAgreement.findByPk(record.deliveryAgreementId, {
        transaction: t,
      });

      if (!agreement) {
        if (ownTransaction) await t.rollback();
        return { ok: false, error: 'That code is not valid', code: 'CODE_NOT_FOUND' };
      }

      // Identity first: a code belonging to somebody else's delivery must not
      // even report whether it was correct.
      if (agreement.courierId !== submittedByUserId) {
        logWarning('Handover code submitted by someone other than the courier', {
          agreementId: agreement.id,
          submittedByUserId,
        });
        if (ownTransaction) await t.rollback();
        return { ok: false, error: 'That code is not valid', code: 'CODE_NOT_FOUND' };
      }

      if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        if (ownTransaction) await t.rollback();
        return {
          ok: false,
          error: 'Too many incorrect attempts. Raise a dispute to complete this delivery.',
          code: 'CODE_LOCKED',
        };
      }

      if (record.status === QRCodeStatus.USED) {
        if (ownTransaction) await t.rollback();
        return { ok: false, error: 'That code has already been used', code: 'CODE_ALREADY_USED' };
      }

      if (record.status !== QRCodeStatus.ACTIVE || record.expiresAt.getTime() <= Date.now()) {
        if (record.status === QRCodeStatus.ACTIVE) {
          await record.update({ status: QRCodeStatus.EXPIRED }, { transaction: t });
        }
        if (ownTransaction) await t.commit();
        return { ok: false, error: 'That code has expired', code: 'CODE_EXPIRED' };
      }

      if (agreement.status !== DeliveryStatus.IN_TRANSIT) {
        if (ownTransaction) await t.rollback();
        return {
          ok: false,
          error: `This delivery is ${agreement.status}, so it cannot be confirmed`,
          code: 'DELIVERY_NOT_IN_TRANSIT',
        };
      }

      await record.update(
        {
          status: QRCodeStatus.USED,
          scannedAt: new Date(),
          scannedByUserId: submittedByUserId,
          ...(location ? { scanLocation: location } : {}),
          verificationData: {
            confirmed_at: new Date().toISOString(),
            confirmed_by: submittedByUserId,
            ...(location ? { location } : {}),
          },
        },
        { transaction: t },
      );

      if (ownTransaction) await t.commit();

      logInfo('Handover code verified', {
        agreementId: agreement.id,
        courierId: submittedByUserId,
      });

      return { ok: true, agreement };
    } catch (error) {
      if (ownTransaction) await t.rollback();
      logError('Error verifying handover code', error as Error, { submittedByUserId });
      return { ok: false, error: 'Could not verify that code', code: 'VERIFY_FAILED' };
    }
  }

  /**
   * Record a failed attempt against whichever code the courier was trying.
   *
   * Kept separate from verifyCode so the increment survives that call's
   * rollback — otherwise a failed attempt would roll back along with it and
   * the cap would never be reached.
   */
  async recordFailedAttempt(agreementId: string): Promise<void> {
    try {
      await DeliveryQRCode.increment('failedAttempts', {
        by: 1,
        where: {
          deliveryAgreementId: agreementId,
          status: QRCodeStatus.ACTIVE,
        },
      });
    } catch (error) {
      logError('Could not record failed handover attempt', error as Error, { agreementId });
    }
  }

  /** Expire codes whose window has passed. For the scheduled sweep. */
  async expireStaleCodes(): Promise<number> {
    const [count] = await DeliveryQRCode.update(
      { status: QRCodeStatus.EXPIRED },
      {
        where: {
          status: QRCodeStatus.ACTIVE,
          expiresAt: { [Op.lt]: new Date() },
        },
      },
    );
    if (count > 0) logInfo('Expired stale handover codes', { count });
    return count;
  }
}

export const deliveryHandoverService = new DeliveryHandoverService();
export default deliveryHandoverService;
