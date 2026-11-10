/**
 * @fileoverview The size and price filters on the available-packages list
 * @author Oabona-Majoko
 * @created 2026-11-10
 * @lastModified 2026-11-10
 */

const query = jest.fn();

jest.mock('../../config/database', () => ({ sequelize: { transaction: jest.fn(), query: (...args: unknown[]) => query(...args) } }));
jest.mock('../../models', () => ({
  Package: { rawAttributes: { id: { field: 'id', type: { key: 'UUID' } } } },
  DeliveryAgreement: { findAll: jest.fn() },
  CourierProfile: {},
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
jest.mock('../../services/DeliveryHandoverService', () => ({ __esModule: true, default: { verifyCode: jest.fn(), recordFailedAttempt: jest.fn() } }));
jest.mock('../../services/courierNotifications', () => ({ notifyDeliveryEvent: jest.fn() }));
jest.mock('../../services/CurrencyService', () => ({ PLATFORM_DEFAULT_CURRENCY: 'BWP', CurrencyService: {} }));
jest.mock('../../services/courierFee', () => ({ courierFeeFor: jest.fn() }));
jest.mock('../../services/CommissionService', () => ({ CommissionService: jest.fn().mockImplementation(() => ({})) }));
jest.mock('../../utils/logger', () => ({ __esModule: true, default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));

import { CourierController } from '../../controllers/CourierController';
import { sequelize } from '../../config/database';
import { DeliveryAgreement } from '../../models';
import deliveryHandoverService from '../../services/DeliveryHandoverService';

const response = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('CourierController.getAvailablePackages filters', () => {
  beforeEach(() => { query.mockReset().mockResolvedValue([]); });

  it('applies the size and price filters it is given', async () => {
    const req: any = { user: { id: 'courier-1' }, query: { packageSizes: ['small', 'large', 'nonsense'], minPrice: '20', maxPrice: '80' } };

    await new CourierController().getAvailablePackages(req, response());

    const [sql, options] = query.mock.calls[0];
    expect(sql).toContain('p.package_size::text IN (:sizes)');
    expect(sql).toContain('p.sender_price_offer >= :minOffer');
    expect(sql).toContain('p.sender_price_offer <= :maxOffer');
    expect(options.replacements).toEqual(expect.objectContaining({ sizes: ['small', 'large'], minOffer: 20, maxOffer: 80 }));
  });

  it('adds no filter when none is asked for', async () => {
    await new CourierController().getAvailablePackages({ user: { id: 'courier-1' }, query: {} } as any, response());

    const [sql] = query.mock.calls[0];
    expect(sql).not.toContain(':sizes');
    expect(sql).not.toContain(':minOffer');
  });
});

describe('CourierController.verifyDeliveryQR and a wrong code', () => {
  it('counts the miss against every delivery the courier is carrying', async () => {
    (sequelize.transaction as jest.Mock).mockResolvedValue({ commit: jest.fn(), rollback: jest.fn() });
    (deliveryHandoverService.verifyCode as jest.Mock).mockResolvedValue({ ok: false, code: 'CODE_NOT_FOUND', error: 'That code is not valid' });
    (DeliveryAgreement.findAll as jest.Mock).mockResolvedValue([{ id: 'delivery-1' }, { id: 'delivery-2' }]);
    const res = response();

    await new CourierController().verifyDeliveryQR({ user: { id: 'courier-1' }, params: { qrToken: 'ABCDEF' }, body: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(deliveryHandoverService.recordFailedAttempt).toHaveBeenCalledWith('delivery-1');
    expect(deliveryHandoverService.recordFailedAttempt).toHaveBeenCalledWith('delivery-2');
  });
});
