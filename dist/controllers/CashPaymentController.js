"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CashPaymentController = void 0;
const express_validator_1 = require("express-validator");
const CashPaymentService_1 = __importDefault(require("../services/CashPaymentService"));
const CashTransaction_1 = __importDefault(require("../models/CashTransaction"));
const UserWallet_1 = __importDefault(require("../models/UserWallet"));
const logger_1 = require("../utils/logger");
const database_1 = require("../config/database");
class CashPaymentController {
    constructor() {
        this.cashPaymentService = new CashPaymentService_1.default();
    }
    async createCashPayment(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array(),
                });
                return;
            }
            const { bookingId, driverId, amount } = req.body;
            const riderId = req.user?.id;
            if (!riderId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            const result = await this.cashPaymentService.createCashPayment(bookingId, riderId, driverId, parseFloat(amount));
            if (result.success) {
                res.status(201).json({
                    success: true,
                    data: {
                        transactionId: result.transactionId,
                        riderCode: result.riderCode,
                        instructions: result.instructions,
                        trustScore: result.trustScore,
                    },
                    message: 'Cash payment created successfully',
                    timestamp: new Date().toISOString(),
                });
            }
            else {
                res.status(400).json({
                    success: false,
                    error: result.error,
                    trustScore: result.trustScore,
                });
            }
        }
        catch (error) {
            (0, logger_1.logError)('Error in createCashPayment', error, {
                userId: req.user?.id,
                body: req.body,
            });
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    async confirmCashReceived(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array(),
                });
                return;
            }
            const { transactionId } = req.params;
            const { actualAmount, location } = req.body;
            const driverId = req.user?.id;
            if (!driverId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            const result = await this.cashPaymentService.confirmCashReceived(transactionId, driverId, parseFloat(actualAmount), location);
            if (result.success) {
                res.json({
                    success: true,
                    data: {
                        status: result.status,
                        message: result.message,
                        nextStep: result.nextStep,
                    },
                    timestamp: new Date().toISOString(),
                });
            }
            else {
                res.status(400).json({
                    success: false,
                    error: result.error || result.message,
                });
            }
        }
        catch (error) {
            (0, logger_1.logError)('Error in confirmCashReceived', error, {
                userId: req.user?.id,
                transactionId: req.params['transactionId'],
            });
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    async confirmCashPaid(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array(),
                });
                return;
            }
            const { transactionId } = req.params;
            const { confirmationCode } = req.body;
            const riderId = req.user?.id;
            if (!riderId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            const result = await this.cashPaymentService.confirmCashPaid(transactionId, riderId, confirmationCode);
            if (result.success) {
                res.json({
                    success: true,
                    data: {
                        status: result.status,
                        message: result.message,
                        nextStep: result.nextStep,
                    },
                    timestamp: new Date().toISOString(),
                });
            }
            else {
                res.status(400).json({
                    success: false,
                    error: result.error || result.message,
                });
            }
        }
        catch (error) {
            (0, logger_1.logError)('Error in confirmCashPaid', error, {
                userId: req.user?.id,
                transactionId: req.params['transactionId'],
            });
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    async getCashTransaction(req, res) {
        try {
            const { transactionId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            const transaction = await CashTransaction_1.default.findByPk(transactionId);
            if (!transaction) {
                res.status(404).json({
                    success: false,
                    error: 'Transaction not found',
                });
                return;
            }
            if (transaction.riderId !== userId && transaction.driverId !== userId) {
                res.status(403).json({
                    success: false,
                    error: 'Access denied',
                });
                return;
            }
            const isRider = transaction.riderId === userId;
            const responseData = {
                id: transaction.id,
                bookingId: transaction.bookingId,
                amount: transaction.amount,
                expectedAmount: transaction.expectedAmount,
                actualAmountClaimed: transaction.actualAmountClaimed,
                status: transaction.status,
                platformFee: transaction.platformFee,
                riderConfirmedAt: transaction.riderConfirmedAt,
                driverConfirmedAt: transaction.driverConfirmedAt,
                createdAt: transaction.createdAt,
                expiresAt: transaction.expiresAt,
                riskScore: transaction.riskScore,
                confirmationCode: isRider ? transaction.riderConfirmationCode : transaction.driverConfirmationCode,
                userRole: isRider ? 'rider' : 'driver',
            };
            res.json({
                success: true,
                data: responseData,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            (0, logger_1.logError)('Error in getCashTransaction', error, {
                userId: req.user?.id,
                transactionId: req.params['transactionId'],
            });
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    async getCashTransactionHistory(req, res) {
        try {
            const userId = req.user?.id;
            const { limit = 20, offset = 0, status } = req.query;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            const whereClause = {
                [require('sequelize').Op.or]: [
                    { riderId: userId },
                    { driverId: userId },
                ],
            };
            if (status) {
                whereClause.status = status;
            }
            const transactions = await CashTransaction_1.default.findAndCountAll({
                where: whereClause,
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['createdAt', 'DESC']],
                include: [
                    {
                        association: 'booking',
                        attributes: ['id', 'rideId'],
                    },
                ],
            });
            const transactionsWithRole = transactions.rows.map(tx => ({
                id: tx.id,
                bookingId: tx.bookingId,
                amount: tx.amount,
                status: tx.status,
                platformFee: tx.platformFee,
                createdAt: tx.createdAt,
                userRole: tx.riderId === userId ? 'rider' : 'driver',
                riskScore: tx.riskScore,
            }));
            res.json({
                success: true,
                data: {
                    transactions: transactionsWithRole,
                    total: transactions.count,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            (0, logger_1.logError)('Error in getCashTransactionHistory', error, {
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    async getWalletInfo(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            let wallet = await UserWallet_1.default.findOne({ where: { userId } });
            if (!wallet) {
                wallet = await UserWallet_1.default.create({ userId });
            }
            res.json({
                success: true,
                data: {
                    trustScore: wallet.trustScore,
                    verificationLevel: wallet.verificationLevel,
                    completedTransactions: wallet.completedCashTransactions,
                    disputedTransactions: wallet.disputedTransactions,
                    dailyCashLimit: wallet.dailyCashLimit,
                    weeklyCashLimit: wallet.weeklyCashLimit,
                    monthlyCashLimit: wallet.monthlyCashLimit,
                    dailyCashUsed: wallet.dailyCashUsed,
                    weeklyCashUsed: wallet.weeklyCashUsed,
                    monthlyCashUsed: wallet.monthlyCashUsed,
                    phoneVerified: wallet.phoneVerified,
                    idVerified: wallet.idVerified,
                    addressVerified: wallet.addressVerified,
                    isSuspended: wallet.isSuspended,
                    suspensionReason: wallet.suspensionReason,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            (0, logger_1.logError)('Error in getWalletInfo', error, {
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    async reportDispute(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array(),
                });
                return;
            }
            const { transactionId } = req.params;
            const { reason, description, evidence } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            const transaction = await CashTransaction_1.default.findByPk(transactionId);
            if (!transaction) {
                res.status(404).json({
                    success: false,
                    error: 'Transaction not found',
                });
                return;
            }
            if (transaction.riderId !== userId && transaction.driverId !== userId) {
                res.status(403).json({
                    success: false,
                    error: 'Access denied',
                });
                return;
            }
            const dispute = await database_1.sequelize.models['CashDispute'].create({
                transactionId,
                reporterId: userId,
                reason,
                description,
                evidence: evidence ? JSON.stringify(evidence) : null,
                priority: this.calculateDisputePriority(reason, transaction.amount),
                status: 'open',
            });
            await transaction.update({
                status: 'disputed',
                disputeReason: reason,
            });
            (0, logger_1.logInfo)('Cash payment dispute created', {
                disputeId: dispute.id,
                transactionId,
                reporterId: userId,
                reason,
            });
            res.status(201).json({
                success: true,
                data: {
                    disputeId: dispute.id,
                    status: 'dispute_created',
                    message: 'Dispute has been reported and will be reviewed within 24-48 hours',
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            (0, logger_1.logError)('Error in reportDispute', error, {
                userId: req.user?.id,
                transactionId: req.params['transactionId'],
            });
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    calculateDisputePriority(reason, amount) {
        let priority = 50;
        if (reason.includes('fraud') || reason.includes('theft')) {
            priority = 90;
        }
        else if (reason.includes('wrong_amount') || reason.includes('no_payment')) {
            priority = 80;
        }
        else if (reason.includes('driver_issue') || reason.includes('rider_issue')) {
            priority = 70;
        }
        if (amount > 100) {
            priority += 10;
        }
        else if (amount > 500) {
            priority += 20;
        }
        return Math.min(100, priority);
    }
}
exports.CashPaymentController = CashPaymentController;
exports.default = CashPaymentController;
//# sourceMappingURL=CashPaymentController.js.map