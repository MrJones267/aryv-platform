"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentReleaseService = exports.PaymentReleaseTrigger = void 0;
const models_1 = require("../models");
const DeliveryAgreement_1 = require("../models/DeliveryAgreement");
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const CourierEscrowService_1 = __importDefault(require("./CourierEscrowService"));
const QRCodeService_1 = __importDefault(require("./QRCodeService"));
var PaymentReleaseTrigger;
(function (PaymentReleaseTrigger) {
    PaymentReleaseTrigger["QR_CODE_SCAN"] = "qr_code_scan";
    PaymentReleaseTrigger["MANUAL_ADMIN"] = "manual_admin";
    PaymentReleaseTrigger["AUTO_TIMEOUT"] = "auto_timeout";
    PaymentReleaseTrigger["DISPUTE_RESOLUTION"] = "dispute_resolution";
})(PaymentReleaseTrigger || (exports.PaymentReleaseTrigger = PaymentReleaseTrigger = {}));
class PaymentReleaseService {
    constructor() {
        this.AUTO_RELEASE_DELAY_HOURS = 24;
    }
    async processQRCodePaymentRelease(qrToken, scannedByUserId, scanLocation, transaction) {
        const t = transaction || await database_1.sequelize.transaction();
        const shouldCommit = !transaction;
        try {
            const qrResult = await QRCodeService_1.default.verifyAndScanQRCode(qrToken, scannedByUserId, scanLocation, t);
            if (!qrResult.isValid) {
                const result = {
                    success: false,
                    agreementId: qrResult.agreement?.id || '',
                    amount: 0,
                    platformFee: 0,
                    courierEarnings: 0,
                    trigger: PaymentReleaseTrigger.QR_CODE_SCAN,
                    timestamp: new Date(),
                    error: qrResult.message,
                };
                if (shouldCommit) {
                    await t.rollback();
                }
                return result;
            }
            const agreement = qrResult.agreement;
            if (agreement.status !== DeliveryAgreement_1.DeliveryStatus.IN_TRANSIT) {
                const result = {
                    success: false,
                    agreementId: agreement.id,
                    amount: agreement.agreedPrice,
                    platformFee: agreement.platformFee,
                    courierEarnings: agreement.agreedPrice - agreement.platformFee,
                    trigger: PaymentReleaseTrigger.QR_CODE_SCAN,
                    timestamp: new Date(),
                    error: 'Agreement is not in transit status',
                };
                if (shouldCommit) {
                    await t.rollback();
                }
                return result;
            }
            const completedAgreement = await CourierEscrowService_1.default.completeDelivery(agreement.id, {
                qr_code_verified: true,
                qr_token: qrToken,
                scanned_by: scannedByUserId,
                scan_location: scanLocation,
                delivery_confirmed_at: new Date().toISOString(),
            }, t);
            const result = {
                success: true,
                agreementId: completedAgreement.id,
                amount: completedAgreement.agreedPrice,
                platformFee: completedAgreement.platformFee,
                courierEarnings: completedAgreement.agreedPrice - completedAgreement.platformFee,
                trigger: PaymentReleaseTrigger.QR_CODE_SCAN,
                timestamp: new Date(),
            };
            await this.logPaymentRelease(result, t);
            await this.sendPaymentReleaseNotifications(completedAgreement, result, t);
            if (shouldCommit) {
                await t.commit();
            }
            (0, logger_1.logInfo)('Payment released via QR code scan', {
                agreementId: agreement.id,
                courierEarnings: result.courierEarnings,
                platformFee: result.platformFee,
            });
            return result;
        }
        catch (error) {
            if (shouldCommit) {
                await t.rollback();
            }
            (0, logger_1.logError)('Failed to process QR code payment release', error, {
                qrToken,
                scannedByUserId,
            });
            const result = {
                success: false,
                agreementId: '',
                amount: 0,
                platformFee: 0,
                courierEarnings: 0,
                trigger: PaymentReleaseTrigger.QR_CODE_SCAN,
                timestamp: new Date(),
                error: error.message,
            };
            return result;
        }
    }
    async processManualPaymentRelease(agreementId, adminId, reason, transaction) {
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
            if (![DeliveryAgreement_1.DeliveryStatus.IN_TRANSIT, DeliveryAgreement_1.DeliveryStatus.DISPUTED].includes(agreement.status)) {
                throw new Error('Agreement cannot be manually completed in current status');
            }
            const completedAgreement = await CourierEscrowService_1.default.completeDelivery(agreementId, {
                manual_release: true,
                admin_id: adminId,
                admin_reason: reason,
                completed_at: new Date().toISOString(),
            }, t);
            const result = {
                success: true,
                agreementId: completedAgreement.id,
                amount: completedAgreement.agreedPrice,
                platformFee: completedAgreement.platformFee,
                courierEarnings: completedAgreement.agreedPrice - completedAgreement.platformFee,
                trigger: PaymentReleaseTrigger.MANUAL_ADMIN,
                timestamp: new Date(),
            };
            await this.logPaymentRelease(result, t);
            await completedAgreement.logEvent('manual_payment_release', {
                admin_id: adminId,
                reason,
                amount: result.amount,
                courier_earnings: result.courierEarnings,
            }, adminId);
            await this.sendPaymentReleaseNotifications(completedAgreement, result, t);
            if (shouldCommit) {
                await t.commit();
            }
            (0, logger_1.logInfo)('Payment released manually by admin', {
                agreementId,
                adminId,
                reason,
                courierEarnings: result.courierEarnings,
            });
            return result;
        }
        catch (error) {
            if (shouldCommit) {
                await t.rollback();
            }
            (0, logger_1.logError)('Failed to process manual payment release', error, {
                agreementId,
                adminId,
                reason,
            });
            const result = {
                success: false,
                agreementId,
                amount: 0,
                platformFee: 0,
                courierEarnings: 0,
                trigger: PaymentReleaseTrigger.MANUAL_ADMIN,
                timestamp: new Date(),
                error: error.message,
            };
            return result;
        }
    }
    async processAutoTimeoutRelease(agreementId, transaction) {
        const t = transaction || await database_1.sequelize.transaction();
        const shouldCommit = !transaction;
        try {
            const agreement = await models_1.DeliveryAgreement.findByPk(agreementId, {
                transaction: t,
            });
            if (!agreement) {
                throw new Error('Delivery agreement not found');
            }
            if (agreement.status !== DeliveryAgreement_1.DeliveryStatus.COMPLETED) {
                throw new Error('Agreement must be completed for auto-release');
            }
            if (!agreement.deliveryConfirmedAt) {
                throw new Error('No delivery confirmation time found');
            }
            const timeSinceCompletion = Date.now() - agreement.deliveryConfirmedAt.getTime();
            const hoursElapsed = timeSinceCompletion / (1000 * 60 * 60);
            if (hoursElapsed < this.AUTO_RELEASE_DELAY_HOURS) {
                throw new Error('Auto-release delay period not yet elapsed');
            }
            if (agreement.paymentReleasedAt) {
                const result = {
                    success: true,
                    agreementId: agreement.id,
                    amount: agreement.agreedPrice,
                    platformFee: agreement.platformFee,
                    courierEarnings: agreement.agreedPrice - agreement.platformFee,
                    trigger: PaymentReleaseTrigger.AUTO_TIMEOUT,
                    timestamp: agreement.paymentReleasedAt,
                    error: 'Payment was already released',
                };
                if (shouldCommit) {
                    await t.rollback();
                }
                return result;
            }
            const completedAgreement = await CourierEscrowService_1.default.completeDelivery(agreementId, {
                auto_release: true,
                release_trigger: 'timeout',
                hours_elapsed: hoursElapsed,
                auto_released_at: new Date().toISOString(),
            }, t);
            const result = {
                success: true,
                agreementId: completedAgreement.id,
                amount: completedAgreement.agreedPrice,
                platformFee: completedAgreement.platformFee,
                courierEarnings: completedAgreement.agreedPrice - completedAgreement.platformFee,
                trigger: PaymentReleaseTrigger.AUTO_TIMEOUT,
                timestamp: new Date(),
            };
            await this.logPaymentRelease(result, t);
            await completedAgreement.logEvent('auto_payment_release', {
                hours_elapsed: hoursElapsed,
                auto_release_delay: this.AUTO_RELEASE_DELAY_HOURS,
                amount: result.amount,
            });
            if (shouldCommit) {
                await t.commit();
            }
            (0, logger_1.logInfo)('Payment auto-released after timeout', {
                agreementId,
                hoursElapsed,
                courierEarnings: result.courierEarnings,
            });
            return result;
        }
        catch (error) {
            if (shouldCommit) {
                await t.rollback();
            }
            (0, logger_1.logError)('Failed to process auto-timeout release', error, {
                agreementId,
            });
            const result = {
                success: false,
                agreementId,
                amount: 0,
                platformFee: 0,
                courierEarnings: 0,
                trigger: PaymentReleaseTrigger.AUTO_TIMEOUT,
                timestamp: new Date(),
                error: error.message,
            };
            return result;
        }
    }
    async processEligibleAutoReleases() {
        try {
            const cutoffTime = new Date();
            cutoffTime.setHours(cutoffTime.getHours() - this.AUTO_RELEASE_DELAY_HOURS);
            const eligibleAgreements = await models_1.DeliveryAgreement.findAll({
                where: {
                    status: DeliveryAgreement_1.DeliveryStatus.COMPLETED,
                    deliveryConfirmedAt: {
                        [database_1.Op.lte]: cutoffTime,
                    },
                    paymentReleasedAt: { [database_1.Op.is]: null },
                },
                limit: 50,
            });
            const results = [];
            for (const agreement of eligibleAgreements) {
                try {
                    const result = await this.processAutoTimeoutRelease(agreement.id);
                    results.push(result);
                }
                catch (error) {
                    (0, logger_1.logError)('Failed to auto-release payment for agreement', error, {
                        agreementId: agreement.id,
                    });
                }
            }
            (0, logger_1.logInfo)('Processed auto-release batch', {
                eligible: eligibleAgreements.length,
                processed: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length,
            });
            return results;
        }
        catch (error) {
            (0, logger_1.logError)('Failed to process eligible auto-releases', error);
            return [];
        }
    }
    async getPaymentReleaseStats() {
        try {
            const completedAgreements = await models_1.DeliveryAgreement.findAll({
                where: {
                    status: DeliveryAgreement_1.DeliveryStatus.COMPLETED,
                    paymentReleasedAt: { [database_1.Op.ne]: null },
                },
                attributes: [
                    'id',
                    'agreedPrice',
                    'platformFee',
                    'createdAt',
                    'paymentReleasedAt',
                    'eventLog',
                ],
            });
            let totalAmount = 0;
            let totalPlatformFees = 0;
            let totalReleaseTime = 0;
            const releasesByTrigger = {
                [PaymentReleaseTrigger.QR_CODE_SCAN]: 0,
                [PaymentReleaseTrigger.MANUAL_ADMIN]: 0,
                [PaymentReleaseTrigger.AUTO_TIMEOUT]: 0,
                [PaymentReleaseTrigger.DISPUTE_RESOLUTION]: 0,
            };
            for (const agreement of completedAgreements) {
                totalAmount += agreement.agreedPrice;
                totalPlatformFees += agreement.platformFee;
                if (agreement.paymentReleasedAt) {
                    const releaseTime = agreement.paymentReleasedAt.getTime() - agreement.createdAt.getTime();
                    totalReleaseTime += releaseTime;
                }
                const releaseEvents = agreement.eventLog.filter((event) => event.event_type === 'payment_released' ||
                    event.event_type === 'qr_code_scanned' ||
                    event.event_type === 'manual_payment_release' ||
                    event.event_type === 'auto_payment_release');
                if (releaseEvents.length > 0) {
                    const lastEvent = releaseEvents[releaseEvents.length - 1];
                    if (lastEvent.event_type === 'qr_code_scanned') {
                        releasesByTrigger[PaymentReleaseTrigger.QR_CODE_SCAN]++;
                    }
                    else if (lastEvent.event_type === 'manual_payment_release') {
                        releasesByTrigger[PaymentReleaseTrigger.MANUAL_ADMIN]++;
                    }
                    else if (lastEvent.event_type === 'auto_payment_release') {
                        releasesByTrigger[PaymentReleaseTrigger.AUTO_TIMEOUT]++;
                    }
                }
            }
            const totalCourierEarnings = totalAmount - totalPlatformFees;
            const averageReleaseTime = completedAgreements.length > 0
                ? totalReleaseTime / completedAgreements.length / (1000 * 60 * 60)
                : 0;
            return {
                totalReleased: completedAgreements.length,
                totalAmount,
                totalCourierEarnings,
                totalPlatformFees,
                releasesByTrigger,
                averageReleaseTime,
            };
        }
        catch (error) {
            (0, logger_1.logError)('Failed to get payment release stats', error);
            throw error;
        }
    }
    async logPaymentRelease(result, _transaction) {
        try {
            (0, logger_1.logInfo)('Payment release logged', {
                agreementId: result.agreementId,
                amount: result.amount,
                trigger: result.trigger,
                success: result.success,
                timestamp: result.timestamp,
            });
        }
        catch (error) {
            (0, logger_1.logError)('Failed to log payment release', error, { result });
        }
    }
    async sendPaymentReleaseNotifications(agreement, result, _transaction) {
        try {
            (0, logger_1.logInfo)('Payment release notifications sent', {
                agreementId: agreement.id,
                courierId: agreement.courierId,
                amount: result.courierEarnings,
                trigger: result.trigger,
            });
        }
        catch (error) {
            (0, logger_1.logError)('Failed to send payment release notifications', error, {
                agreementId: agreement.id,
            });
        }
    }
}
exports.PaymentReleaseService = PaymentReleaseService;
exports.default = new PaymentReleaseService();
//# sourceMappingURL=PaymentReleaseService.js.map