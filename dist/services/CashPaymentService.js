"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CashPaymentService = void 0;
const database_1 = require("../config/database");
const CashTransaction_1 = __importStar(require("../models/CashTransaction"));
const UserWallet_1 = __importStar(require("../models/UserWallet"));
const models_1 = require("../models");
const NotificationService_1 = require("./NotificationService");
const logger_1 = require("../utils/logger");
class CashPaymentService {
    constructor() {
        this.notificationService = new NotificationService_1.NotificationService();
    }
    async createCashPayment(bookingId, riderId, driverId, amount) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const booking = await models_1.Booking.findByPk(bookingId, { transaction });
            if (!booking) {
                throw new Error('Booking not found');
            }
            const canPay = await this.checkCashPaymentEligibility(riderId, amount, transaction);
            if (!canPay.eligible) {
                return {
                    success: false,
                    error: canPay.reason || 'Payment not eligible',
                    trustScore: canPay.trustScore,
                };
            }
            const riderCode = this.generateConfirmationCode();
            const driverCode = this.generateConfirmationCode();
            const platformFee = this.calculatePlatformFee(amount);
            const cashTransaction = await CashTransaction_1.default.create({
                bookingId,
                riderId,
                driverId,
                amount,
                platformFee,
                expectedAmount: amount,
                riderConfirmationCode: riderCode,
                driverConfirmationCode: driverCode,
                expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
                metadata: {
                    createdBy: 'cash_payment_service',
                    version: '1.0',
                },
            }, { transaction });
            await booking.update({
                cashTransactionId: cashTransaction.id,
                paymentMethod: 'cash',
            }, { transaction });
            await this.createTrustHold(riderId, amount, cashTransaction.id, transaction);
            await transaction.commit();
            await this.sendCashPaymentNotifications(riderId, driverId, amount, riderCode);
            (0, logger_1.logInfo)('Cash payment created successfully', {
                transactionId: cashTransaction.id,
                bookingId,
                amount,
                riderId,
                driverId,
            });
            return {
                success: true,
                transactionId: cashTransaction.id,
                riderCode,
                driverCode: null,
                instructions: this.getCashPaymentInstructions(amount),
                trustScore: canPay.trustScore || 0,
            };
        }
        catch (error) {
            await transaction.rollback();
            (0, logger_1.logError)('Error creating cash payment', error, {
                bookingId,
                riderId,
                driverId,
                amount,
            });
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async confirmCashReceived(transactionId, driverId, actualAmount, location) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const cashTransaction = await CashTransaction_1.default.findByPk(transactionId, { transaction });
            if (!cashTransaction) {
                throw new Error('Transaction not found');
            }
            if (cashTransaction.driverId !== driverId) {
                await this.logSuspiciousActivity(driverId, 'unauthorized_confirmation_attempt', {
                    transactionId,
                    actualDriverId: cashTransaction.driverId,
                });
                throw new Error('Unauthorized driver');
            }
            if (![CashTransaction_1.CashPaymentStatus.PENDING_VERIFICATION, CashTransaction_1.CashPaymentStatus.RIDER_CONFIRMED].includes(cashTransaction.status)) {
                throw new Error(`Cannot confirm transaction in status: ${cashTransaction.status}`);
            }
            const amountDifference = Math.abs(actualAmount - cashTransaction.expectedAmount);
            const fraudFlags = [];
            let riskScore = 0;
            if (amountDifference > 0.50) {
                fraudFlags.push('amount_discrepancy');
                riskScore += 30;
                (0, logger_1.logWarning)('Amount discrepancy detected', {
                    transactionId,
                    expected: cashTransaction.expectedAmount,
                    actual: actualAmount,
                    difference: amountDifference,
                });
            }
            let locationVerified = false;
            if (location) {
                locationVerified = await this.verifyTransactionLocation(transactionId, location);
                if (!locationVerified) {
                    fraudFlags.push('location_anomaly');
                    riskScore += 20;
                }
            }
            const newStatus = cashTransaction.status === CashTransaction_1.CashPaymentStatus.RIDER_CONFIRMED
                ? CashTransaction_1.CashPaymentStatus.BOTH_CONFIRMED
                : CashTransaction_1.CashPaymentStatus.DRIVER_CONFIRMED;
            await cashTransaction.update({
                status: newStatus,
                driverConfirmedAt: new Date(),
                actualAmountClaimed: actualAmount,
                gpsLocationConfirmed: locationVerified,
                transactionLocation: location ? {
                    lat: location.lat,
                    lng: location.lng,
                    accuracy: location.accuracy,
                    confirmedAt: new Date(),
                } : null,
                riskScore,
                fraudFlags: fraudFlags.length > 0 ? fraudFlags : null,
            }, { transaction });
            await transaction.commit();
            if (newStatus === CashTransaction_1.CashPaymentStatus.BOTH_CONFIRMED) {
                await this.completeCashTransaction(transactionId);
                return {
                    success: true,
                    status: 'completed',
                    message: 'Cash payment completed successfully',
                    nextStep: 'Transaction completed',
                };
            }
            await this.notifyRiderForConfirmation(cashTransaction.riderId, transactionId);
            return {
                success: true,
                status: 'awaiting_rider_confirmation',
                message: 'Waiting for rider to confirm payment',
                nextStep: 'Rider needs to enter confirmation code',
            };
        }
        catch (error) {
            await transaction.rollback();
            (0, logger_1.logError)('Error confirming cash received', error, {
                transactionId,
                driverId,
                actualAmount,
            });
            return {
                success: false,
                status: 'failed',
                message: 'Failed to confirm cash receipt',
                error: error.message,
            };
        }
    }
    async confirmCashPaid(transactionId, riderId, confirmationCode) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const cashTransaction = await CashTransaction_1.default.findByPk(transactionId, { transaction });
            if (!cashTransaction) {
                throw new Error('Transaction not found');
            }
            if (cashTransaction.riderId !== riderId) {
                await this.logSuspiciousActivity(riderId, 'unauthorized_confirmation_attempt', {
                    transactionId,
                    actualRiderId: cashTransaction.riderId,
                });
                throw new Error('Unauthorized rider');
            }
            if (cashTransaction.riderConfirmationCode !== confirmationCode) {
                await this.logSuspiciousActivity(riderId, 'invalid_confirmation_code', {
                    transactionId,
                    providedCode: confirmationCode,
                });
                throw new Error('Invalid confirmation code');
            }
            if (![CashTransaction_1.CashPaymentStatus.PENDING_VERIFICATION, CashTransaction_1.CashPaymentStatus.DRIVER_CONFIRMED].includes(cashTransaction.status)) {
                throw new Error(`Cannot confirm transaction in status: ${cashTransaction.status}`);
            }
            const newStatus = cashTransaction.status === CashTransaction_1.CashPaymentStatus.DRIVER_CONFIRMED
                ? CashTransaction_1.CashPaymentStatus.BOTH_CONFIRMED
                : CashTransaction_1.CashPaymentStatus.RIDER_CONFIRMED;
            await cashTransaction.update({
                status: newStatus,
                riderConfirmedAt: new Date(),
            }, { transaction });
            await transaction.commit();
            if (newStatus === CashTransaction_1.CashPaymentStatus.BOTH_CONFIRMED) {
                await this.completeCashTransaction(transactionId);
                return {
                    success: true,
                    status: 'completed',
                    message: 'Cash payment completed successfully',
                    nextStep: 'Transaction completed',
                };
            }
            return {
                success: true,
                status: 'awaiting_driver_confirmation',
                message: 'Waiting for driver to confirm cash received',
                nextStep: 'Driver needs to confirm receipt',
            };
        }
        catch (error) {
            await transaction.rollback();
            (0, logger_1.logError)('Error confirming cash paid', error, {
                transactionId,
                riderId,
            });
            return {
                success: false,
                status: 'failed',
                message: 'Failed to confirm cash payment',
                error: error.message,
            };
        }
    }
    async checkCashPaymentEligibility(userId, amount, transaction) {
        let wallet = await UserWallet_1.default.findOne({
            where: { userId },
            transaction,
        });
        if (!wallet) {
            wallet = await UserWallet_1.default.create({ userId }, { transaction });
        }
        if (wallet.isSuspended) {
            return {
                eligible: false,
                reason: `Account suspended: ${wallet.suspensionReason}`,
                trustScore: wallet.trustScore,
            };
        }
        const requiredTrust = this.calculateRequiredTrust(amount);
        if (wallet.trustScore < requiredTrust) {
            return {
                eligible: false,
                reason: `Insufficient trust score. Required: ${requiredTrust}, Current: ${wallet.trustScore}`,
                trustScore: wallet.trustScore,
            };
        }
        const limitCheck = await this.checkTransactionLimits(wallet, amount);
        if (!limitCheck.withinLimits) {
            return {
                eligible: false,
                reason: limitCheck.reason || 'Limit exceeded',
                trustScore: wallet.trustScore,
            };
        }
        return {
            eligible: true,
            trustScore: wallet.trustScore,
        };
    }
    calculateRequiredTrust(amount) {
        if (amount <= 10)
            return 20;
        if (amount <= 50)
            return 40;
        if (amount <= 100)
            return 60;
        if (amount <= 500)
            return 80;
        return 90;
    }
    async checkTransactionLimits(wallet, amount) {
        await this.resetLimitCountersIfNeeded(wallet);
        if (wallet.dailyCashUsed + amount > wallet.dailyCashLimit) {
            return {
                withinLimits: false,
                reason: `Daily limit exceeded. Used: $${wallet.dailyCashUsed}, Limit: $${wallet.dailyCashLimit}`,
            };
        }
        if (wallet.weeklyCashUsed + amount > wallet.weeklyCashLimit) {
            return {
                withinLimits: false,
                reason: `Weekly limit exceeded. Used: $${wallet.weeklyCashUsed}, Limit: $${wallet.weeklyCashLimit}`,
            };
        }
        if (wallet.monthlyCashUsed + amount > wallet.monthlyCashLimit) {
            return {
                withinLimits: false,
                reason: `Monthly limit exceeded. Used: $${wallet.monthlyCashUsed}, Limit: $${wallet.monthlyCashLimit}`,
            };
        }
        return { withinLimits: true };
    }
    generateConfirmationCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
    calculatePlatformFee(amount) {
        const feePercentage = 0.10;
        const maxFee = 10.00;
        return Math.min(amount * feePercentage, maxFee);
    }
    async createTrustHold(userId, amount, transactionId, transaction) {
        await database_1.sequelize.models['TrustHold'].create({
            userId,
            transactionId,
            amount,
            reason: 'cash_transaction_hold',
            expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        }, { transaction });
    }
    async completeCashTransaction(transactionId) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const cashTransaction = await CashTransaction_1.default.findByPk(transactionId, { transaction });
            if (!cashTransaction) {
                throw new Error('Transaction not found');
            }
            await cashTransaction.update({
                status: CashTransaction_1.CashPaymentStatus.COMPLETED,
            }, { transaction });
            const riderWallet = await UserWallet_1.default.findOne({
                where: { userId: cashTransaction.riderId },
                transaction,
            });
            if (riderWallet) {
                const newTrustScore = await this.calculateNewTrustScore(riderWallet, true);
                await riderWallet.update({
                    completedCashTransactions: riderWallet.completedCashTransactions + 1,
                    successfulTransactions: riderWallet.successfulTransactions + 1,
                    totalTransactionValue: riderWallet.totalTransactionValue + cashTransaction.amount,
                    trustScore: newTrustScore,
                    lastTrustScoreUpdate: new Date(),
                    dailyCashUsed: riderWallet.dailyCashUsed + cashTransaction.amount,
                    weeklyCashUsed: riderWallet.weeklyCashUsed + cashTransaction.amount,
                    monthlyCashUsed: riderWallet.monthlyCashUsed + cashTransaction.amount,
                }, { transaction });
            }
            const driverWallet = await UserWallet_1.default.findOne({
                where: { userId: cashTransaction.driverId },
                transaction,
            });
            if (driverWallet) {
                const newTrustScore = await this.calculateNewTrustScore(driverWallet, true);
                await driverWallet.update({
                    completedCashTransactions: driverWallet.completedCashTransactions + 1,
                    successfulTransactions: driverWallet.successfulTransactions + 1,
                    trustScore: newTrustScore,
                    lastTrustScoreUpdate: new Date(),
                }, { transaction });
            }
            await database_1.sequelize.models['TrustHold'].destroy({
                where: { transactionId },
                transaction,
            });
            await models_1.Booking.update({ paymentStatus: 'completed' }, { where: { cashTransactionId: transactionId }, transaction });
            await transaction.commit();
            (0, logger_1.logInfo)('Cash transaction completed successfully', {
                transactionId,
                riderId: cashTransaction.riderId,
                driverId: cashTransaction.driverId,
                amount: cashTransaction.amount,
            });
        }
        catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    async calculateNewTrustScore(wallet, successful) {
        const totalTransactions = wallet.completedCashTransactions + 1;
        const disputeRate = wallet.disputedTransactions / totalTransactions;
        const successRate = (wallet.successfulTransactions + (successful ? 1 : 0)) / totalTransactions;
        let score = 50;
        score += Math.min(totalTransactions * 2, 30);
        score += successRate * 20;
        score -= disputeRate * 40;
        score += this.getVerificationBonus(wallet);
        return Math.max(0, Math.min(100, Math.round(score)));
    }
    getVerificationBonus(wallet) {
        let bonus = 0;
        if (wallet.phoneVerified)
            bonus += 5;
        if (wallet.idVerified)
            bonus += 10;
        if (wallet.addressVerified)
            bonus += 5;
        if (wallet.verificationLevel === UserWallet_1.VerificationLevel.PREMIUM)
            bonus += 10;
        return bonus;
    }
    getCashPaymentInstructions(amount) {
        return `Please pay exactly $${amount.toFixed(2)} in cash to your driver. After payment, the driver will confirm receipt and you'll need to enter your confirmation code to complete the transaction.`;
    }
    async sendCashPaymentNotifications(riderId, driverId, amount, riderCode) {
        try {
            await this.notificationService.sendNotification(riderId, {
                title: 'Cash Payment Created',
                body: `Pay $${amount.toFixed(2)} in cash. Your confirmation code: ${riderCode}`,
                type: 'cash_payment_created',
                data: { amount, riderCode },
            });
            await this.notificationService.sendNotification(driverId, {
                title: 'Cash Payment Expected',
                body: `Passenger will pay $${amount.toFixed(2)} in cash`,
                type: 'cash_payment_expected',
                data: { amount },
            });
        }
        catch (error) {
            (0, logger_1.logError)('Error sending cash payment notifications', error);
        }
    }
    async notifyRiderForConfirmation(riderId, transactionId) {
        try {
            await this.notificationService.sendNotification(riderId, {
                title: 'Confirm Your Cash Payment',
                body: 'Driver confirmed receipt. Please enter your confirmation code.',
                type: 'rider_confirmation_needed',
                data: { transactionId },
            });
        }
        catch (error) {
            (0, logger_1.logError)('Error sending rider confirmation notification', error);
        }
    }
    async logSuspiciousActivity(userId, activity, metadata) {
        (0, logger_1.logWarning)('Suspicious cash payment activity detected', {
            userId,
            activity,
            metadata,
            timestamp: new Date().toISOString(),
        });
    }
    async verifyTransactionLocation(_transactionId, location) {
        return (location.lat >= -90 && location.lat <= 90 &&
            location.lng >= -180 && location.lng <= 180);
    }
    async resetLimitCountersIfNeeded(wallet) {
        const now = new Date();
        const lastReset = new Date(wallet.lastResetDate);
        if (now.getDate() !== lastReset.getDate() ||
            now.getMonth() !== lastReset.getMonth() ||
            now.getFullYear() !== lastReset.getFullYear()) {
            wallet.dailyCashUsed = 0;
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            if (lastReset < weekStart) {
                wallet.weeklyCashUsed = 0;
            }
            if (now.getMonth() !== lastReset.getMonth() ||
                now.getFullYear() !== lastReset.getFullYear()) {
                wallet.monthlyCashUsed = 0;
            }
            wallet.lastResetDate = now;
            await wallet.save();
        }
    }
}
exports.CashPaymentService = CashPaymentService;
exports.default = CashPaymentService;
//# sourceMappingURL=CashPaymentService.js.map