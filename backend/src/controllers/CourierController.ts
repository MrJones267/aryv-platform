/**
 * @fileoverview CourierController for managing courier service operations
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import { Request, Response } from 'express';
import { Op, QueryTypes } from 'sequelize';
import {
  Package,
  DeliveryAgreement,
  CourierProfile,
  User,
  CourierLocation,
} from '../models';
import { PackageSize } from '../models/Package';
import { DeliveryStatus } from '../models/DeliveryAgreement';
import { DeliveryTier, DeliveryTierType } from '../models/DeliveryTier';
import { sequelize } from '../config/database';
import paymentReleaseService from '../services/PaymentReleaseService';
import DemandPricingEngine from '../services/DemandPricingEngine';
import logger from '../utils/logger';
import deliveryHandoverService from '../services/DeliveryHandoverService';
import { PLATFORM_DEFAULT_CURRENCY, CurrencyService } from '../services/CurrencyService';

/** [lng, lat] from a request, as the GeoJSON point a GEOMETRY column stores. */
const toGeoPoint = (coordinates: [number, number]): any => ({
  type: 'Point',
  coordinates: [Number(coordinates[0]), Number(coordinates[1])],
});

export class CourierController {
  /**
   * Get pricing suggestions for package delivery
   */
  async getPricingSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const {
        pickupCoordinates,
        dropoffCoordinates,
        packageSize = PackageSize.MEDIUM,
        fragile = false,
        valuable = false,
        requestedDeliveryTime,
      } = req.body;

      if (!pickupCoordinates || !dropoffCoordinates) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: pickupCoordinates, dropoffCoordinates',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      // Calculate distance
      const distance = this.calculateDistance(pickupCoordinates, dropoffCoordinates);

      // Get pricing suggestions from demand engine
      const pricingEngine = DemandPricingEngine.getInstance();
      const pricingSuggestions = await pricingEngine.calculatePricingSuggestions(
        pickupCoordinates,
        dropoffCoordinates,
        packageSize,
        distance,
        fragile,
        valuable,
        requestedDeliveryTime ? new Date(requestedDeliveryTime) : undefined,
      );

      // Refresh demand metrics. Best effort: the suggestions above already
      // read whatever metrics exist, so a failure here must not fail the quote.
      try {
        await pricingEngine.updateDemandMetrics(pickupCoordinates);
      } catch (error) {
        logger.warn('Demand metrics update failed; quoting without fresh metrics', {
          error: (error as Error).message,
        });
      }

      // Get current demand information
      const locationDemands = await pricingEngine.getLocationDemands([pickupCoordinates]);

      res.status(200).json({
        success: true,
        data: {
          distance,
          pricingSuggestions,
          demandInfo: locationDemands[0] || null,
          calculatedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error in getPricingSuggestions', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to calculate pricing suggestions',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get available delivery tiers
   */
  async getDeliveryTiers(_req: Request, res: Response): Promise<void> {
    try {
      const deliveryTiers = await DeliveryTier.findAll({
        where: { isActive: true },
        order: [['minDeliveryHours', 'ASC']],
      });

      res.status(200).json({
        success: true,
        data: deliveryTiers,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error in getDeliveryTiers', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve delivery tiers',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Create a new package listing
   */
  async createPackage(req: Request, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const {
        title,
        description,
        dimensionsLength,
        dimensionsWidth,
        dimensionsHeight,
        weight,
        packageSize,
        fragile,
        valuable,
        specialInstructions,
        pickupAddress,
        pickupCoordinates,
        pickupContactName,
        pickupContactPhone,
        dropoffAddress,
        dropoffCoordinates,
        dropoffContactName,
        dropoffContactPhone,
        senderPriceOffer,
        packageImages,
        deliveryTierId,
        requestedDeliveryTime,
        urgencyLevel,
      } = req.body;

      // Validate required fields
      if (!title || !pickupAddress || !dropoffAddress || !senderPriceOffer) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: title, pickupAddress, dropoffAddress, senderPriceOffer',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      // Calculate distance between pickup and dropoff
      const distance = this.calculateDistance(pickupCoordinates, dropoffCoordinates);

      // Demand-based pricing is advice for the suggested price, not a
      // precondition for sending a package. Both calls used to be awaited
      // bare, so any failure in the engine (and updateDemandMetrics could not
      // succeed at all) turned every package creation into a 500. On failure
      // the suggestion falls back to calculateSuggestedPrice below.
      const pricingEngine = DemandPricingEngine.getInstance();
      let pricingSuggestions: Awaited<ReturnType<typeof pricingEngine.calculatePricingSuggestions>> = [];
      try {
        pricingSuggestions = await pricingEngine.calculatePricingSuggestions(
          pickupCoordinates,
          dropoffCoordinates,
          packageSize || PackageSize.MEDIUM,
          distance,
          fragile || false,
          valuable || false,
          requestedDeliveryTime ? new Date(requestedDeliveryTime) : undefined,
        );
      } catch (error) {
        logger.warn('Demand pricing unavailable; using the base suggested price', {
          error: (error as Error).message,
        });
      }

      try {
        await pricingEngine.updateDemandMetrics(pickupCoordinates);
      } catch (error) {
        logger.warn('Demand metrics update failed after package pricing', {
          error: (error as Error).message,
        });
      }

      // Get the system suggested price (median of all tier suggestions)
      const systemSuggestedPrice = pricingSuggestions.length > 0
        ? pricingSuggestions[Math.floor(pricingSuggestions.length / 2)].finalPrice
        : await this.calculateSuggestedPrice(
            distance,
            packageSize || PackageSize.MEDIUM,
            fragile || false,
            valuable || false,
          );

      // Apply demand multiplier if any tier was suggested
      const demandMultiplierApplied = pricingSuggestions.length > 0
        ? pricingSuggestions[0].demandMultiplier
        : 1.0;

      const packageCurrency = await CurrencyService.getUserCurrencyCode(userId);

      const packageData = await Package.create({
        // The sender names the price, so the package is in their currency.
        currency: packageCurrency,
        senderId: userId,
        title,
        description,
        dimensionsLength,
        dimensionsWidth,
        dimensionsHeight,
        weight,
        packageSize: packageSize || PackageSize.MEDIUM,
        fragile: fragile || false,
        valuable: valuable || false,
        specialInstructions,
        pickupAddress,
        // These are GEOMETRY(POINT) columns, so they take GeoJSON, as rides
        // do. The request's [lng, lat] arrays were passed straight through,
        // which PostGIS rejects. The model types them as tuples, hence the cast.
        pickupCoordinates: toGeoPoint(pickupCoordinates),
        pickupContactName,
        pickupContactPhone,
        dropoffAddress,
        dropoffCoordinates: toGeoPoint(dropoffCoordinates),
        dropoffContactName,
        dropoffContactPhone,
        packageImages,
        distance,
        senderPriceOffer,
        systemSuggestedPrice,
        deliveryTierId,
        ...(requestedDeliveryTime && { requestedDeliveryTime: new Date(requestedDeliveryTime) }),
        urgencyLevel,
        demandMultiplierApplied,
        isActive: true,
      }, { transaction });

      await transaction.commit();

      // deliveryTierId is a tier's UUID; suggestions name tiers by tierType.
      // Comparing the two directly never matched, so this was always null.
      const selectedTier = deliveryTierId ? await DeliveryTier.findByPk(deliveryTierId) : null;

      res.status(201).json({
        success: true,
        data: {
          package: packageData,
          pricingSuggestions,
          selectedSuggestion: pricingSuggestions.find(s =>
            selectedTier ? s.tierType === selectedTier.tierType : false,
          ) || null,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      await transaction.rollback();
      logger.error('Error in createPackage', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to create package',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get available packages for couriers
   */
  async getAvailablePackages(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const {
        lat,
        lng,
        packageSizes,
        minPrice,
        maxPrice,
      } = req.query;
      const radius = Math.min(parseFloat(req.query['radius'] as string) || 50, 200); // cap at 200km
      const limit = Math.min(parseInt(req.query['limit'] as string) || 20, 100); // cap at 100
      const offset = Math.max(parseInt(req.query['offset'] as string) || 0, 0);

      const whereClause: any = {
        isActive: true,
        [Op.or]: [
          { expiresAt: { [Op.is]: null } },
          { expiresAt: { [Op.gt]: new Date() } },
        ],
      };

      // Filter by package sizes if specified
      if (packageSizes) {
        const sizesArray = Array.isArray(packageSizes) ? packageSizes : [packageSizes];
        whereClause.packageSize = { [Op.in]: sizesArray };
      }

      // Filter by price range if specified
      if (minPrice || maxPrice) {
        whereClause.senderPriceOffer = {};
        if (minPrice) whereClause.senderPriceOffer[Op.gte] = parseFloat(minPrice as string);
        if (maxPrice) whereClause.senderPriceOffer[Op.lte] = parseFloat(maxPrice as string);
      }

      // Build location-based query if coordinates provided — use parameterized replacements to prevent injection
      const hasCoords = lat && lng;
      const parsedLat = hasCoords ? parseFloat(lat as string) : 0;
      const parsedLng = hasCoords ? parseFloat(lng as string) : 0;

      if (hasCoords && (isNaN(parsedLat) || isNaN(parsedLng) || parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180)) {
        res.status(400).json({ success: false, error: 'Invalid coordinates', code: 'INVALID_COORDS', timestamp: new Date().toISOString() });
        return;
      }

      const locationClause = hasCoords
        ? `AND ST_DWithin(pickup_coordinates::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radiusMeters)`
        : '';

      const distanceSelect = hasCoords
        ? `ST_Distance(p.pickup_coordinates::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography) / 1000 as distance_from_courier`
        : `NULL as distance_from_courier`;

      const query = `
        SELECT p.*,
               u.first_name as sender_first_name,
               u.last_name as sender_last_name,
               u.phone_number as sender_phone,
               ${distanceSelect}
        FROM packages p
        JOIN users u ON p.sender_id = u.id
        WHERE p.is_active = true
          AND (p.expires_at IS NULL OR p.expires_at > NOW())
          AND NOT EXISTS (
            SELECT 1 FROM delivery_agreements da
            WHERE da.package_id = p.id
            AND da.status NOT IN ('cancelled', 'disputed')
          )
          ${locationClause}
        ORDER BY ${hasCoords ? 'distance_from_courier ASC,' : ''} p.created_at DESC
        LIMIT :limit OFFSET :offset
      `;

      const packages = await sequelize.query(query, {
        type: QueryTypes.SELECT,
        replacements: {
          lat: parsedLat,
          lng: parsedLng,
          radiusMeters: radius * 1000,
          limit,
          offset,
        },
      });

      res.status(200).json({
        success: true,
        data: packages,
        pagination: {
          limit,
          offset,
          returned: packages.length,
          hasMore: packages.length === limit,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error in getAvailablePackages', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve available packages',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Accept a delivery request (courier accepts package)
   */
  async acceptDelivery(req: Request, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const userId = req.user?.id;
      const { packageId } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      // Lock the package row to prevent double-acceptance race conditions
      const packageData = await Package.findOne({
        where: {
          id: packageId,
          isActive: true,
          [Op.and]: [
            {
              [Op.or]: [
                { expiresAt: { [Op.is]: null } },
                { expiresAt: { [Op.gt]: new Date() } },
              ],
            },
          ],
        } as any,
        include: [{
          model: User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        }],
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!packageData) {
        await transaction.rollback();
        res.status(404).json({
          success: false,
          error: 'Package not found or no longer available',
          code: 'PACKAGE_NOT_FOUND',
        });
        return;
      }

      // Check if package already has an active delivery agreement
      const existingAgreement = await DeliveryAgreement.findOne({
        where: {
          packageId,
          status: {
            [Op.notIn]: [DeliveryStatus.CANCELLED, DeliveryStatus.DISPUTED],
          },
        },
        transaction,
      });

      if (existingAgreement) {
        await transaction.rollback();
        res.status(409).json({
          success: false,
          error: 'Package already has an active delivery agreement',
          code: 'PACKAGE_ALREADY_ACCEPTED',
        });
        return;
      }

      // Check courier profile
      const courierProfile = await CourierProfile.findOne({
        where: { userId },
        transaction,
      });

      if (!courierProfile || !courierProfile.isCourierActive) {
        await transaction.rollback();
        res.status(403).json({
          success: false,
          error: 'User is not an active courier',
          code: 'NOT_ACTIVE_COURIER',
        });
        return;
      }

      // Get delivery tier to determine platform fee
      const agreedPrice = packageData.senderPriceOffer;
      let platformFeePercentage = 0.25; // Default 25%

      if (packageData.deliveryTierId) {
        const deliveryTier = await DeliveryTier.findByPk(packageData.deliveryTierId);
        if (deliveryTier) {
          platformFeePercentage = deliveryTier.platformFeePercentage / 100;
        }
      }

      const platformFee = agreedPrice * platformFeePercentage;
      const escrowAmount = agreedPrice;

      // Create delivery agreement
      const deliveryAgreement = await DeliveryAgreement.create({
        packageId,
        courierId: userId,
        agreedPrice,
        platformFee,
        escrowAmount,
        // The sender set the price, so it is in the sender's currency.
        currency: packageData.currency ?? PLATFORM_DEFAULT_CURRENCY,
        status: DeliveryStatus.PENDING_PICKUP,
        eventLog: [{
          timestamp: new Date().toISOString(),
          event_type: 'agreement_created',
          user_id: userId,
          data: {
            agreed_price: agreedPrice,
            platform_fee: platformFee,
            package_title: packageData.title,
          },
        }],
      }, { transaction });

      // Generate QR code for delivery verification
      await deliveryAgreement.createQRCode();
      await deliveryAgreement.save({ transaction });

      // Mark package as no longer active (accepted)
      packageData.isActive = false;
      await packageData.save({ transaction });

      await transaction.commit();

      res.status(201).json({
        success: true,
        data: {
          deliveryAgreement,
          package: packageData,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      await transaction.rollback();
      logger.error('Error in acceptDelivery', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        userId: req.user?.id,
        packageId: req.params['packageId'],
      });

      res.status(500).json({
        success: false,
        error: 'Failed to accept delivery',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Confirm package pickup
   */
  async confirmPickup(req: Request, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const userId = req.user?.id;
      const { agreementId } = req.params;
      const { location } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const agreement = await DeliveryAgreement.findOne({
        where: {
          id: agreementId,
          courierId: userId,
          status: DeliveryStatus.PENDING_PICKUP,
        },
        transaction,
      });

      if (!agreement) {
        await transaction.rollback();
        res.status(404).json({
          success: false,
          error: 'Delivery agreement not found or invalid status',
          code: 'AGREEMENT_NOT_FOUND',
        });
        return;
      }

      // Transition to IN_TRANSIT status
      await agreement.transitionTo(DeliveryStatus.IN_TRANSIT, userId, {
        pickup_location: location,
        pickup_time: new Date().toISOString(),
      });

      if (location) {
        agreement.pickupLocation = location;
      }

      await agreement.save({ transaction });

      // Record initial location for tracking
      if (location) {
        await CourierLocation.create({
          deliveryAgreementId: agreementId,
          courierId: userId,
          location,
          timestamp: new Date(),
        }, { transaction });
      }

      // Issue the handover code and send it to the recipient. Deliberately
      // inside the pickup transaction: a delivery in transit with no code
      // cannot be completed by the courier at all, so the two belong together.
      const issued = await deliveryHandoverService.issueCode(agreementId, transaction);

      await transaction.commit();

      res.status(200).json({
        success: true,
        data: {
          agreement,
          // How the recipient was reached, so the courier knows whether to
          // expect a code at the door. The code itself is never included:
          // the courier knowing it in advance would defeat the point.
          handover: {
            codeIssued: issued.success,
            sentVia: issued.channel ?? 'none',
            // What to collect at the door. The courier needs the figure and
            // has no other reliable source for it — but never the code, which
            // is the recipient's to give.
            paymentMethod: agreement.paymentMethod,
            collectOnDelivery: agreement.paymentMethod === 'cash_on_delivery'
              ? agreement.agreedPrice
              : null,
          },
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      await transaction.rollback();
      logger.error('Error in confirmPickup', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        userId: req.user?.id,
        agreementId: req.params['agreementId'],
      });

      res.status(500).json({
        success: false,
        error: 'Failed to confirm pickup',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Verify QR code for delivery confirmation
   */
  async verifyDeliveryQR(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { qrToken } = req.params;
      const { location } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      // Verify the handover code first. This establishes that the caller is
      // the assigned courier and that they hold a code only the recipient was
      // given — everything the payment release depends on.
      const verification = await deliveryHandoverService.verifyCode(
        qrToken as string,
        userId,
        location,
      );

      if (!verification.ok || !verification.agreement) {
        // Count the miss so repeated guessing runs into the cap. Recorded
        // outside the verification call so it survives that call's rollback.
        if (verification.code === 'CODE_NOT_FOUND') {
          const inTransit = await DeliveryAgreement.findOne({
            where: { courierId: userId, status: DeliveryStatus.IN_TRANSIT },
          });
          if (inTransit) {
            await deliveryHandoverService.recordFailedAttempt(inTransit.id);
          }
        }

        res.status(400).json({
          success: false,
          error: verification.error || 'Failed to verify delivery code',
          code: verification.code || 'CODE_VERIFICATION_FAILED',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Release the escrow now the handover is proven.
      const paymentResult = await paymentReleaseService.processConfirmedDeliveryRelease(
        verification.agreement.id,
        userId,
        location,
      );

      if (!paymentResult.success) {
        res.status(400).json({
          success: false,
          error: paymentResult.error || 'Delivery confirmed but payment release failed',
          code: 'PAYMENT_RELEASE_FAILED',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Record final location if provided
      if (location) {
        await CourierLocation.create({
          deliveryAgreementId: paymentResult.agreementId,
          courierId: userId,
          location,
          timestamp: new Date(),
        });
      }

      res.status(200).json({
        success: true,
        data: {
          agreementId: paymentResult.agreementId,
          paymentReleased: true,
          courierEarnings: paymentResult.courierEarnings,
          platformFee: paymentResult.platformFee,
          message: 'Delivery confirmed and payment released successfully',
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error in verifyDeliveryQR', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        userId: req.user?.id,
        qrToken: req.params['qrToken'],
      });

      res.status(500).json({
        success: false,
        error: 'Failed to verify delivery QR code',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Update courier location during delivery
   */
  async updateCourierLocation(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { agreementId } = req.params;
      const { location, accuracy, speed, heading } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      // Verify courier owns this delivery
      const agreement = await DeliveryAgreement.findOne({
        where: {
          id: agreementId,
          courierId: userId,
          status: DeliveryStatus.IN_TRANSIT,
        },
      });

      if (!agreement) {
        res.status(404).json({
          success: false,
          error: 'Active delivery agreement not found',
          code: 'AGREEMENT_NOT_FOUND',
        });
        return;
      }

      // Create location record
      const locationRecord = await CourierLocation.create({
        deliveryAgreementId: agreementId,
        courierId: userId,
        location,
        accuracy,
        speed,
        heading,
        timestamp: new Date(),
      });

      res.status(201).json({
        success: true,
        data: locationRecord,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error in updateCourierLocation', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        userId: req.user?.id,
        agreementId: req.params['agreementId'],
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update courier location',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get courier's active deliveries
   */
  async getCourierDeliveries(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const deliveries = await DeliveryAgreement.findAll({
        where: {
          courierId: userId,
        },
        include: [
          {
            model: Package,
            as: 'package',
            include: [{
              model: User,
              as: 'sender',
              attributes: ['id', 'firstName', 'lastName', 'phone'],
            }],
          },
        ],
        order: [['createdAt', 'DESC']],
      });

      res.status(200).json({
        success: true,
        data: deliveries,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error in getCourierDeliveries', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve courier deliveries',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get package tracking information
   */
  async getPackageTracking(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { packageId } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      // Get package with delivery agreement and courier locations
      const packageData = await Package.findOne({
        where: { id: packageId },
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'firstName', 'lastName', 'phone'],
          },
          {
            model: DeliveryAgreement,
            as: 'deliveryAgreements',
            include: [
              {
                model: User,
                as: 'courier',
                attributes: ['id', 'firstName', 'lastName', 'phone'],
              },
              {
                model: CourierLocation,
                as: 'courierLocations',
                order: [['timestamp', 'DESC']],
              },
            ],
          },
        ],
      });

      if (!packageData) {
        res.status(404).json({
          success: false,
          error: 'Package not found',
          code: 'PACKAGE_NOT_FOUND',
        });
        return;
      }

      // Ensure user has permission to view this package
      const deliveryAgreement = packageData.deliveryAgreements?.[0];
      const hasPermission = packageData.senderId === userId ||
                          deliveryAgreement?.courierId === userId;

      if (!hasPermission) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'ACCESS_DENIED',
        });
        return;
      }

      // Format courier locations for response
      const courierLocations = (deliveryAgreement as any)?.courierLocations?.map((loc: any) => ({
        location: loc.location,
        timestamp: loc.timestamp,
        accuracy: loc.accuracy,
        speed: loc.speed,
        heading: loc.heading,
      })) || [];

      res.status(200).json({
        success: true,
        data: {
          package: packageData,
          deliveryAgreement: deliveryAgreement || null,
          courierLocations,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error in getPackageTracking', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        userId: req.user?.id,
        packageId: req.params['packageId'],
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve package tracking information',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Helper methods

  private calculateDistance(coord1: [number, number], coord2: [number, number]): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(coord2[1] - coord1[1]);
    const dLon = this.toRad(coord2[0] - coord1[0]);
    const lat1 = this.toRad(coord1[1]);
    const lat2 = this.toRad(coord2[1]);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private toRad(value: number): number {
    return value * Math.PI / 180;
  }

  private async calculateSuggestedPrice(
    distance: number,
    packageSize: PackageSize,
    isFragile: boolean,
    isValuable: boolean,
  ): Promise<number> {
    // This called a SQL function, calculate_suggested_delivery_price, from
    // migration 002, which production recorded as applied without running;
    // the function and the courier_pricing_config table it reads do not exist
    // there. This is the fallback for when demand pricing fails, so it must
    // not need the database: it prices as a Standard delivery, with no demand
    // adjustment, using the engine's own rates.
    const price = DemandPricingEngine.getInstance().calculateBasePrice(
      DeliveryTierType.STANDARD,
      distance,
      packageSize,
      isFragile,
      isValuable,
    );
    return Math.round(price * 100) / 100;
  }
}

export default new CourierController();
