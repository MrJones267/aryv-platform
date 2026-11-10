/**
 * @fileoverview A courier who owes too much commission cannot accept a delivery
 * @author Oabona-Majoko
 * @created 2026-11-10
 * @lastModified 2026-11-10
 */

const tx = { commit: jest.fn(), rollback: jest.fn(), LOCK: { UPDATE: 'UPDATE' } };
const blocked = jest.fn();

jest.mock('../../config/database', () => ({ sequelize: { transaction: jest.fn(async () => tx), query: jest.fn() } }));
jest.mock('../../models', () => ({
  Package: { findOne: jest.fn() },
  DeliveryAgreement: { findOne: jest.fn(), create: jest.fn() },
  CourierProfile: { findOne: jest.fn() },
  User: {},
  CourierLocation: {},
}));
jest.mock('../../models/Package', () => ({ PackageSize: { SMALL: 'small', MEDIUM: 'medium' } }));
jest.mock('../../models/DeliveryAgreement', () => ({
  DeliveryStatus: { PENDING_PICKUP: 'pending_pickup', IN_TRANSIT: 'in_transit', COMPLETED: 'completed', CANCELLED: 'cancelled', DISPUTED: 'disputed' },
}));
jest.mock('../../models/DeliveryTier', () => ({ DeliveryTier: {}, DeliveryTierType: { STANDARD: 'standard' } }));
jest.mock('../../services/PaymentReleaseService', () => ({ __esModule: true, default: {} }));
jest.mock('../../services/DemandPricingEngine', () => ({ __esModule: true, default: { getInstance: jest.fn(), DOCUMENT: {} } }));
jest.mock('../../services/courierDistance', () => ({ roadDistanceKm: jest.fn() }));
jest.mock('../../services/DeliveryHandoverService', () => ({ __esModule: true, default: {} }));
jest.mock('../../services/courierNotifications', () => ({ notifyDeliveryEvent: jest.fn() }));
jest.mock('../../services/CurrencyService', () => ({ PLATFORM_DEFAULT_CURRENCY: 'BWP', CurrencyService: {} }));
jest.mock('../../services/courierFee', () => ({ courierFeeFor: jest.fn(async () => ({ rate: 0.25, platformFee: 10, earnings: 30 })) }));
jest.mock('../../services/CommissionService', () => ({
  CommissionService: jest.fn().mockImplementation(() => ({ isBlockedForUnpaidCommission: blocked })),
}));
jest.mock('../../utils/logger', () => ({ __esModule: true, default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));

import { CourierController } from '../../controllers/CourierController';
import { Package, DeliveryAgreement, CourierProfile } from '../../models';

const response = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('CourierController.acceptDelivery and unpaid commission', () => {
  const request: any = { user: { id: 'courier-1', firstName: 'Kago' }, params: { packageId: 'pkg-1' }, body: {} };
  const pkg = { id: 'pkg-1', senderId: 'sender-1', senderPriceOffer: 40, currency: 'BWP', title: 'Box', isActive: true, save: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (Package.findOne as jest.Mock).mockResolvedValue(pkg);
    (DeliveryAgreement.findOne as jest.Mock).mockResolvedValue(null);
    (CourierProfile.findOne as jest.Mock).mockResolvedValue({ isCourierActive: true });
    (DeliveryAgreement.create as jest.Mock).mockResolvedValue({ id: 'agreement-1', save: jest.fn() });
  });

  it('refuses a courier at or over their commission limit', async () => {
    blocked.mockResolvedValue({ blocked: true, owed: 75, threshold: 50 });
    const res = response();

    await new CourierController().acceptDelivery(request, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'COMMISSION_OUTSTANDING' }));
    expect(DeliveryAgreement.create).not.toHaveBeenCalled();
    expect(tx.rollback).toHaveBeenCalled();
  });

  it('lets a courier under the limit accept', async () => {
    blocked.mockResolvedValue({ blocked: false, owed: 10, threshold: 50 });
    const res = response();

    await new CourierController().acceptDelivery(request, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(DeliveryAgreement.create).toHaveBeenCalled();
  });
});
