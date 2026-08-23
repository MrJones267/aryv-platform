/**
 * @fileoverview Unit tests for the delivery handover protocol.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * The protocol rests on one property: the courier cannot know the code before
 * they reach the recipient. Everything else follows from it, so the tests
 * concentrate there — the code never appears in anything the courier receives,
 * only the assigned courier can spend it, and it cannot be guessed at leisure.
 */

import { sequelize } from '../../config/database';
import {
  DeliveryHandoverService,
  MAX_FAILED_ATTEMPTS,
} from '../../services/DeliveryHandoverService';
import { DeliveryQRCode, QRCodeStatus } from '../../models/DeliveryQRCode';
import { DeliveryAgreement, DeliveryStatus } from '../../models/DeliveryAgreement';
import Package from '../../models/Package';
import User from '../../models/User';
import smsService from '../../services/SMSService';

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
  logWarn: jest.fn(),
}));

const AGREEMENT_ID = 'agreement-1';
const COURIER_ID = 'courier-1';
const OTHER_COURIER_ID = 'courier-2';
const SENDER_ID = 'sender-1';

const makeAgreement = (overrides: Record<string, unknown> = {}) => ({
  id: AGREEMENT_ID,
  packageId: 'package-1',
  courierId: COURIER_ID,
  status: DeliveryStatus.IN_TRANSIT,
  agreedPrice: 120,
  paymentMethod: 'cash_on_delivery',
  ...overrides,
});

const makePackage = (overrides: Record<string, unknown> = {}) => ({
  id: 'package-1',
  senderId: SENDER_ID,
  dropoffContactName: 'Naledi',
  dropoffContactPhone: '+26771234567',
  ...overrides,
});

const makeCode = (overrides: Record<string, unknown> = {}) => ({
  id: 'code-1',
  deliveryAgreementId: AGREEMENT_ID,
  qrToken: 'AC24GH',
  status: QRCodeStatus.ACTIVE,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  failedAttempts: 0,
  update: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('DeliveryHandoverService', () => {
  let service: DeliveryHandoverService;
  let mockTx: { commit: jest.Mock; rollback: jest.Mock };
  let created: any[];

  beforeEach(() => {
    service = new DeliveryHandoverService();
    created = [];
    mockTx = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(sequelize, 'transaction').mockResolvedValue(mockTx as any);

    jest.spyOn(DeliveryAgreement, 'findByPk').mockResolvedValue(makeAgreement() as any);
    jest.spyOn(DeliveryAgreement, 'findOne').mockResolvedValue(makeAgreement() as any);
    jest.spyOn(Package, 'findByPk').mockResolvedValue(makePackage() as any);
    jest.spyOn(User, 'findByPk').mockResolvedValue({
      id: SENDER_ID,
      phone: '+26777654321',
      countryCode: 'BW',
    } as any);
    jest.spyOn(DeliveryQRCode, 'update').mockResolvedValue([0] as any);
    jest.spyOn(DeliveryQRCode, 'increment').mockResolvedValue([[], 0] as any);
    jest.spyOn(DeliveryQRCode, 'create').mockImplementation((async (values: any) => {
      const row = { ...makeCode(), ...values, update: jest.fn().mockResolvedValue(undefined) };
      created.push(row);
      return row;
    }) as any);
    jest.spyOn(smsService, 'sendMessage').mockResolvedValue(true);
  });

  describe('issuing a code', () => {
    it('sends the code to the recipient, not the courier', async () => {
      const result = await service.issueCode(AGREEMENT_ID);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('recipient_sms');
      expect(smsService.sendMessage).toHaveBeenCalledWith(
        '+26771234567',
        expect.stringContaining(created[0].qrToken),
        expect.anything(),
      );
    });

    it('never returns the code to its caller', async () => {
      // The caller is the courier's own pickup request. If the code came back
      // in that response the whole protocol would be decorative.
      const result = await service.issueCode(AGREEMENT_ID);

      expect(JSON.stringify(result)).not.toContain(created[0].qrToken);
    });

    it('generates a code from an unambiguous alphabet', async () => {
      await service.issueCode(AGREEMENT_ID);

      // Read aloud down a phone line and typed in a doorway: no O/0, I/1,
      // S/5 or B/8.
      expect(created[0].qrToken).toMatch(/^[ACDEFGHJKLMNPQRTUVWXYZ234679]{6}$/);
    });

    it('supersedes any code still outstanding for the delivery', async () => {
      await service.issueCode(AGREEMENT_ID);

      expect(DeliveryQRCode.update).toHaveBeenCalledWith(
        { status: QRCodeStatus.EXPIRED },
        expect.objectContaining({
          where: expect.objectContaining({
            deliveryAgreementId: AGREEMENT_ID,
            status: QRCodeStatus.ACTIVE,
          }),
        }),
      );
    });

    it('falls back to the sender when the package has no dropoff phone', async () => {
      jest.spyOn(Package, 'findByPk').mockResolvedValue(
        makePackage({ dropoffContactPhone: null }) as any,
      );

      const result = await service.issueCode(AGREEMENT_ID);

      expect(result.channel).toBe('sender_sms');
      expect(smsService.sendMessage).toHaveBeenCalledWith(
        '+26777654321',
        expect.any(String),
        expect.anything(),
      );
    });

    it('tells the recipient what to pay on a cash delivery', async () => {
      // Without the amount the recipient works it out at the door, with the
      // courier as the only source of the figure — the wrong party to take it
      // from.
      await service.issueCode(AGREEMENT_ID);

      const [, body] = (smsService.sendMessage as jest.Mock).mock.calls[0];
      expect(body).toMatch(/Amount due on delivery: .*120/);
    });

    it('quotes no amount on an escrow delivery, where nothing is owed at the door', async () => {
      jest.spyOn(DeliveryAgreement, 'findByPk').mockResolvedValue(
        makeAgreement({ paymentMethod: 'escrow' }) as any,
      );

      await service.issueCode(AGREEMENT_ID);

      const [, body] = (smsService.sendMessage as jest.Mock).mock.calls[0];
      expect(body).not.toMatch(/Amount due/);
    });

    it('still issues a code when the amount cannot be formatted', async () => {
      // A formatting problem must not lose the code: the delivery is already
      // under way and the code matters more than the amount line.
      jest.spyOn(DeliveryAgreement, 'findByPk').mockResolvedValue(
        makeAgreement({ agreedPrice: undefined }) as any,
      );

      const result = await service.issueCode(AGREEMENT_ID);

      expect(result.success).toBe(true);
      expect(smsService.sendMessage).toHaveBeenCalled();
    });

    it('still issues a code when there is no number to send it to', async () => {
      jest.spyOn(Package, 'findByPk').mockResolvedValue(
        makePackage({ dropoffContactPhone: null }) as any,
      );
      jest.spyOn(User, 'findByPk').mockResolvedValue({
        id: SENDER_ID,
        phone: null,
        countryCode: 'BW',
      } as any);

      const result = await service.issueCode(AGREEMENT_ID);

      // The delivery is physically under way; refusing to record that because
      // there was nobody to text would be worse than recording it.
      expect(result.success).toBe(true);
      expect(result.channel).toBe('none');
      expect(smsService.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('verifying a code', () => {
    it('accepts the assigned courier presenting a valid code', async () => {
      jest.spyOn(DeliveryQRCode, 'findOne').mockResolvedValue(makeCode() as any);

      const result = await service.verifyCode('AC24GH', COURIER_ID);

      expect(result.ok).toBe(true);
      expect(result.agreement?.id).toBe(AGREEMENT_ID);
    });

    it('is case-insensitive and tolerates surrounding whitespace', async () => {
      jest.spyOn(DeliveryQRCode, 'findOne').mockResolvedValue(makeCode() as any);

      const result = await service.verifyCode('  ac24gh ', COURIER_ID);

      expect(result.ok).toBe(true);
      expect(DeliveryQRCode.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { qrToken: 'AC24GH' } }),
      );
    });

    it('refuses a courier the delivery does not belong to', async () => {
      jest.spyOn(DeliveryQRCode, 'findOne').mockResolvedValue(makeCode() as any);

      const result = await service.verifyCode('AC24GH', OTHER_COURIER_ID);

      expect(result.ok).toBe(false);
      // Deliberately indistinguishable from an unknown code: otherwise the
      // endpoint confirms which codes are real to anyone holding one.
      expect(result.code).toBe('CODE_NOT_FOUND');
    });

    it('refuses a code that has already been spent', async () => {
      jest.spyOn(DeliveryQRCode, 'findOne').mockResolvedValue(
        makeCode({ status: QRCodeStatus.USED }) as any,
      );

      const result = await service.verifyCode('AC24GH', COURIER_ID);

      expect(result.code).toBe('CODE_ALREADY_USED');
    });

    it('refuses an expired code', async () => {
      jest.spyOn(DeliveryQRCode, 'findOne').mockResolvedValue(
        makeCode({ expiresAt: new Date(Date.now() - 1000) }) as any,
      );

      const result = await service.verifyCode('AC24GH', COURIER_ID);

      expect(result.code).toBe('CODE_EXPIRED');
    });

    it('locks the code once the attempt cap is reached', async () => {
      jest.spyOn(DeliveryQRCode, 'findOne').mockResolvedValue(
        makeCode({ failedAttempts: MAX_FAILED_ATTEMPTS }) as any,
      );

      const result = await service.verifyCode('AC24GH', COURIER_ID);

      expect(result.ok).toBe(false);
      expect(result.code).toBe('CODE_LOCKED');
    });

    it('refuses a delivery that is not in transit', async () => {
      jest.spyOn(DeliveryQRCode, 'findOne').mockResolvedValue(makeCode() as any);
      jest.spyOn(DeliveryAgreement, 'findByPk').mockResolvedValue(
        makeAgreement({ status: DeliveryStatus.COMPLETED }) as any,
      );

      const result = await service.verifyCode('AC24GH', COURIER_ID);

      expect(result.code).toBe('DELIVERY_NOT_IN_TRANSIT');
    });

    it('marks the code used and records who confirmed it', async () => {
      const code = makeCode();
      jest.spyOn(DeliveryQRCode, 'findOne').mockResolvedValue(code as any);

      await service.verifyCode('AC24GH', COURIER_ID, [25.9, -24.6]);

      const written = code.update.mock.calls[0][0];
      expect(written.status).toBe(QRCodeStatus.USED);
      expect(written.scannedByUserId).toBe(COURIER_ID);
      expect(written.scanLocation).toEqual([25.9, -24.6]);
    });

    it('reports an unknown code without saying why', async () => {
      jest.spyOn(DeliveryQRCode, 'findOne').mockResolvedValue(null);

      const result = await service.verifyCode('ZZZZZZ', COURIER_ID);

      expect(result.code).toBe('CODE_NOT_FOUND');
    });
  });

  describe('recording failed attempts', () => {
    it('increments against the delivery\'s active code', async () => {
      await service.recordFailedAttempt(AGREEMENT_ID);

      expect(DeliveryQRCode.increment).toHaveBeenCalledWith(
        'failedAttempts',
        expect.objectContaining({
          where: expect.objectContaining({
            deliveryAgreementId: AGREEMENT_ID,
            status: QRCodeStatus.ACTIVE,
          }),
        }),
      );
    });
  });
});
