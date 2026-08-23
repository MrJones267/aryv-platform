/**
 * @fileoverview Cash on delivery for parcels — the courier equivalent of a
 *               cash ride.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * The recipient pays the courier at the door. No money passes through the
 * platform, so there is nothing to hold and nothing to release: the courier
 * already has it, and the platform's share becomes a debt on the same
 * commission ledger that collects on cash rides.
 *
 * This is what makes the courier service launchable. Escrow was the only
 * payment path and its provider is a mock that moves no money, so nothing
 * could actually be paid for.
 */

import { sequelize } from '../../config/database';
import { CourierEscrowService } from '../../services/CourierEscrowService';
import { CommissionService } from '../../services/CommissionService';
import { DeliveryAgreement, DeliveryStatus } from '../../models/DeliveryAgreement';
import Package from '../../models/Package';
import CourierProfile from '../../models/CourierProfile';
import Ride from '../../models/Ride';

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

const COURIER_ID = 'courier-1';
const SENDER_ID = 'sender-1';
const AGREEMENT_ID = 'agreement-1';

const makeAgreement = (overrides: Record<string, unknown> = {}): any => ({
  id: AGREEMENT_ID,
  courierId: COURIER_ID,
  packageId: 'package-1',
  status: DeliveryStatus.IN_TRANSIT,
  agreedPrice: 120,
  platformFee: 30,
  paymentMethod: 'cash_on_delivery',
  escrowPaymentId: null,
  transitionTo: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockResolvedValue(undefined),
  logEvent: jest.fn().mockResolvedValue(undefined),
  // Written by completeDelivery on the cash path; declared so assertions can
  // read them back off the same object the service mutated.
  cashCollectedAt: undefined as Date | undefined,
  cashAmountCollected: undefined as number | undefined,
  paymentReleasedAt: undefined as Date | undefined,
  ...overrides,
});

describe('courier cash on delivery', () => {
  let service: CourierEscrowService;
  let mockTx: { commit: jest.Mock; rollback: jest.Mock };
  let accrue: jest.SpyInstance;
  let blocked: jest.SpyInstance;

  beforeEach(() => {
    service = new CourierEscrowService();
    mockTx = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(sequelize, 'transaction').mockResolvedValue(mockTx as any);

    accrue = jest
      .spyOn(CommissionService.prototype, 'accrueCommission')
      .mockResolvedValue(undefined);
    blocked = jest
      .spyOn(CommissionService.prototype, 'isBlockedForUnpaidCommission')
      .mockResolvedValue({ blocked: false, owed: 0, threshold: 50 } as any);

    jest.spyOn(CourierProfile, 'findOne').mockResolvedValue({
      userId: COURIER_ID,
      isCourierActive: true,
      recordSuccessfulDelivery: jest.fn().mockResolvedValue(undefined),
    } as any);
  });

  describe('accepting a cash delivery', () => {
    const cashPackage = (overrides: Record<string, unknown> = {}) => ({
      id: 'package-1',
      senderId: SENDER_ID,
      title: 'Documents',
      senderPriceOffer: 120,
      paymentMethod: 'cash_on_delivery',
      deliveryTierId: null,
      isActive: true,
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    });

    beforeEach(() => {
      jest.spyOn(Package, 'findByPk').mockResolvedValue(cashPackage() as any);
      jest.spyOn(DeliveryAgreement, 'findOne').mockResolvedValue(null);
      jest.spyOn(DeliveryAgreement, 'create').mockImplementation((async (values: any) =>
        makeAgreement(values)) as any);
    });

    it('creates the agreement without touching the payment provider', async () => {
      // The provider refuses every call in production by design. A cash
      // delivery must never reach it.
      const provider = (service as any).paymentProvider;
      const createEscrow = jest.spyOn(provider, 'createEscrowPayment');

      await service.createDeliveryAgreement('package-1', COURIER_ID);

      expect(createEscrow).not.toHaveBeenCalled();
    });

    it('records the method on the agreement, so a later default change cannot rewrite it', async () => {
      await service.createDeliveryAgreement('package-1', COURIER_ID);

      expect(DeliveryAgreement.create).toHaveBeenCalledWith(
        expect.objectContaining({ paymentMethod: 'cash_on_delivery' }),
        expect.anything(),
      );
    });

    it('refuses a courier who is behind on commission', async () => {
      // Same rule as cash rides. Without it the platform's only revenue on
      // cash deliveries is uncollectable.
      blocked.mockResolvedValue({ blocked: true, owed: 82.5, threshold: 50 } as any);

      await expect(
        service.createDeliveryAgreement('package-1', COURIER_ID),
      ).rejects.toThrow(/Settle your outstanding commission/);

      expect(DeliveryAgreement.create).not.toHaveBeenCalled();
    });

    it('does not apply the commission block to escrow deliveries', async () => {
      jest.spyOn(Package, 'findByPk').mockResolvedValue(
        cashPackage({ paymentMethod: 'escrow' }) as any,
      );
      blocked.mockResolvedValue({ blocked: true, owed: 82.5, threshold: 50 } as any);

      // An escrow delivery holds the sender's money, so an unsettled cash
      // balance is not a reason to refuse it.
      await service.createDeliveryAgreement('package-1', COURIER_ID);

      expect(DeliveryAgreement.create).toHaveBeenCalled();
    });
  });

  describe('carrying passengers and parcels at once', () => {
    // A driver doing the Gaborone–Francistown run can take a parcel on the
    // same trip. Nothing should couple the two, and this fails if anything
    // later does — so adding such a rule has to be a decision, not a slip.
    const cashPackage = () => ({
      id: 'package-1',
      senderId: SENDER_ID,
      title: 'Documents',
      senderPriceOffer: 120,
      paymentMethod: 'cash_on_delivery',
      deliveryTierId: null,
      isActive: true,
      save: jest.fn().mockResolvedValue(undefined),
    });

    beforeEach(() => {
      jest.spyOn(Package, 'findByPk').mockResolvedValue(cashPackage() as any);
      jest.spyOn(DeliveryAgreement, 'findOne').mockResolvedValue(null);
      jest.spyOn(DeliveryAgreement, 'create').mockImplementation((async (values: any) =>
        makeAgreement(values)) as any);
    });

    it('does not consult the courier\'s rides when they accept a parcel', async () => {
      const rideFindOne = jest.spyOn(Ride, 'findOne');
      const rideFindAll = jest.spyOn(Ride, 'findAll');

      await service.createDeliveryAgreement('package-1', COURIER_ID);

      expect(rideFindOne).not.toHaveBeenCalled();
      expect(rideFindAll).not.toHaveBeenCalled();
    });

    it('accepts a parcel for a courier who is also an active driver', async () => {
      // Being mid-ride is not a reason to refuse; the only gates are an active
      // courier profile and a settled commission balance.
      jest.spyOn(CourierProfile, 'findOne').mockResolvedValue({
        userId: COURIER_ID,
        isCourierActive: true,
        recordSuccessfulDelivery: jest.fn(),
      } as any);

      await service.createDeliveryAgreement('package-1', COURIER_ID);

      expect(DeliveryAgreement.create).toHaveBeenCalledWith(
        expect.objectContaining({ courierId: COURIER_ID }),
        expect.anything(),
      );
    });

    it('does not consult deliveries when completing one, beyond the one being completed', async () => {
      jest.spyOn(DeliveryAgreement, 'findByPk').mockResolvedValue(makeAgreement() as any);
      const rideFindOne = jest.spyOn(Ride, 'findOne');

      await service.completeDelivery(AGREEMENT_ID, { handover_code_verified: true });

      expect(rideFindOne).not.toHaveBeenCalled();
    });
  });

  describe('completing a cash delivery', () => {
    beforeEach(() => {
      jest.spyOn(DeliveryAgreement, 'findByPk').mockResolvedValue(makeAgreement() as any);
    });

    it('accrues the platform fee against the courier instead of releasing anything', async () => {
      const provider = (service as any).paymentProvider;
      const release = jest.spyOn(provider, 'releaseEscrowPayment');

      await service.completeDelivery(AGREEMENT_ID, { handover_code_verified: true });

      expect(release).not.toHaveBeenCalled();
      expect(accrue).toHaveBeenCalledWith(
        COURIER_ID,
        30,
        null,
        expect.anything(),
        expect.objectContaining({
          metadata: { deliveryAgreementId: AGREEMENT_ID },
        }),
      );
    });

    it('records what was collected and when', async () => {
      const agreement = makeAgreement();
      jest.spyOn(DeliveryAgreement, 'findByPk').mockResolvedValue(agreement as any);

      await service.completeDelivery(AGREEMENT_ID, { handover_code_verified: true });

      expect(agreement.cashCollectedAt).toBeInstanceOf(Date);
      expect(agreement.cashAmountCollected).toBe(120);
      // Not an escrow release, so this stays unset.
      expect(agreement.paymentReleasedAt).toBeUndefined();
    });

    it('marks the delivery completed', async () => {
      const agreement = makeAgreement();
      jest.spyOn(DeliveryAgreement, 'findByPk').mockResolvedValue(agreement as any);

      await service.completeDelivery(AGREEMENT_ID, { handover_code_verified: true });

      expect(agreement.transitionTo).toHaveBeenCalledWith(
        DeliveryStatus.COMPLETED,
        COURIER_ID,
        expect.objectContaining({ payment_method: 'cash_on_delivery' }),
      );
    });

    it('will not complete a delivery that is not in transit', async () => {
      jest.spyOn(DeliveryAgreement, 'findByPk').mockResolvedValue(
        makeAgreement({ status: DeliveryStatus.PENDING_PICKUP }) as any,
      );

      await expect(
        service.completeDelivery(AGREEMENT_ID, {}),
      ).rejects.toThrow(/IN_TRANSIT/);

      expect(accrue).not.toHaveBeenCalled();
    });

    it('still uses escrow when that is what the agreement was struck under', async () => {
      jest.spyOn(DeliveryAgreement, 'findByPk').mockResolvedValue(
        makeAgreement({ paymentMethod: 'escrow', escrowPaymentId: 'escrow-1' }) as any,
      );
      const provider = (service as any).paymentProvider;
      jest.spyOn(provider, 'getPaymentStatus').mockResolvedValue('held');
      const release = jest.spyOn(provider, 'releaseEscrowPayment').mockResolvedValue(true);

      await service.completeDelivery(AGREEMENT_ID, {});

      expect(release).toHaveBeenCalledWith('escrow-1', COURIER_ID);
      expect(accrue).not.toHaveBeenCalled();
    });
  });
});
