/**
 * @fileoverview The courier is shown, and charged, the same fee
 * @author Oabona-Majoko
 * @created 2026-11-09
 * @lastModified 2026-11-09
 */

jest.mock('../../models/DeliveryTier', () => ({ DeliveryTier: { findByPk: jest.fn() } }));
jest.mock('../../services/DemandPricingEngine', () => ({ __esModule: true, default: { DOCUMENT: { feeRate: 0.2 } } }));

import { DeliveryTier } from '../../models/DeliveryTier';
import { courierFeeFor } from '../../services/courierFee';
import { DEFAULT_COURIER_FEE_RATE } from '../../utils/fees';

beforeEach(() => jest.clearAllMocks());

describe('courierFeeFor', () => {
  it('uses the default rate when the package has no tier', async () => {
    const fee = await courierFeeFor({ senderPriceOffer: 100 });
    expect(fee.rate).toBe(DEFAULT_COURIER_FEE_RATE);
    expect(fee.platformFee + fee.earnings).toBe(100);
    // The details screen showed 10% / 90% whatever this said.
    expect(fee.earnings).toBe(100 - 100 * DEFAULT_COURIER_FEE_RATE);
  });

  it("uses the tier's rate", async () => {
    (DeliveryTier.findByPk as jest.Mock).mockResolvedValue({ platformFeePercentage: 15 });
    await expect(courierFeeFor({ senderPriceOffer: '40.10', deliveryTierId: 't1' })).resolves.toEqual({ rate: 0.15, platformFee: 6.02, earnings: 34.08 });
  });

  it('uses the document rate for a document, whatever the tier', async () => {
    (DeliveryTier.findByPk as jest.Mock).mockResolvedValue({ platformFeePercentage: 15 });
    await expect(courierFeeFor({ senderPriceOffer: 30, deliveryTierId: 't1', packageType: 'document' })).resolves.toMatchObject({ rate: 0.2, platformFee: 6 });
  });
});
