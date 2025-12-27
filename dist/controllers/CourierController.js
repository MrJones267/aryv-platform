"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CourierController = void 0;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const Package_1 = require("../models/Package");
const DeliveryAgreement_1 = require("../models/DeliveryAgreement");
const DeliveryTier_1 = require("../models/DeliveryTier");
const database_1 = require("../config/database");
const PaymentReleaseService_1 = __importDefault(require("../services/PaymentReleaseService"));
const DemandPricingEngine_1 = __importDefault(require("../services/DemandPricingEngine"));
class CourierController {
    async getPricingSuggestions(req, res) {
        try {
            const { pickupCoordinates, dropoffCoordinates, packageSize = Package_1.PackageSize.MEDIUM, fragile = false, valuable = false, requestedDeliveryTime, } = req.body;
            if (!pickupCoordinates || !dropoffCoordinates) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required fields: pickupCoordinates, dropoffCoordinates',
                    code: 'VALIDATION_ERROR',
                });
                return;
            }
            const distance = this.calculateDistance(pickupCoordinates, dropoffCoordinates);
            const pricingEngine = DemandPricingEngine_1.default.getInstance();
            const pricingSuggestions = await pricingEngine.calculatePricingSuggestions(pickupCoordinates, dropoffCoordinates, packageSize, distance, fragile, valuable, requestedDeliveryTime ? new Date(requestedDeliveryTime) : undefined);
            await pricingEngine.updateDemandMetrics(pickupCoordinates);
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
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error in getPricingSuggestions:`, {
                error: error.message,
                stack: error.stack,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to calculate pricing suggestions',
                code: 'INTERNAL_ERROR',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async getDeliveryTiers(_req, res) {
        try {
            const deliveryTiers = await DeliveryTier_1.DeliveryTier.findAll({
                where: { isActive: true },
                order: [['minDeliveryHours', 'ASC']],
            });
            res.status(200).json({
                success: true,
                data: deliveryTiers,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error in getDeliveryTiers:`, {
                error: error.message,
                stack: error.stack,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve delivery tiers',
                code: 'INTERNAL_ERROR',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async createPackage(req, res) {
        const transaction = await database_1.sequelize.transaction();
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
            const { title, description, dimensionsLength, dimensionsWidth, dimensionsHeight, weight, packageSize, fragile, valuable, specialInstructions, pickupAddress, pickupCoordinates, pickupContactName, pickupContactPhone, dropoffAddress, dropoffCoordinates, dropoffContactName, dropoffContactPhone, senderPriceOffer, packageImages, deliveryTierId, requestedDeliveryTime, urgencyLevel, } = req.body;
            if (!title || !pickupAddress || !dropoffAddress || !senderPriceOffer) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required fields: title, pickupAddress, dropoffAddress, senderPriceOffer',
                    code: 'VALIDATION_ERROR',
                });
                return;
            }
            const distance = this.calculateDistance(pickupCoordinates, dropoffCoordinates);
            const pricingEngine = DemandPricingEngine_1.default.getInstance();
            const pricingSuggestions = await pricingEngine.calculatePricingSuggestions(pickupCoordinates, dropoffCoordinates, packageSize || Package_1.PackageSize.MEDIUM, distance, fragile || false, valuable || false, requestedDeliveryTime ? new Date(requestedDeliveryTime) : undefined);
            await pricingEngine.updateDemandMetrics(pickupCoordinates);
            const systemSuggestedPrice = pricingSuggestions.length > 0
                ? pricingSuggestions[Math.floor(pricingSuggestions.length / 2)].finalPrice
                : await this.calculateSuggestedPrice(distance, packageSize || Package_1.PackageSize.MEDIUM, fragile || false, valuable || false);
            const demandMultiplierApplied = pricingSuggestions.length > 0
                ? pricingSuggestions[0].demandMultiplier
                : 1.0;
            const packageData = await models_1.Package.create({
                senderId: userId,
                title,
                description,
                dimensionsLength,
                dimensionsWidth,
                dimensionsHeight,
                weight,
                packageSize: packageSize || Package_1.PackageSize.MEDIUM,
                fragile: fragile || false,
                valuable: valuable || false,
                specialInstructions,
                pickupAddress,
                pickupCoordinates,
                pickupContactName,
                pickupContactPhone,
                dropoffAddress,
                dropoffCoordinates,
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
            res.status(201).json({
                success: true,
                data: {
                    package: packageData,
                    pricingSuggestions,
                    selectedSuggestion: pricingSuggestions.find(s => deliveryTierId ? s.tierType === deliveryTierId : false) || null,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            console.error(`[${new Date().toISOString()}] Error in createPackage:`, {
                error: error.message,
                stack: error.stack,
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
    async getAvailablePackages(req, res) {
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
            const { lat, lng, radius = 50, packageSizes, minPrice, maxPrice, limit = 20, offset = 0, } = req.query;
            const whereClause = {
                isActive: true,
                [sequelize_1.Op.or]: [
                    { expiresAt: { [sequelize_1.Op.is]: null } },
                    { expiresAt: { [sequelize_1.Op.gt]: new Date() } },
                ],
            };
            if (packageSizes) {
                const sizesArray = Array.isArray(packageSizes) ? packageSizes : [packageSizes];
                whereClause.packageSize = { [sequelize_1.Op.in]: sizesArray };
            }
            if (minPrice || maxPrice) {
                whereClause.senderPriceOffer = {};
                if (minPrice)
                    whereClause.senderPriceOffer[sequelize_1.Op.gte] = parseFloat(minPrice);
                if (maxPrice)
                    whereClause.senderPriceOffer[sequelize_1.Op.lte] = parseFloat(maxPrice);
            }
            let locationClause = '';
            if (lat && lng) {
                locationClause = `
          AND ST_DWithin(
            pickup_coordinates::geography,
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
${Number(radius) * 1000}
          )
        `;
            }
            const query = `
        SELECT p.*, 
               u.first_name as sender_first_name,
               u.last_name as sender_last_name,
               u.phone_number as sender_phone,
               ${lat && lng ? `
                 ST_Distance(
                   p.pickup_coordinates::geography,
                   ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
                 ) / 1000 as distance_from_courier
               ` : 'NULL as distance_from_courier'}
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
        ORDER BY ${lat && lng ? 'distance_from_courier ASC,' : ''} p.created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
            const packages = await database_1.sequelize.query(query, {
                type: database_1.sequelize.QueryTypes.SELECT,
            });
            res.status(200).json({
                success: true,
                data: packages,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: packages.length,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error in getAvailablePackages:`, {
                error: error.message,
                stack: error.stack,
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
    async acceptDelivery(req, res) {
        const transaction = await database_1.sequelize.transaction();
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
            const packageData = await models_1.Package.findOne({
                where: {
                    id: packageId,
                    isActive: true,
                    [sequelize_1.Op.and]: [
                        {
                            [sequelize_1.Op.or]: [
                                { expiresAt: { [sequelize_1.Op.is]: null } },
                                { expiresAt: { [sequelize_1.Op.gt]: new Date() } },
                            ],
                        },
                    ],
                },
                include: [{
                        model: models_1.User,
                        as: 'sender',
                        attributes: ['id', 'firstName', 'lastName', 'email'],
                    }],
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
            const existingAgreement = await models_1.DeliveryAgreement.findOne({
                where: {
                    packageId,
                    status: {
                        [sequelize_1.Op.notIn]: [DeliveryAgreement_1.DeliveryStatus.CANCELLED, DeliveryAgreement_1.DeliveryStatus.DISPUTED],
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
            const courierProfile = await models_1.CourierProfile.findOne({
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
            const agreedPrice = packageData.senderPriceOffer;
            let platformFeePercentage = 0.25;
            if (packageData.deliveryTierId) {
                const deliveryTier = await DeliveryTier_1.DeliveryTier.findByPk(packageData.deliveryTierId);
                if (deliveryTier) {
                    platformFeePercentage = deliveryTier.platformFeePercentage / 100;
                }
            }
            const platformFee = agreedPrice * platformFeePercentage;
            const escrowAmount = agreedPrice;
            const deliveryAgreement = await models_1.DeliveryAgreement.create({
                packageId,
                courierId: userId,
                agreedPrice,
                platformFee,
                escrowAmount,
                status: DeliveryAgreement_1.DeliveryStatus.PENDING_PICKUP,
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
            await deliveryAgreement.createQRCode();
            await deliveryAgreement.save({ transaction });
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
        }
        catch (error) {
            await transaction.rollback();
            console.error(`[${new Date().toISOString()}] Error in acceptDelivery:`, {
                error: error.message,
                stack: error.stack,
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
    async confirmPickup(req, res) {
        const transaction = await database_1.sequelize.transaction();
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
            const agreement = await models_1.DeliveryAgreement.findOne({
                where: {
                    id: agreementId,
                    courierId: userId,
                    status: DeliveryAgreement_1.DeliveryStatus.PENDING_PICKUP,
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
            await agreement.transitionTo(DeliveryAgreement_1.DeliveryStatus.IN_TRANSIT, userId, {
                pickup_location: location,
                pickup_time: new Date().toISOString(),
            });
            if (location) {
                agreement.pickupLocation = location;
            }
            await agreement.save({ transaction });
            if (location) {
                await models_1.CourierLocation.create({
                    deliveryAgreementId: agreementId,
                    courierId: userId,
                    location,
                    timestamp: new Date(),
                }, { transaction });
            }
            await transaction.commit();
            res.status(200).json({
                success: true,
                data: agreement,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            console.error(`[${new Date().toISOString()}] Error in confirmPickup:`, {
                error: error.message,
                stack: error.stack,
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
    async verifyDeliveryQR(req, res) {
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
            const paymentResult = await PaymentReleaseService_1.default.processQRCodePaymentRelease(qrToken, userId, location);
            if (!paymentResult.success) {
                res.status(400).json({
                    success: false,
                    error: paymentResult.error || 'Failed to verify QR code',
                    code: 'QR_VERIFICATION_FAILED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            if (location) {
                await models_1.CourierLocation.create({
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
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error in verifyDeliveryQR:`, {
                error: error.message,
                stack: error.stack,
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
    async updateCourierLocation(req, res) {
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
            const agreement = await models_1.DeliveryAgreement.findOne({
                where: {
                    id: agreementId,
                    courierId: userId,
                    status: DeliveryAgreement_1.DeliveryStatus.IN_TRANSIT,
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
            const locationRecord = await models_1.CourierLocation.create({
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
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error in updateCourierLocation:`, {
                error: error.message,
                stack: error.stack,
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
    async getCourierDeliveries(req, res) {
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
            const deliveries = await models_1.DeliveryAgreement.findAll({
                where: {
                    courierId: userId,
                },
                include: [
                    {
                        model: models_1.Package,
                        as: 'package',
                        include: [{
                                model: models_1.User,
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
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error in getCourierDeliveries:`, {
                error: error.message,
                stack: error.stack,
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
    async getPackageTracking(req, res) {
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
            const packageData = await models_1.Package.findOne({
                where: { id: packageId },
                include: [
                    {
                        model: models_1.User,
                        as: 'sender',
                        attributes: ['id', 'firstName', 'lastName', 'phone'],
                    },
                    {
                        model: models_1.DeliveryAgreement,
                        as: 'deliveryAgreements',
                        include: [
                            {
                                model: models_1.User,
                                as: 'courier',
                                attributes: ['id', 'firstName', 'lastName', 'phone'],
                            },
                            {
                                model: models_1.CourierLocation,
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
            const courierLocations = deliveryAgreement?.courierLocations?.map((loc) => ({
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
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error in getPackageTracking:`, {
                error: error.message,
                stack: error.stack,
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
    calculateDistance(coord1, coord2) {
        const R = 6371;
        const dLat = this.toRad(coord2[1] - coord1[1]);
        const dLon = this.toRad(coord2[0] - coord1[0]);
        const lat1 = this.toRad(coord1[1]);
        const lat2 = this.toRad(coord2[1]);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    toRad(value) {
        return value * Math.PI / 180;
    }
    async calculateSuggestedPrice(distance, packageSize, isFragile, isValuable) {
        const result = await database_1.sequelize.query('SELECT calculate_suggested_delivery_price($1, $2, $3, $4) as suggested_price', {
            bind: [distance, packageSize, isFragile, isValuable],
            type: database_1.sequelize.QueryTypes.SELECT,
        });
        return result[0]?.suggested_price || 0;
    }
}
exports.CourierController = CourierController;
exports.default = new CourierController();
//# sourceMappingURL=CourierController.js.map