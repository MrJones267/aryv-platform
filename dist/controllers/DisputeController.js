"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisputeController = void 0;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const DeliveryDispute_1 = require("../models/DeliveryDispute");
const DeliveryAgreement_1 = require("../models/DeliveryAgreement");
const database_1 = require("../config/database");
const CourierEscrowService_1 = __importDefault(require("../services/CourierEscrowService"));
class DisputeController {
    async createDispute(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const userId = req.user?.id;
            const { agreementId } = req.params;
            const { disputeType, description, evidenceImages } = req.body;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                    code: 'UNAUTHORIZED',
                });
                return;
            }
            const agreement = await models_1.DeliveryAgreement.findByPk(agreementId, {
                include: [{
                        model: models_1.Package,
                        as: 'package',
                        include: [{
                                model: models_1.User,
                                as: 'sender',
                            }],
                    }],
                transaction,
            });
            if (!agreement) {
                await transaction.rollback();
                res.status(404).json({
                    success: false,
                    error: 'Delivery agreement not found',
                    code: 'AGREEMENT_NOT_FOUND',
                });
                return;
            }
            const isSender = agreement.package.senderId === userId;
            const isCourier = agreement.courierId === userId;
            if (!isSender && !isCourier) {
                await transaction.rollback();
                res.status(403).json({
                    success: false,
                    error: 'Not authorized to raise dispute for this delivery',
                    code: 'NOT_AUTHORIZED',
                });
                return;
            }
            if (![DeliveryAgreement_1.DeliveryStatus.IN_TRANSIT, DeliveryAgreement_1.DeliveryStatus.COMPLETED].includes(agreement.status)) {
                await transaction.rollback();
                res.status(400).json({
                    success: false,
                    error: 'Disputes can only be raised for in-transit or completed deliveries',
                    code: 'INVALID_STATUS',
                });
                return;
            }
            const existingDispute = await models_1.DeliveryDispute.findOne({
                where: {
                    deliveryAgreementId: agreementId,
                    status: {
                        [sequelize_1.Op.in]: [DeliveryDispute_1.DisputeStatus.OPEN, DeliveryDispute_1.DisputeStatus.UNDER_REVIEW],
                    },
                },
                transaction,
            });
            if (existingDispute) {
                await transaction.rollback();
                res.status(409).json({
                    success: false,
                    error: 'An active dispute already exists for this delivery',
                    code: 'DISPUTE_EXISTS',
                });
                return;
            }
            const dispute = await models_1.DeliveryDispute.create({
                deliveryAgreementId: agreementId,
                raisedByUserId: userId,
                disputeType,
                description,
                evidenceImages,
                status: DeliveryDispute_1.DisputeStatus.OPEN,
            }, { transaction });
            await CourierEscrowService_1.default.handleDispute(agreementId, {
                raisedByUserId: userId,
                disputeType,
                description,
                evidenceImages,
            }, transaction);
            await transaction.commit();
            res.status(201).json({
                success: true,
                data: dispute,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            console.error(`[${new Date().toISOString()}] Error in createDispute:`, {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                userId: req.user?.id,
                agreementId: req.params['agreementId'],
            });
            res.status(500).json({
                success: false,
                error: 'Failed to create dispute',
                code: 'INTERNAL_ERROR',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async getAllDisputes(req, res) {
        try {
            const userId = req.user?.id;
            const userRole = req.user?.role;
            if (!userId || userRole !== 'admin') {
                res.status(403).json({
                    success: false,
                    error: 'Admin access required',
                    code: 'ADMIN_REQUIRED',
                });
                return;
            }
            const { status, disputeType, limit = 20, offset = 0, sortBy = 'createdAt', sortOrder = 'DESC', } = req.query;
            const whereClause = {};
            if (status) {
                whereClause.status = status;
            }
            if (disputeType) {
                whereClause.disputeType = disputeType;
            }
            const disputes = await models_1.DeliveryDispute.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        model: models_1.DeliveryAgreement,
                        as: 'deliveryAgreement',
                        include: [
                            {
                                model: models_1.Package,
                                as: 'package',
                                include: [{
                                        model: models_1.User,
                                        as: 'sender',
                                        attributes: ['id', 'firstName', 'lastName', 'email'],
                                    }],
                            },
                            {
                                model: models_1.User,
                                as: 'courier',
                                attributes: ['id', 'firstName', 'lastName', 'email'],
                            },
                        ],
                    },
                    {
                        model: models_1.User,
                        as: 'raisedByUser',
                        attributes: ['id', 'firstName', 'lastName', 'email'],
                    },
                    {
                        model: models_1.User,
                        as: 'resolvedByAdmin',
                        attributes: ['id', 'firstName', 'lastName', 'email'],
                    },
                ],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [[sortBy, sortOrder]],
            });
            res.status(200).json({
                success: true,
                data: disputes.rows,
                pagination: {
                    total: disputes.count,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: disputes.count > parseInt(offset) + parseInt(limit),
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error in getAllDisputes:`, {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve disputes',
                code: 'INTERNAL_ERROR',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async getUserDisputes(req, res) {
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
            const disputes = await models_1.DeliveryDispute.findAll({
                where: {
                    raisedByUserId: userId,
                },
                include: [
                    {
                        model: models_1.DeliveryAgreement,
                        as: 'deliveryAgreement',
                        include: [
                            {
                                model: models_1.Package,
                                as: 'package',
                                attributes: ['id', 'title', 'pickupAddress', 'dropoffAddress'],
                            },
                            {
                                model: models_1.User,
                                as: 'courier',
                                attributes: ['id', 'firstName', 'lastName'],
                            },
                        ],
                    },
                ],
                order: [['createdAt', 'DESC']],
            });
            res.status(200).json({
                success: true,
                data: disputes,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error in getUserDisputes:`, {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve user disputes',
                code: 'INTERNAL_ERROR',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async getDisputeDetails(req, res) {
        try {
            const userId = req.user?.id;
            const userRole = req.user?.role;
            const { disputeId } = req.params;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                    code: 'UNAUTHORIZED',
                });
                return;
            }
            const dispute = await models_1.DeliveryDispute.findByPk(disputeId, {
                include: [
                    {
                        model: models_1.DeliveryAgreement,
                        as: 'deliveryAgreement',
                        include: [
                            {
                                model: models_1.Package,
                                as: 'package',
                                include: [{
                                        model: models_1.User,
                                        as: 'sender',
                                        attributes: ['id', 'firstName', 'lastName', 'email'],
                                    }],
                            },
                            {
                                model: models_1.User,
                                as: 'courier',
                                attributes: ['id', 'firstName', 'lastName', 'email'],
                            },
                        ],
                    },
                    {
                        model: models_1.User,
                        as: 'raisedByUser',
                        attributes: ['id', 'firstName', 'lastName', 'email'],
                    },
                    {
                        model: models_1.User,
                        as: 'resolvedByAdmin',
                        attributes: ['id', 'firstName', 'lastName', 'email'],
                    },
                ],
            });
            if (!dispute) {
                res.status(404).json({
                    success: false,
                    error: 'Dispute not found',
                    code: 'DISPUTE_NOT_FOUND',
                });
                return;
            }
            const isAdmin = userRole === 'admin';
            const isInvolved = dispute.raisedByUserId === userId ||
                dispute.deliveryAgreement.courierId === userId ||
                dispute.deliveryAgreement.package.senderId === userId;
            if (!isAdmin && !isInvolved) {
                res.status(403).json({
                    success: false,
                    error: 'Not authorized to view this dispute',
                    code: 'NOT_AUTHORIZED',
                });
                return;
            }
            res.status(200).json({
                success: true,
                data: dispute,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error in getDisputeDetails:`, {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                userId: req.user?.id,
                disputeId: req.params['disputeId'],
            });
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve dispute details',
                code: 'INTERNAL_ERROR',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async moveToReview(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const userId = req.user?.id;
            const userRole = req.user?.role;
            const { disputeId } = req.params;
            const { notes } = req.body;
            if (!userId || userRole !== 'admin') {
                res.status(403).json({
                    success: false,
                    error: 'Admin access required',
                    code: 'ADMIN_REQUIRED',
                });
                return;
            }
            const dispute = await models_1.DeliveryDispute.findByPk(disputeId, { transaction });
            if (!dispute) {
                await transaction.rollback();
                res.status(404).json({
                    success: false,
                    error: 'Dispute not found',
                    code: 'DISPUTE_NOT_FOUND',
                });
                return;
            }
            await dispute.moveToReview(userId, notes);
            await transaction.commit();
            res.status(200).json({
                success: true,
                data: dispute,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            console.error(`[${new Date().toISOString()}] Error in moveToReview:`, {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                userId: req.user?.id,
                disputeId: req.params['disputeId'],
            });
            res.status(500).json({
                success: false,
                error: 'Failed to move dispute to review',
                code: 'INTERNAL_ERROR',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async resolveDispute(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const userId = req.user?.id;
            const userRole = req.user?.role;
            const { disputeId } = req.params;
            const { resolution, courierAmount, senderRefund, notes } = req.body;
            if (!userId || userRole !== 'admin') {
                res.status(403).json({
                    success: false,
                    error: 'Admin access required',
                    code: 'ADMIN_REQUIRED',
                });
                return;
            }
            const dispute = await models_1.DeliveryDispute.findByPk(disputeId, {
                include: [{
                        model: models_1.DeliveryAgreement,
                        as: 'deliveryAgreement',
                    }],
                transaction,
            });
            if (!dispute) {
                await transaction.rollback();
                res.status(404).json({
                    success: false,
                    error: 'Dispute not found',
                    code: 'DISPUTE_NOT_FOUND',
                });
                return;
            }
            const resolvedAgreement = await CourierEscrowService_1.default.resolveDispute(dispute.deliveryAgreementId, {
                adminId: userId,
                resolution,
                courierAmount,
                senderRefund,
                notes,
            }, transaction);
            await dispute.resolve(userId, courierAmount || senderRefund, notes);
            await transaction.commit();
            res.status(200).json({
                success: true,
                data: {
                    dispute,
                    agreement: resolvedAgreement,
                    resolution: {
                        type: resolution,
                        courierAmount,
                        senderRefund,
                        notes,
                    },
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            console.error(`[${new Date().toISOString()}] Error in resolveDispute:`, {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                userId: req.user?.id,
                disputeId: req.params['disputeId'],
            });
            res.status(500).json({
                success: false,
                error: 'Failed to resolve dispute',
                code: 'INTERNAL_ERROR',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async getDisputeStats(req, res) {
        try {
            const userId = req.user?.id;
            const userRole = req.user?.role;
            if (!userId || userRole !== 'admin') {
                res.status(403).json({
                    success: false,
                    error: 'Admin access required',
                    code: 'ADMIN_REQUIRED',
                });
                return;
            }
            const statusStats = await models_1.DeliveryDispute.findAll({
                attributes: [
                    'status',
                    [database_1.sequelize.fn('COUNT', database_1.sequelize.col('id')), 'count'],
                ],
                group: ['status'],
                raw: true,
            });
            const typeStats = await models_1.DeliveryDispute.findAll({
                attributes: [
                    'disputeType',
                    [database_1.sequelize.fn('COUNT', database_1.sequelize.col('id')), 'count'],
                ],
                group: ['disputeType'],
                raw: true,
            });
            const resolvedDisputes = await models_1.DeliveryDispute.findAll({
                where: {
                    status: DeliveryDispute_1.DisputeStatus.RESOLVED,
                    resolvedAt: { [sequelize_1.Op.ne]: null },
                },
                attributes: ['createdAt', 'resolvedAt'],
            });
            let averageResolutionTime = 0;
            if (resolvedDisputes.length > 0) {
                const totalResolutionTime = resolvedDisputes.reduce((sum, dispute) => {
                    const resolutionTime = dispute.resolvedAt.getTime() - dispute.createdAt.getTime();
                    return sum + resolutionTime;
                }, 0);
                averageResolutionTime = totalResolutionTime / resolvedDisputes.length / (1000 * 60 * 60);
            }
            res.status(200).json({
                success: true,
                data: {
                    byStatus: statusStats,
                    byType: typeStats,
                    averageResolutionTimeHours: Math.round(averageResolutionTime * 100) / 100,
                    totalResolved: resolvedDisputes.length,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error in getDisputeStats:`, {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve dispute statistics',
                code: 'INTERNAL_ERROR',
                timestamp: new Date().toISOString(),
            });
        }
    }
}
exports.DisputeController = DisputeController;
exports.default = new DisputeController();
//# sourceMappingURL=DisputeController.js.map