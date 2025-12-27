/**
 * @fileoverview DisputeController for managing delivery disputes
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import { Request, Response } from 'express';
import { Op } from 'sequelize';
import {
  DeliveryDispute,
  DeliveryAgreement,
  Package,
  User,
} from '../models';
import { DisputeStatus } from '../models/DeliveryDispute';
import { DeliveryStatus } from '../models/DeliveryAgreement';
import { sequelize } from '../config/database';
import courierEscrowService from '../services/CourierEscrowService';

export class DisputeController {
  /**
   * Create a new dispute
   */
  async createDispute(req: Request, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

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

      // Verify agreement exists and user is involved
      const agreement = await DeliveryAgreement.findByPk(agreementId, {
        include: [{
          model: Package,
          as: 'package',
          include: [{
            model: User,
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

      // Check if user is authorized to raise dispute (sender or courier)
      const isSender = agreement.package!.senderId === userId;
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

      // Check if agreement is in a state that allows disputes
      if (![DeliveryStatus.IN_TRANSIT, DeliveryStatus.COMPLETED].includes(agreement.status)) {
        await transaction.rollback();
        res.status(400).json({
          success: false,
          error: 'Disputes can only be raised for in-transit or completed deliveries',
          code: 'INVALID_STATUS',
        });
        return;
      }

      // Check if dispute already exists
      const existingDispute = await DeliveryDispute.findOne({
        where: {
          deliveryAgreementId: agreementId,
          status: {
            [Op.in]: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW],
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

      // Create the dispute
      const dispute = await DeliveryDispute.create({
        deliveryAgreementId: agreementId,
        raisedByUserId: userId,
        disputeType,
        description,
        evidenceImages,
        status: DisputeStatus.OPEN,
      }, { transaction });

      // Handle dispute through escrow service (freezes payment)
      await courierEscrowService.handleDispute(agreementId, {
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

    } catch (error) {
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

  /**
   * Get all disputes (admin only)
   */
  async getAllDisputes(req: Request, res: Response): Promise<void> {
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

      const {
        status,
        disputeType,
        limit = 20,
        offset = 0,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
      } = req.query;

      const whereClause: any = {};

      if (status) {
        whereClause.status = status;
      }

      if (disputeType) {
        whereClause.disputeType = disputeType;
      }

      const disputes = await DeliveryDispute.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: DeliveryAgreement,
            as: 'deliveryAgreement',
            include: [
              {
                model: Package,
                as: 'package',
                include: [{
                  model: User,
                  as: 'sender',
                  attributes: ['id', 'firstName', 'lastName', 'email'],
                }],
              },
              {
                model: User,
                as: 'courier',
                attributes: ['id', 'firstName', 'lastName', 'email'],
              },
            ],
          },
          {
            model: User,
            as: 'raisedByUser',
            attributes: ['id', 'firstName', 'lastName', 'email'],
          },
          {
            model: User,
            as: 'resolvedByAdmin',
            attributes: ['id', 'firstName', 'lastName', 'email'],
          },
        ],
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        order: [[sortBy as string, sortOrder as string]],
      });

      res.status(200).json({
        success: true,
        data: disputes.rows,
        pagination: {
          total: disputes.count,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: disputes.count > parseInt(offset as string) + parseInt(limit as string),
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
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

  /**
   * Get user's disputes
   */
  async getUserDisputes(req: Request, res: Response): Promise<void> {
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

      const disputes = await DeliveryDispute.findAll({
        where: {
          raisedByUserId: userId,
        },
        include: [
          {
            model: DeliveryAgreement,
            as: 'deliveryAgreement',
            include: [
              {
                model: Package,
                as: 'package',
                attributes: ['id', 'title', 'pickupAddress', 'dropoffAddress'],
              },
              {
                model: User,
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

    } catch (error) {
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

  /**
   * Get dispute details
   */
  async getDisputeDetails(req: Request, res: Response): Promise<void> {
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

      const dispute = await DeliveryDispute.findByPk(disputeId, {
        include: [
          {
            model: DeliveryAgreement,
            as: 'deliveryAgreement',
            include: [
              {
                model: Package,
                as: 'package',
                include: [{
                  model: User,
                  as: 'sender',
                  attributes: ['id', 'firstName', 'lastName', 'email'],
                }],
              },
              {
                model: User,
                as: 'courier',
                attributes: ['id', 'firstName', 'lastName', 'email'],
              },
            ],
          },
          {
            model: User,
            as: 'raisedByUser',
            attributes: ['id', 'firstName', 'lastName', 'email'],
          },
          {
            model: User,
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

      // Check authorization
      const isAdmin = userRole === 'admin';
      const isInvolved = dispute.raisedByUserId === userId ||
                        dispute.deliveryAgreement!.courierId === userId ||
                        dispute.deliveryAgreement!.package!.senderId === userId;

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

    } catch (error) {
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

  /**
   * Move dispute to review (admin only)
   */
  async moveToReview(req: Request, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

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

      const dispute = await DeliveryDispute.findByPk(disputeId, { transaction });

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

    } catch (error) {
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

  /**
   * Resolve dispute (admin only)
   */
  async resolveDispute(req: Request, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

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

      const dispute = await DeliveryDispute.findByPk(disputeId, {
        include: [{
          model: DeliveryAgreement,
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

      // Resolve dispute through escrow service
      const resolvedAgreement = await courierEscrowService.resolveDispute(
        dispute.deliveryAgreementId,
        {
          adminId: userId,
          resolution,
          courierAmount,
          senderRefund,
          notes,
        },
        transaction,
      );

      // Update dispute status
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

    } catch (error) {
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

  /**
   * Get dispute statistics (admin only)
   */
  async getDisputeStats(req: Request, res: Response): Promise<void> {
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

      // Get dispute counts by status
      const statusStats = await DeliveryDispute.findAll({
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        group: ['status'],
        raw: true,
      });

      // Get dispute counts by type
      const typeStats = await DeliveryDispute.findAll({
        attributes: [
          'disputeType',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        group: ['disputeType'],
        raw: true,
      });

      // Get resolution time stats
      const resolvedDisputes = await DeliveryDispute.findAll({
        where: {
          status: DisputeStatus.RESOLVED,
          resolvedAt: { [Op.ne]: null as any },
        },
        attributes: ['createdAt', 'resolvedAt'],
      });

      let averageResolutionTime = 0;
      if (resolvedDisputes.length > 0) {
        const totalResolutionTime = resolvedDisputes.reduce((sum, dispute) => {
          const resolutionTime = dispute.resolvedAt!.getTime() - dispute.createdAt.getTime();
          return sum + resolutionTime;
        }, 0);
        averageResolutionTime = totalResolutionTime / resolvedDisputes.length / (1000 * 60 * 60); // in hours
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

    } catch (error) {
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

export default new DisputeController();
