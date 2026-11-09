/**
 * @fileoverview The platform's share of a delivery, and the courier's
 * @author Oabona-Majoko
 * @created 2026-11-09
 * @lastModified 2026-11-09
 */

import { DeliveryTier } from '../models/DeliveryTier';
import DemandPricingEngine from './DemandPricingEngine';
import { DEFAULT_COURIER_FEE_RATE, round2 } from '../utils/fees';

/**
 * What the platform takes from a delivery, and what the courier keeps. The
 * tier sets the rate; documents carry their own whatever tier they went by.
 *
 * Shared by accepting a package and by its details screen, which told
 * couriers the fee was 10% while accepting charged 25%.
 */
export const courierFeeFor = async (
  pkg: { senderPriceOffer: number | string; deliveryTierId?: string | null; packageType?: string },
): Promise<{ rate: number; platformFee: number; earnings: number }> => {
  let rate = DEFAULT_COURIER_FEE_RATE;
  if (pkg.deliveryTierId) {
    const tier = await DeliveryTier.findByPk(pkg.deliveryTierId);
    if (tier) {
      rate = tier.platformFeePercentage / 100;
    }
  }
  if (pkg.packageType === 'document') {
    rate = DemandPricingEngine.DOCUMENT.feeRate;
  }
  const price = Number(pkg.senderPriceOffer) || 0;
  // To the cent: 25% of P40.10 is 10.025, which was stored as is.
  const platformFee = round2(price * rate);
  return { rate, platformFee, earnings: round2(price - platformFee) };
};

export default courierFeeFor;
