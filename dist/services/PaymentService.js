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
exports.paymentService = exports.PaymentService = void 0;
const stripe_1 = __importDefault(require("stripe"));
const Booking_1 = __importDefault(require("../models/Booking"));
const Ride_1 = __importDefault(require("../models/Ride"));
const User_1 = __importDefault(require("../models/User"));
const types_1 = require("../types");
const database_1 = require("../config/database");
const logger_1 = __importStar(require("../utils/logger"));
class PaymentService {
    constructor() {
        this.stripe = null;
        if (process.env['STRIPE_SECRET_KEY']) {
            this.stripe = new stripe_1.default(process.env['STRIPE_SECRET_KEY'], {
                apiVersion: '2023-10-16',
            });
        }
    }
    async createPaymentIntent(data) {
        try {
            if (!this.stripe) {
                return {
                    success: true,
                    data: {
                        id: `pi_mock_${Date.now()}`,
                        client_secret: `pi_mock_${Date.now()}_secret_${Math.random().toString(36).substring(7)}`,
                        amount: Math.round(data.amount * 100),
                        currency: data.currency,
                        status: 'requires_payment_method',
                    },
                };
            }
            const booking = await Booking_1.default.findByPk(data.bookingId, {
                include: [
                    {
                        model: Ride_1.default,
                        as: 'ride',
                        include: [
                            {
                                model: User_1.default,
                                as: 'driver',
                                attributes: ['id', 'firstName', 'lastName'],
                            },
                        ],
                    },
                    {
                        model: User_1.default,
                        as: 'passenger',
                        attributes: ['id', 'firstName', 'lastName', 'email'],
                    },
                ],
            });
            if (!booking) {
                return {
                    success: false,
                    error: 'Booking not found',
                };
            }
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: Math.round(data.amount * 100),
                currency: data.currency,
                metadata: {
                    bookingId: booking.id,
                    rideId: booking.rideId,
                    passengerId: booking.passengerId,
                    platformFee: Math.round(booking.platformFee * 100),
                    environment: process.env['NODE_ENV'] || 'development',
                },
                description: data.description || 'ARYV ride booking',
                ...(data.receiptEmail && { receipt_email: data.receiptEmail }),
                automatic_payment_methods: {
                    enabled: true,
                },
                application_fee_amount: Math.round(booking.platformFee * 100),
            });
            logger_1.default.info('Payment intent created', {
                paymentIntentId: paymentIntent.id,
                bookingId: data.bookingId,
                amount: paymentIntent.amount,
            });
            return {
                success: true,
                data: {
                    id: paymentIntent.id,
                    client_secret: paymentIntent.client_secret,
                    amount: paymentIntent.amount,
                    currency: paymentIntent.currency,
                    status: paymentIntent.status,
                },
            };
        }
        catch (error) {
            logger_1.default.error('Error creating payment intent', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                bookingId: data.bookingId,
            });
            return {
                success: false,
                error: (0, logger_1.getErrorMessage)(error),
            };
        }
    }
    async verifyPaymentIntent(paymentIntentId) {
        try {
            if (!this.stripe) {
                return {
                    success: true,
                    data: {
                        id: paymentIntentId,
                        status: paymentIntentId.startsWith('pi_mock_') ? 'succeeded' : 'failed',
                    },
                };
            }
            const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
            logger_1.default.info('Payment intent verified', {
                paymentIntentId: paymentIntent.id,
                status: paymentIntent.status,
                amount: paymentIntent.amount,
            });
            return {
                success: true,
                data: {
                    id: paymentIntent.id,
                    status: paymentIntent.status,
                    amount: paymentIntent.amount,
                    currency: paymentIntent.currency,
                    metadata: paymentIntent.metadata,
                },
            };
        }
        catch (error) {
            logger_1.default.error('Error verifying payment intent', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                paymentIntentId,
            });
            return {
                success: false,
                error: (0, logger_1.getErrorMessage)(error),
            };
        }
    }
    async processRefund(bookingId, amount, reason) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const booking = await Booking_1.default.findByPk(bookingId, {
                include: [
                    {
                        model: Ride_1.default,
                        as: 'ride',
                    },
                ],
                transaction,
            });
            if (!booking || !booking.paymentIntentId) {
                await transaction.rollback();
                return {
                    success: false,
                    error: 'Booking or payment intent not found',
                };
            }
            if (!this.stripe) {
                await transaction.commit();
                return {
                    success: true,
                    data: {
                        id: `re_mock_${Date.now()}`,
                        amount: Math.round((amount || booking.totalAmount) * 100),
                        status: 'succeeded',
                    },
                };
            }
            const refund = await this.stripe.refunds.create({
                payment_intent: booking.paymentIntentId,
                ...(amount && { amount: Math.round(amount * 100) }),
                reason: reason || 'requested_by_customer',
                metadata: {
                    bookingId: booking.id,
                    rideId: booking.rideId,
                    refundReason: reason || 'Booking cancellation',
                },
            });
            await booking.update({
                status: types_1.BookingStatus.CANCELLED,
                cancelReason: reason || 'Refund processed',
            }, { transaction });
            await transaction.commit();
            logger_1.default.info('Refund processed', {
                refundId: refund.id,
                bookingId,
                amount: refund.amount,
                status: refund.status,
            });
            return {
                success: true,
                data: {
                    id: refund.id,
                    amount: refund.amount,
                    status: refund.status,
                    currency: refund.currency,
                },
            };
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error processing refund', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                bookingId,
            });
            return {
                success: false,
                error: (0, logger_1.getErrorMessage)(error),
            };
        }
    }
    async handleWebhookEvent(event) {
        const transaction = await database_1.sequelize.transaction();
        try {
            logger_1.default.info('Processing Stripe webhook event', {
                eventType: event.type,
                eventId: event.id,
            });
            switch (event.type) {
                case 'payment_intent.succeeded':
                    return await this.handlePaymentSucceeded(event.data.object, transaction);
                case 'payment_intent.payment_failed':
                    return await this.handlePaymentFailed(event.data.object, transaction);
                case 'charge.dispute.created':
                    return await this.handleChargeDispute(event.data.object, transaction);
                default:
                    logger_1.default.info('Unhandled webhook event type', { eventType: event.type });
                    await transaction.commit();
                    return { success: true };
            }
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error handling webhook event', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                eventType: event.type,
                eventId: event.id,
            });
            return {
                success: false,
                error: (0, logger_1.getErrorMessage)(error),
            };
        }
    }
    async handlePaymentSucceeded(paymentIntent, transaction) {
        const bookingId = paymentIntent.metadata?.['bookingId'];
        if (!bookingId) {
            await transaction.commit();
            return { success: true };
        }
        const booking = await Booking_1.default.findByPk(bookingId, {
            include: [
                {
                    model: Ride_1.default,
                    as: 'ride',
                },
            ],
            transaction,
        });
        if (!booking) {
            await transaction.commit();
            return { success: true };
        }
        if (booking.status === types_1.BookingStatus.PENDING) {
            await booking.update({
                status: types_1.BookingStatus.CONFIRMED,
            }, { transaction });
        }
        await transaction.commit();
        logger_1.default.info('Payment succeeded, booking updated', {
            bookingId,
            paymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount,
        });
        return { success: true };
    }
    async handlePaymentFailed(paymentIntent, transaction) {
        const bookingId = paymentIntent.metadata?.['bookingId'];
        if (!bookingId) {
            await transaction.commit();
            return { success: true };
        }
        const booking = await Booking_1.default.findByPk(bookingId, { transaction });
        if (!booking) {
            await transaction.commit();
            return { success: true };
        }
        await booking.update({
            cancelReason: 'Payment failed',
        }, { transaction });
        await transaction.commit();
        logger_1.default.warn('Payment failed for booking', {
            bookingId,
            paymentIntentId: paymentIntent.id,
            lastPaymentError: paymentIntent.last_payment_error?.message,
        });
        return { success: true };
    }
    async handleChargeDispute(dispute, transaction) {
        const paymentIntentId = dispute.payment_intent;
        if (!paymentIntentId) {
            await transaction.commit();
            return { success: true };
        }
        const booking = await Booking_1.default.findOne({
            where: { paymentIntentId },
            transaction,
        });
        if (!booking) {
            await transaction.commit();
            return { success: true };
        }
        logger_1.default.warn('Payment dispute created', {
            disputeId: dispute.id,
            bookingId: booking.id,
            amount: dispute.amount,
            reason: dispute.reason,
            status: dispute.status,
        });
        await transaction.commit();
        return { success: true };
    }
    constructWebhookEvent(payload, signature) {
        try {
            if (!this.stripe || !process.env['STRIPE_WEBHOOK_SECRET']) {
                return null;
            }
            return this.stripe.webhooks.constructEvent(payload, signature, process.env['STRIPE_WEBHOOK_SECRET']);
        }
        catch (error) {
            logger_1.default.error('Error constructing webhook event', {
                error: (0, logger_1.getErrorMessage)(error),
            });
            return null;
        }
    }
}
exports.PaymentService = PaymentService;
exports.paymentService = new PaymentService();
exports.default = exports.paymentService;
//# sourceMappingURL=PaymentService.js.map