"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CourierEscrowService = void 0;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const DeliveryAgreement_1 = require("../models/DeliveryAgreement");
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
class MockPaymentProvider {
    constructor() {
        this.payments = new Map();
    }
    async createEscrowPayment(amount, senderId, metadata) {
        const paymentId = `escrow_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        this.payments.set(paymentId, {
            amount,
            senderId,
            status: 'held',
            createdAt: new Date(),
            metadata: metadata || {},
        });
        (0, logger_1.logInfo)('Mock escrow payment created', {
            paymentId,
            amount,
            senderId,
            metadata,
        });
        return paymentId;
    }
    async releaseEscrowPayment(paymentId, recipientId) {
        const payment = this.payments.get(paymentId);
        if (!payment || payment.status !== 'held') {
            (0, logger_1.logError)('Cannot release payment: payment not found or not held', new Error('Payment not releasable'), { paymentId, recipientId });
            return false;
        }
        payment.recipientId = recipientId;
        payment.status = 'released';
        (0, logger_1.logInfo)('Mock escrow payment released', {
            paymentId,
            recipientId,
            amount: payment.amount,
        });
        return true;
    }
    async refundEscrowPayment(paymentId, reason) {
        const payment = this.payments.get(paymentId);
        if (!payment || payment.status !== 'held') {
            (0, logger_1.logError)('Cannot refund payment: payment not found or not held', new Error('Payment not refundable'), { paymentId, reason });
            return false;
        }
        payment.status = 'refunded';
        (0, logger_1.logInfo)('Mock escrow payment refunded', {
            paymentId,
            reason,
            amount: payment.amount,
        });
        return true;
    }
    async getPaymentStatus(paymentId) {
        const payment = this.payments.get(paymentId);
        return payment?.status || 'failed';
    }
}
class CourierEscrowService {
    constructor() {
        this.paymentProvider = new MockPaymentProvider();
    }
    async createDeliveryAgreement(packageId, courierId, transaction) {
        const t = transaction || await database_1.sequelize.transaction();
        const shouldCommit = !transaction;
        try {
            const packageData = await models_1.Package.findByPk(packageId, {
                include: [{
                        model: models_1.User,
                        as: 'sender',
                        attributes: ['id', 'firstName', 'lastName', 'email'],
                    }],
                transaction: t,
            });
            if (!packageData) {
                throw new Error('Package not found');
            }
            const courierProfile = await models_1.CourierProfile.findOne({
                where: { userId: courierId },
                transaction: t,
            });
            if (!courierProfile?.isCourierActive) {
                throw new Error('Courier is not active');
            }
            const existingAgreement = await models_1.DeliveryAgreement.findOne({
                where: {
                    packageId,
                    status: {
                        [sequelize_1.Op.notIn]: [DeliveryAgreement_1.DeliveryStatus.CANCELLED, DeliveryAgreement_1.DeliveryStatus.COMPLETED],
                    },
                },
                transaction: t,
            });
            if (existingAgreement) {
                throw new Error('Package already has an active delivery agreement');
            }
            const agreedPrice = packageData.senderPriceOffer;
            const platformFee = this.calculatePlatformFee(agreedPrice);
            const escrowAmount = agreedPrice;
            const escrowPaymentId = await this.paymentProvider.createEscrowPayment(escrowAmount, packageData.senderId, {
                packageId,
                courierId,
                packageTitle: packageData.title,
            });
            const deliveryAgreement = await models_1.DeliveryAgreement.create({
                packageId,
                courierId,
                agreedPrice,
                platformFee,
                escrowAmount,
                escrowPaymentId,
                escrowHeldAt: new Date(),
                status: DeliveryAgreement_1.DeliveryStatus.PENDING_PICKUP,
                eventLog: [{
                        timestamp: new Date().toISOString(),
                        event_type: 'agreement_created',
                        user_id: courierId,
                        data: {
                            agreed_price: agreedPrice,
                            platform_fee: platformFee,
                            escrow_payment_id: escrowPaymentId,
                            package_title: packageData.title,
                        },
                    }],
            }, { transaction: t });
            await deliveryAgreement.createQRCode();
            await deliveryAgreement.save({ transaction: t });
            packageData.isActive = false;
            await packageData.save({ transaction: t });
            await deliveryAgreement.logEvent('escrow_created', {
                escrow_payment_id: escrowPaymentId,
                escrow_amount: escrowAmount,
                sender_id: packageData.senderId,
            }, courierId);
            if (shouldCommit) {
                await t.commit();
            }
            (0, logger_1.logInfo)('Delivery agreement created with escrow', {
                agreementId: deliveryAgreement.id,
                packageId,
                courierId,
                escrowPaymentId,
                escrowAmount,
            });
            return deliveryAgreement;
        }
        catch (error) {
            if (shouldCommit) {
                await t.rollback();
            }
            (0, logger_1.logError)('Failed to create delivery agreement', error, {
                packageId,
                courierId,
            });
            throw error;
        }
    }
    async completeDelivery(agreementId, verificationData, transaction) {
        const t = transaction || await database_1.sequelize.transaction();
        const shouldCommit = !transaction;
        try {
            const agreement = await models_1.DeliveryAgreement.findByPk(agreementId, {
                include: [
                    {
                        model: models_1.Package,
                        as: 'package',
                        include: [{
                                model: models_1.User,
                                as: 'sender',
                            }],
                    },
                    {
                        model: models_1.User,
                        as: 'courier',
                    },
                ],
                transaction: t,
            });
            if (!agreement) {
                throw new Error('Delivery agreement not found');
            }
            if (agreement.status !== DeliveryAgreement_1.DeliveryStatus.IN_TRANSIT) {
                throw new Error('Agreement must be in IN_TRANSIT status to complete');
            }
            if (!agreement.escrowPaymentId) {
                throw new Error('No escrow payment found for this agreement');
            }
            const paymentStatus = await this.paymentProvider.getPaymentStatus(agreement.escrowPaymentId);
            if (paymentStatus !== 'held') {
                throw new Error('Escrow payment is not in held status');
            }
            const releaseSuccess = await this.paymentProvider.releaseEscrowPayment(agreement.escrowPaymentId, agreement.courierId);
            if (!releaseSuccess) {
                throw new Error('Failed to release escrow payment');
            }
            await agreement.transitionTo(DeliveryAgreement_1.DeliveryStatus.COMPLETED, agreement.courierId, {
                payment_released: true,
                verification_data: verificationData,
                completion_time: new Date().toISOString(),
            });
            agreement.paymentReleasedAt = new Date();
            await agreement.save({ transaction: t });
            const courierProfile = await models_1.CourierProfile.findOne({
                where: { userId: agreement.courierId },
                transaction: t,
            });
            if (courierProfile) {
                const courierEarnings = agreement.agreedPrice - agreement.platformFee;
                await courierProfile.recordSuccessfulDelivery(courierEarnings);
            }
            await agreement.logEvent('payment_released', {
                escrow_payment_id: agreement.escrowPaymentId,
                courier_earnings: agreement.agreedPrice - agreement.platformFee,
                platform_fee: agreement.platformFee,
            }, agreement.courierId);
            if (shouldCommit) {
                await t.commit();
            }
            (0, logger_1.logInfo)('Delivery completed and payment released', {
                agreementId,
                courierId: agreement.courierId,
                amount: agreement.agreedPrice,
                platformFee: agreement.platformFee,
            });
            return agreement;
        }
        catch (error) {
            if (shouldCommit) {
                await t.rollback();
            }
            (0, logger_1.logError)('Failed to complete delivery', error, {
                agreementId,
            });
            throw error;
        }
    }
    async cancelDelivery(agreementId, reason, cancelledByUserId, transaction) {
        const t = transaction || await database_1.sequelize.transaction();
        const shouldCommit = !transaction;
        try {
            const agreement = await models_1.DeliveryAgreement.findByPk(agreementId, {
                include: [
                    {
                        model: models_1.Package,
                        as: 'package',
                        include: [{
                                model: models_1.User,
                                as: 'sender',
                            }],
                    },
                ],
                transaction: t,
            });
            if (!agreement) {
                throw new Error('Delivery agreement not found');
            }
            if (agreement.status === DeliveryAgreement_1.DeliveryStatus.COMPLETED) {
                throw new Error('Cannot cancel completed delivery');
            }
            if (agreement.escrowPaymentId) {
                const refundSuccess = await this.paymentProvider.refundEscrowPayment(agreement.escrowPaymentId, reason);
                if (!refundSuccess) {
                    throw new Error('Failed to refund escrow payment');
                }
            }
            await agreement.transitionTo(DeliveryAgreement_1.DeliveryStatus.CANCELLED, cancelledByUserId, {
                cancellation_reason: reason,
                cancelled_by: cancelledByUserId,
                refund_processed: true,
                cancellation_time: new Date().toISOString(),
            });
            if (agreement.status === DeliveryAgreement_1.DeliveryStatus.PENDING_PICKUP) {
                const packageData = agreement.package;
                packageData.isActive = true;
                await packageData.save({ transaction: t });
            }
            if (shouldCommit) {
                await t.commit();
            }
            (0, logger_1.logInfo)('Delivery cancelled and refund processed', {
                agreementId,
                reason,
                cancelledBy: cancelledByUserId,
            });
            return agreement;
        }
        catch (error) {
            if (shouldCommit) {
                await t.rollback();
            }
            (0, logger_1.logError)('Failed to cancel delivery', error, {
                agreementId,
                reason,
            });
            throw error;
        }
    }
    async handleDispute(agreementId, disputeData, transaction) {
        const t = transaction || await database_1.sequelize.transaction();
        const shouldCommit = !transaction;
        try {
            const agreement = await models_1.DeliveryAgreement.findByPk(agreementId, {
                transaction: t,
            });
            if (!agreement) {
                throw new Error('Delivery agreement not found');
            }
            if (agreement.status === DeliveryAgreement_1.DeliveryStatus.DISPUTED) {
                throw new Error('Agreement is already disputed');
            }
            await agreement.transitionTo(DeliveryAgreement_1.DeliveryStatus.DISPUTED, disputeData.raisedByUserId, {
                dispute_type: disputeData.disputeType,
                dispute_description: disputeData.description,
                dispute_raised_at: new Date().toISOString(),
            });
            await agreement.logEvent('dispute_raised', {
                dispute_type: disputeData.disputeType,
                raised_by: disputeData.raisedByUserId,
                description: disputeData.description,
            }, disputeData.raisedByUserId);
            if (shouldCommit) {
                await t.commit();
            }
            (0, logger_1.logInfo)('Dispute created, payment frozen', {
                agreementId,
                disputeType: disputeData.disputeType,
                raisedBy: disputeData.raisedByUserId,
            });
            return agreement;
        }
        catch (error) {
            if (shouldCommit) {
                await t.rollback();
            }
            (0, logger_1.logError)('Failed to handle dispute', error, {
                agreementId,
                disputeData,
            });
            throw error;
        }
    }
    async resolveDispute(agreementId, resolution, transaction) {
        const t = transaction || await database_1.sequelize.transaction();
        const shouldCommit = !transaction;
        try {
            const agreement = await models_1.DeliveryAgreement.findByPk(agreementId, {
                transaction: t,
            });
            if (!agreement) {
                throw new Error('Delivery agreement not found');
            }
            if (agreement.status !== DeliveryAgreement_1.DeliveryStatus.DISPUTED) {
                throw new Error('Agreement is not in disputed status');
            }
            if (!agreement.escrowPaymentId) {
                throw new Error('No escrow payment to resolve');
            }
            let paymentSuccess = false;
            switch (resolution.resolution) {
                case 'release_to_courier':
                    paymentSuccess = await this.paymentProvider.releaseEscrowPayment(agreement.escrowPaymentId, agreement.courierId);
                    if (paymentSuccess) {
                        agreement.paymentReleasedAt = new Date();
                        await agreement.transitionTo(DeliveryAgreement_1.DeliveryStatus.COMPLETED, resolution.adminId, {
                            admin_resolution: 'released_to_courier',
                            admin_notes: resolution.notes,
                        });
                    }
                    break;
                case 'refund_to_sender':
                    paymentSuccess = await this.paymentProvider.refundEscrowPayment(agreement.escrowPaymentId, `Admin resolution: ${resolution.notes || 'Dispute resolved in favor of sender'}`);
                    if (paymentSuccess) {
                        await agreement.transitionTo(DeliveryAgreement_1.DeliveryStatus.CANCELLED, resolution.adminId, {
                            admin_resolution: 'refunded_to_sender',
                            admin_notes: resolution.notes,
                        });
                    }
                    break;
                case 'partial_split':
                    (0, logger_1.logInfo)('Partial split resolution requested - manual processing required', {
                        agreementId,
                        courierAmount: resolution.courierAmount,
                        senderRefund: resolution.senderRefund,
                    });
                    paymentSuccess = true;
                    break;
            }
            if (!paymentSuccess) {
                throw new Error('Failed to execute payment resolution');
            }
            await agreement.logEvent('dispute_resolved', {
                resolved_by: resolution.adminId,
                resolution_type: resolution.resolution,
                admin_notes: resolution.notes,
                courier_amount: resolution.courierAmount,
                sender_refund: resolution.senderRefund,
            }, resolution.adminId);
            if (shouldCommit) {
                await t.commit();
            }
            (0, logger_1.logInfo)('Dispute resolved', {
                agreementId,
                resolution: resolution.resolution,
                adminId: resolution.adminId,
            });
            return agreement;
        }
        catch (error) {
            if (shouldCommit) {
                await t.rollback();
            }
            (0, logger_1.logError)('Failed to resolve dispute', error, {
                agreementId,
                resolution,
            });
            throw error;
        }
    }
    async getEscrowStatus(agreementId) {
        try {
            const agreement = await models_1.DeliveryAgreement.findByPk(agreementId);
            if (!agreement) {
                throw new Error('Delivery agreement not found');
            }
            let paymentStatus = 'unknown';
            if (agreement.escrowPaymentId) {
                paymentStatus = await this.paymentProvider.getPaymentStatus(agreement.escrowPaymentId);
            }
            const canRelease = agreement.status === DeliveryAgreement_1.DeliveryStatus.IN_TRANSIT && paymentStatus === 'held';
            const canRefund = (agreement.status === DeliveryAgreement_1.DeliveryStatus.PENDING_PICKUP ||
                agreement.status === DeliveryAgreement_1.DeliveryStatus.IN_TRANSIT) &&
                paymentStatus === 'held';
            return {
                agreement,
                paymentStatus,
                canRelease,
                canRefund,
            };
        }
        catch (error) {
            (0, logger_1.logError)('Failed to get escrow status', error, { agreementId });
            throw error;
        }
    }
    calculatePlatformFee(amount) {
        return Math.round(amount * 0.10 * 100) / 100;
    }
}
exports.CourierEscrowService = CourierEscrowService;
exports.default = new CourierEscrowService();
//# sourceMappingURL=CourierEscrowService.js.map