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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cashWalletService = exports.CashWalletService = void 0;
const database_1 = require("../config/database");
const CashWallet_1 = require("../models/CashWallet");
const User_1 = __importDefault(require("../models/User"));
const logger_1 = __importStar(require("../utils/logger"));
class CashWalletService {
    async createWallet(userId, kycLevel = 'basic') {
        const transaction = await database_1.sequelize.transaction();
        try {
            const user = await User_1.default.findByPk(userId, { transaction });
            if (!user) {
                await transaction.rollback();
                return {
                    success: false,
                    error: 'User not found',
                    code: 'USER_NOT_FOUND',
                };
            }
            const existingWallet = await CashWallet_1.CashWallet.findOne({
                where: { userId },
                transaction,
            });
            if (existingWallet) {
                await transaction.rollback();
                return {
                    success: false,
                    error: 'Wallet already exists for this user',
                    code: 'WALLET_EXISTS',
                };
            }
            const limits = this.getKycLimits(kycLevel);
            const wallet = await CashWallet_1.CashWallet.create({
                userId,
                kycLevel,
                status: 'active',
                currency: 'USD',
                balance: 0,
                dailyLoadLimit: limits.dailyLoadLimit,
                monthlyLoadLimit: limits.monthlyLoadLimit,
                dailySpendLimit: limits.dailySpendLimit,
                monthlySpendLimit: limits.monthlySpendLimit,
                isVerified: kycLevel === 'full',
            }, { transaction });
            await transaction.commit();
            logger_1.default.info('Cash wallet created', {
                userId,
                walletId: wallet.id,
                kycLevel,
            });
            return {
                success: true,
                data: wallet,
            };
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error creating cash wallet', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId,
            });
            return {
                success: false,
                error: (0, logger_1.getErrorMessage)(error),
                code: 'WALLET_CREATION_FAILED',
            };
        }
    }
    async loadWallet(request) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const wallet = await CashWallet_1.CashWallet.findOne({
                where: { userId: request.userId },
                transaction,
                lock: true,
            });
            if (!wallet || wallet.status !== 'active') {
                await transaction.rollback();
                return {
                    success: false,
                    error: 'Wallet not found or inactive',
                    code: 'WALLET_INACTIVE',
                };
            }
            const limitCheck = await this.checkLoadLimits(wallet.id, request.amount, transaction);
            if (!limitCheck.success) {
                await transaction.rollback();
                return limitCheck;
            }
            const sourceValidation = await this.validateLoadSource(request, transaction);
            if (!sourceValidation.success) {
                await transaction.rollback();
                return sourceValidation;
            }
            const balanceBefore = parseFloat(wallet.balance.toString());
            const balanceAfter = balanceBefore + request.amount;
            const walletTransaction = await CashWallet_1.CashWalletTransaction.create({
                walletId: wallet.id,
                type: 'load',
                amount: request.amount,
                currency: wallet.currency,
                balanceBefore,
                balanceAfter,
                status: 'completed',
                source: request.source,
                sourceReference: request.sourceReference,
                description: `Wallet load via ${request.source}`,
                metadata: {
                    ...request.metadata,
                    agentId: request.agentId,
                    location: request.location,
                },
                processedAt: new Date(),
            }, { transaction });
            await wallet.update({
                balance: balanceAfter,
                lastTransactionAt: new Date(),
            }, { transaction });
            await transaction.commit();
            logger_1.default.info('Wallet loaded successfully', {
                userId: request.userId,
                walletId: wallet.id,
                amount: request.amount,
                source: request.source,
                transactionId: walletTransaction.id,
            });
            return {
                success: true,
                data: {
                    transactionId: walletTransaction.id,
                    balanceBefore,
                    balanceAfter,
                    wallet: await this.getWalletBalance(request.userId),
                },
            };
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error loading wallet', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: request.userId,
                amount: request.amount,
            });
            return {
                success: false,
                error: (0, logger_1.getErrorMessage)(error),
                code: 'WALLET_LOAD_FAILED',
            };
        }
    }
    async processPayment(request) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const wallet = await CashWallet_1.CashWallet.findOne({
                where: { userId: request.userId },
                transaction,
                lock: true,
            });
            if (!wallet || wallet.status !== 'active') {
                await transaction.rollback();
                return {
                    success: false,
                    error: 'Wallet not found or inactive',
                    code: 'WALLET_INACTIVE',
                };
            }
            const availableBalance = parseFloat(wallet.balance.toString()) -
                parseFloat(wallet.frozenBalance.toString()) -
                parseFloat(wallet.escrowBalance.toString());
            if (availableBalance < request.amount) {
                await transaction.rollback();
                return {
                    success: false,
                    error: 'Insufficient wallet balance',
                    code: 'INSUFFICIENT_BALANCE',
                };
            }
            const limitCheck = await this.checkSpendingLimits(wallet.id, request.amount, transaction);
            if (!limitCheck.success) {
                await transaction.rollback();
                return limitCheck;
            }
            const balanceBefore = parseFloat(wallet.balance.toString());
            let balanceAfter;
            let escrowBalance = parseFloat(wallet.escrowBalance.toString());
            if (request.escrowHold) {
                escrowBalance += request.amount;
                balanceAfter = balanceBefore;
            }
            else {
                balanceAfter = balanceBefore - request.amount;
            }
            const walletTransaction = await CashWallet_1.CashWalletTransaction.create({
                walletId: wallet.id,
                type: request.escrowHold ? 'escrow_hold' : 'payment',
                amount: request.amount,
                currency: wallet.currency,
                balanceBefore,
                balanceAfter,
                status: 'completed',
                source: 'ride_payment',
                sourceReference: request.bookingId,
                description: request.description,
                metadata: request.metadata,
                processedAt: new Date(),
            }, { transaction });
            await wallet.update({
                balance: balanceAfter,
                escrowBalance: escrowBalance,
                lastTransactionAt: new Date(),
            }, { transaction });
            await transaction.commit();
            logger_1.default.info('Wallet payment processed', {
                userId: request.userId,
                walletId: wallet.id,
                amount: request.amount,
                escrowHold: request.escrowHold,
                transactionId: walletTransaction.id,
            });
            return {
                success: true,
                data: {
                    transactionId: walletTransaction.id,
                    balanceBefore,
                    balanceAfter,
                    escrowHold: request.escrowHold,
                    wallet: await this.getWalletBalance(request.userId),
                },
            };
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error processing wallet payment', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: request.userId,
                amount: request.amount,
            });
            return {
                success: false,
                error: (0, logger_1.getErrorMessage)(error),
                code: 'WALLET_PAYMENT_FAILED',
            };
        }
    }
    async releaseEscrow(walletId, amount, description) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const wallet = await CashWallet_1.CashWallet.findByPk(walletId, {
                transaction,
                lock: true,
            });
            if (!wallet) {
                await transaction.rollback();
                return {
                    success: false,
                    error: 'Wallet not found',
                    code: 'WALLET_NOT_FOUND',
                };
            }
            const escrowBalance = parseFloat(wallet.escrowBalance.toString());
            if (escrowBalance < amount) {
                await transaction.rollback();
                return {
                    success: false,
                    error: 'Insufficient escrow balance',
                    code: 'INSUFFICIENT_ESCROW',
                };
            }
            const balanceBefore = parseFloat(wallet.balance.toString());
            const balanceAfter = balanceBefore - amount;
            const newEscrowBalance = escrowBalance - amount;
            const walletTransaction = await CashWallet_1.CashWalletTransaction.create({
                walletId: wallet.id,
                type: 'escrow_release',
                amount,
                currency: wallet.currency,
                balanceBefore,
                balanceAfter,
                status: 'completed',
                source: 'ride_payment',
                description,
                processedAt: new Date(),
            }, { transaction });
            await wallet.update({
                balance: balanceAfter,
                escrowBalance: newEscrowBalance,
                lastTransactionAt: new Date(),
            }, { transaction });
            await transaction.commit();
            logger_1.default.info('Escrow payment released', {
                walletId: wallet.id,
                amount,
                transactionId: walletTransaction.id,
            });
            return {
                success: true,
                data: {
                    transactionId: walletTransaction.id,
                    balanceBefore,
                    balanceAfter,
                },
            };
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error releasing escrow payment', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                walletId,
                amount,
            });
            return {
                success: false,
                error: (0, logger_1.getErrorMessage)(error),
                code: 'ESCROW_RELEASE_FAILED',
            };
        }
    }
    async transferMoney(request) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const [senderWallet, receiverWallet] = await Promise.all([
                CashWallet_1.CashWallet.findOne({ where: { userId: request.fromUserId }, transaction, lock: true }),
                CashWallet_1.CashWallet.findOne({ where: { userId: request.toUserId }, transaction, lock: true }),
            ]);
            if (!senderWallet || senderWallet.status !== 'active') {
                await transaction.rollback();
                return {
                    success: false,
                    error: 'Sender wallet not found or inactive',
                    code: 'SENDER_WALLET_INACTIVE',
                };
            }
            if (!receiverWallet || receiverWallet.status !== 'active') {
                await transaction.rollback();
                return {
                    success: false,
                    error: 'Receiver wallet not found or inactive',
                    code: 'RECEIVER_WALLET_INACTIVE',
                };
            }
            const senderAvailableBalance = parseFloat(senderWallet.balance.toString()) -
                parseFloat(senderWallet.frozenBalance.toString()) -
                parseFloat(senderWallet.escrowBalance.toString());
            if (senderAvailableBalance < request.amount) {
                await transaction.rollback();
                return {
                    success: false,
                    error: 'Insufficient balance',
                    code: 'INSUFFICIENT_BALANCE',
                };
            }
            const senderBalanceBefore = parseFloat(senderWallet.balance.toString());
            const senderBalanceAfter = senderBalanceBefore - request.amount;
            const receiverBalanceBefore = parseFloat(receiverWallet.balance.toString());
            const receiverBalanceAfter = receiverBalanceBefore + request.amount;
            await Promise.all([
                CashWallet_1.CashWalletTransaction.create({
                    walletId: senderWallet.id,
                    type: 'transfer',
                    amount: -request.amount,
                    currency: senderWallet.currency,
                    balanceBefore: senderBalanceBefore,
                    balanceAfter: senderBalanceAfter,
                    status: 'completed',
                    source: 'mobile_money',
                    sourceReference: `transfer_to_${request.toUserId}`,
                    description: `Transfer to user ${request.toUserId}: ${request.description}`,
                    metadata: request.metadata,
                    processedAt: new Date(),
                }, { transaction }),
                CashWallet_1.CashWalletTransaction.create({
                    walletId: receiverWallet.id,
                    type: 'transfer',
                    amount: request.amount,
                    currency: receiverWallet.currency,
                    balanceBefore: receiverBalanceBefore,
                    balanceAfter: receiverBalanceAfter,
                    status: 'completed',
                    source: 'mobile_money',
                    sourceReference: `transfer_from_${request.fromUserId}`,
                    description: `Transfer from user ${request.fromUserId}: ${request.description}`,
                    metadata: request.metadata,
                    processedAt: new Date(),
                }, { transaction }),
            ]);
            await Promise.all([
                senderWallet.update({
                    balance: senderBalanceAfter,
                    lastTransactionAt: new Date(),
                }, { transaction }),
                receiverWallet.update({
                    balance: receiverBalanceAfter,
                    lastTransactionAt: new Date(),
                }, { transaction }),
            ]);
            await transaction.commit();
            logger_1.default.info('Wallet transfer completed', {
                fromUserId: request.fromUserId,
                toUserId: request.toUserId,
                amount: request.amount,
            });
            return {
                success: true,
                data: {
                    senderBalance: senderBalanceAfter,
                    receiverBalance: receiverBalanceAfter,
                },
            };
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error transferring money', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                fromUserId: request.fromUserId,
                toUserId: request.toUserId,
            });
            return {
                success: false,
                error: (0, logger_1.getErrorMessage)(error),
                code: 'TRANSFER_FAILED',
            };
        }
    }
    async getWalletBalance(userId) {
        try {
            const wallet = await CashWallet_1.CashWallet.findOne({
                where: { userId },
                include: [
                    {
                        model: User_1.default,
                        as: 'user',
                        attributes: ['id', 'firstName', 'lastName', 'email'],
                    },
                ],
            });
            if (!wallet) {
                return {
                    success: false,
                    error: 'Wallet not found',
                    code: 'WALLET_NOT_FOUND',
                };
            }
            const availableBalance = parseFloat(wallet.balance.toString()) -
                parseFloat(wallet.frozenBalance.toString()) -
                parseFloat(wallet.escrowBalance.toString());
            return {
                success: true,
                data: {
                    id: wallet.id,
                    balance: parseFloat(wallet.balance.toString()),
                    availableBalance,
                    frozenBalance: parseFloat(wallet.frozenBalance.toString()),
                    escrowBalance: parseFloat(wallet.escrowBalance.toString()),
                    currency: wallet.currency,
                    status: wallet.status,
                    kycLevel: wallet.kycLevel,
                    isVerified: wallet.isVerified,
                    limits: {
                        dailyLoadLimit: parseFloat(wallet.dailyLoadLimit.toString()),
                        monthlyLoadLimit: parseFloat(wallet.monthlyLoadLimit.toString()),
                        dailySpendLimit: parseFloat(wallet.dailySpendLimit.toString()),
                        monthlySpendLimit: parseFloat(wallet.monthlySpendLimit.toString()),
                    },
                    lastTransactionAt: wallet.lastTransactionAt,
                },
            };
        }
        catch (error) {
            logger_1.default.error('Error getting wallet balance', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId,
            });
            return {
                success: false,
                error: (0, logger_1.getErrorMessage)(error),
                code: 'WALLET_BALANCE_FETCH_FAILED',
            };
        }
    }
    async getTransactionHistory(userId, limit = 50, offset = 0) {
        try {
            const wallet = await CashWallet_1.CashWallet.findOne({
                where: { userId },
            });
            if (!wallet) {
                return {
                    success: false,
                    error: 'Wallet not found',
                    code: 'WALLET_NOT_FOUND',
                };
            }
            const { count, rows: transactions } = await CashWallet_1.CashWalletTransaction.findAndCountAll({
                where: { walletId: wallet.id },
                order: [['createdAt', 'DESC']],
                limit,
                offset,
            });
            return {
                success: true,
                data: {
                    transactions: transactions.map(tx => ({
                        id: tx.id,
                        type: tx.type,
                        amount: parseFloat(tx.amount.toString()),
                        currency: tx.currency,
                        balanceBefore: parseFloat(tx.balanceBefore.toString()),
                        balanceAfter: parseFloat(tx.balanceAfter.toString()),
                        status: tx.status,
                        source: tx.source,
                        sourceReference: tx.sourceReference,
                        description: tx.description,
                        metadata: tx.metadata,
                        processedAt: tx.processedAt,
                        createdAt: tx.createdAt,
                    })),
                    pagination: {
                        total: count,
                        limit,
                        offset,
                        hasMore: count > offset + limit,
                    },
                },
            };
        }
        catch (error) {
            logger_1.default.error('Error getting transaction history', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId,
            });
            return {
                success: false,
                error: (0, logger_1.getErrorMessage)(error),
                code: 'TRANSACTION_HISTORY_FETCH_FAILED',
            };
        }
    }
    getKycLimits(kycLevel) {
        switch (kycLevel) {
            case 'basic':
                return {
                    dailyLoadLimit: 200.00,
                    monthlyLoadLimit: 2000.00,
                    dailySpendLimit: 300.00,
                    monthlySpendLimit: 3000.00,
                };
            case 'enhanced':
                return {
                    dailyLoadLimit: 1000.00,
                    monthlyLoadLimit: 15000.00,
                    dailySpendLimit: 1500.00,
                    monthlySpendLimit: 20000.00,
                };
            case 'full':
                return {
                    dailyLoadLimit: 5000.00,
                    monthlyLoadLimit: 100000.00,
                    dailySpendLimit: 10000.00,
                    monthlySpendLimit: 150000.00,
                };
        }
    }
    async checkLoadLimits(walletId, amount, transaction) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const dailyLoads = await CashWallet_1.CashWalletTransaction.sum('amount', {
            where: {
                walletId,
                type: 'load',
                status: 'completed',
                createdAt: {
                    $gte: today,
                },
            },
            transaction,
        });
        const monthlyLoads = await CashWallet_1.CashWalletTransaction.sum('amount', {
            where: {
                walletId,
                type: 'load',
                status: 'completed',
                createdAt: {
                    $gte: thisMonth,
                },
            },
            transaction,
        });
        const wallet = await CashWallet_1.CashWallet.findByPk(walletId, { transaction });
        if (!wallet) {
            return {
                success: false,
                error: 'Wallet not found',
                code: 'WALLET_NOT_FOUND',
            };
        }
        const dailyTotal = (dailyLoads || 0) + amount;
        const monthlyTotal = (monthlyLoads || 0) + amount;
        if (dailyTotal > parseFloat(wallet.dailyLoadLimit.toString())) {
            return {
                success: false,
                error: `Daily load limit exceeded. Limit: $${wallet.dailyLoadLimit}, Current: $${dailyLoads || 0}`,
                code: 'DAILY_LOAD_LIMIT_EXCEEDED',
            };
        }
        if (monthlyTotal > parseFloat(wallet.monthlyLoadLimit.toString())) {
            return {
                success: false,
                error: `Monthly load limit exceeded. Limit: $${wallet.monthlyLoadLimit}, Current: $${monthlyLoads || 0}`,
                code: 'MONTHLY_LOAD_LIMIT_EXCEEDED',
            };
        }
        return { success: true };
    }
    async checkSpendingLimits(walletId, amount, transaction) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const dailySpending = await CashWallet_1.CashWalletTransaction.sum('amount', {
            where: {
                walletId,
                type: ['payment', 'transfer'],
                status: 'completed',
                createdAt: {
                    $gte: today,
                },
            },
            transaction,
        });
        const monthlySpending = await CashWallet_1.CashWalletTransaction.sum('amount', {
            where: {
                walletId,
                type: ['payment', 'transfer'],
                status: 'completed',
                createdAt: {
                    $gte: thisMonth,
                },
            },
            transaction,
        });
        const wallet = await CashWallet_1.CashWallet.findByPk(walletId, { transaction });
        if (!wallet) {
            return {
                success: false,
                error: 'Wallet not found',
                code: 'WALLET_NOT_FOUND',
            };
        }
        const dailyTotal = (dailySpending || 0) + amount;
        const monthlyTotal = (monthlySpending || 0) + amount;
        if (dailyTotal > parseFloat(wallet.dailySpendLimit.toString())) {
            return {
                success: false,
                error: `Daily spending limit exceeded. Limit: $${wallet.dailySpendLimit}, Current: $${dailySpending || 0}`,
                code: 'DAILY_SPEND_LIMIT_EXCEEDED',
            };
        }
        if (monthlyTotal > parseFloat(wallet.monthlySpendLimit.toString())) {
            return {
                success: false,
                error: `Monthly spending limit exceeded. Limit: $${wallet.monthlySpendLimit}, Current: $${monthlySpending || 0}`,
                code: 'MONTHLY_SPEND_LIMIT_EXCEEDED',
            };
        }
        return { success: true };
    }
    async validateLoadSource(request, _transaction) {
        switch (request.source) {
            case 'agent':
                if (!request.agentId) {
                    return {
                        success: false,
                        error: 'Agent ID is required for agent loads',
                        code: 'AGENT_ID_REQUIRED',
                    };
                }
                break;
            case 'kiosk':
            case 'partner_store':
                if (!request.location) {
                    return {
                        success: false,
                        error: 'Location is required for kiosk/partner store loads',
                        code: 'LOCATION_REQUIRED',
                    };
                }
                break;
            case 'mobile_money':
                break;
            case 'voucher':
                break;
        }
        return { success: true };
    }
}
exports.CashWalletService = CashWalletService;
exports.cashWalletService = new CashWalletService();
exports.default = exports.cashWalletService;
//# sourceMappingURL=CashWalletService.js.map