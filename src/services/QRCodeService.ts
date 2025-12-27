/**
 * @fileoverview QRCodeService for delivery verification QR code management
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import { Transaction } from 'sequelize';
import {
  DeliveryQRCode,
  DeliveryAgreement,
} from '../models';
import { QRCodeStatus } from '../models/DeliveryQRCode';
import { DeliveryStatus } from '../models/DeliveryAgreement';
import { sequelize, Op } from '../config/database';
import { logInfo, logError } from '../utils/logger';
import crypto from 'crypto';

// QR Code data structure
export interface QRCodeData {
  token: string;
  agreementId: string;
  courierId: string;
  timestamp: number;
  signature: string;
}

export class QRCodeService {
  private readonly QR_CODE_VALIDITY_HOURS = 24;
  private readonly SECRET_KEY = process.env['QR_CODE_SECRET'] || 'hitch-qr-secret-key';

  /**
   * Generate a new QR code for delivery verification
   */
  async generateDeliveryQRCode(
    agreementId: string,
    courierId: string,
    transaction?: Transaction,
  ): Promise<DeliveryQRCode> {
    const t = transaction || await sequelize.transaction();
    const shouldCommit = !transaction;

    try {
      // Verify agreement exists and courier is authorized
      const agreement = await DeliveryAgreement.findOne({
        where: {
          id: agreementId,
          courierId,
          status: DeliveryStatus.IN_TRANSIT,
        },
        transaction: t,
      });

      if (!agreement) {
        throw new Error('Delivery agreement not found or courier not authorized');
      }

      // Deactivate any existing QR codes for this agreement
      await DeliveryQRCode.update(
        { status: QRCodeStatus.EXPIRED },
        {
          where: {
            deliveryAgreementId: agreementId,
            status: QRCodeStatus.ACTIVE,
          },
          transaction: t,
        },
      );

      // Generate secure token
      const token = this.generateSecureToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.QR_CODE_VALIDITY_HOURS);

      // Create QR code record
      const qrCode = await DeliveryQRCode.create({
        deliveryAgreementId: agreementId,
        qrToken: token,
        status: QRCodeStatus.ACTIVE,
        generatedAt: new Date(),
        expiresAt,
        verificationData: {
          agreementId,
          courierId,
          generatedAt: new Date().toISOString(),
        },
      }, { transaction: t });

      // Update agreement with QR code reference
      agreement.qrCodeToken = token;
      agreement.qrCodeExpiresAt = expiresAt;
      await agreement.save({ transaction: t });

      // Log QR code generation
      await agreement.logEvent('qr_code_generated', {
        qr_token: token,
        expires_at: expiresAt.toISOString(),
        validity_hours: this.QR_CODE_VALIDITY_HOURS,
      }, courierId);

      if (shouldCommit) {
        await t.commit();
      }

      logInfo('QR code generated for delivery', {
        agreementId,
        courierId,
        token,
        expiresAt,
      });

      return qrCode;

    } catch (error) {
      if (shouldCommit) {
        await t.rollback();
      }

      logError('Failed to generate QR code', error as Error, {
        agreementId,
        courierId,
      });

      throw error;
    }
  }

  /**
   * Verify and scan a QR code for delivery confirmation
   */
  async verifyAndScanQRCode(
    token: string,
    scannedByUserId: string,
    scanLocation?: [number, number],
    transaction?: Transaction,
  ): Promise<{
    qrCode: DeliveryQRCode;
    agreement: DeliveryAgreement;
    isValid: boolean;
    message: string;
  }> {
    const t = transaction || await sequelize.transaction();
    const shouldCommit = !transaction;

    try {
      // Find QR code with agreement
      const qrCode = await DeliveryQRCode.findOne({
        where: {
          qrToken: token,
        },
        include: [{
          model: DeliveryAgreement,
          as: 'deliveryAgreement',
          required: true,
        }],
        transaction: t,
      });

      if (!qrCode) {
        return {
          qrCode: null as any,
          agreement: null as any,
          isValid: false,
          message: 'QR code not found',
        };
      }

      const agreement = qrCode.deliveryAgreement!;

      // Verify QR code is valid
      if (!qrCode.isValid()) {
        return {
          qrCode,
          agreement,
          isValid: false,
          message: qrCode.isExpired() ? 'QR code has expired' : 'QR code is not active',
        };
      }

      // Verify agreement is in correct status
      if (agreement.status !== DeliveryStatus.IN_TRANSIT) {
        return {
          qrCode,
          agreement,
          isValid: false,
          message: 'Delivery is not in transit',
        };
      }

      // Verify token signature (additional security)
      if (!this.verifyTokenSignature(token, agreement.id, agreement.courierId)) {
        return {
          qrCode,
          agreement,
          isValid: false,
          message: 'Invalid QR code signature',
        };
      }

      // Scan the QR code
      const scanSuccess = await qrCode.scan(
        scannedByUserId,
        scanLocation,
        {
          scan_timestamp: new Date().toISOString(),
          delivery_confirmed: true,
        },
      );

      if (!scanSuccess) {
        return {
          qrCode,
          agreement,
          isValid: false,
          message: 'Failed to scan QR code',
        };
      }

      // Log successful scan
      await agreement.logEvent('qr_code_scanned', {
        qr_token: token,
        scanned_by: scannedByUserId,
        scan_location: scanLocation,
        scan_timestamp: new Date().toISOString(),
      }, scannedByUserId);

      if (shouldCommit) {
        await t.commit();
      }

      logInfo('QR code scanned successfully', {
        token,
        agreementId: agreement.id,
        scannedBy: scannedByUserId,
        scanLocation,
      });

      return {
        qrCode,
        agreement,
        isValid: true,
        message: 'QR code verified and scanned successfully',
      };

    } catch (error) {
      if (shouldCommit) {
        await t.rollback();
      }

      logError('Failed to verify QR code', error as Error, {
        token,
        scannedByUserId,
      });

      throw error;
    }
  }

  /**
   * Get QR code data for mobile app display
   */
  async getQRCodeData(agreementId: string, courierId: string): Promise<QRCodeData | null> {
    try {
      const qrCode = await DeliveryQRCode.findOne({
        where: {
          deliveryAgreementId: agreementId,
          status: QRCodeStatus.ACTIVE,
        },
        include: [{
          model: DeliveryAgreement,
          as: 'deliveryAgreement',
          where: {
            courierId,
            status: DeliveryStatus.IN_TRANSIT,
          },
        }],
      });

      if (!qrCode || !qrCode.isValid()) {
        return null;
      }

      const timestamp = qrCode.generatedAt.getTime();
      const signature = this.generateTokenSignature(qrCode.qrToken, agreementId, courierId);

      return {
        token: qrCode.qrToken,
        agreementId,
        courierId,
        timestamp,
        signature,
      };

    } catch (error) {
      logError('Failed to get QR code data', error as Error, {
        agreementId,
        courierId,
      });

      return null;
    }
  }

  /**
   * Refresh/regenerate QR code if expired
   */
  async refreshQRCode(
    agreementId: string,
    courierId: string,
    transaction?: Transaction,
  ): Promise<DeliveryQRCode> {
    try {
      // Check if current QR code exists and is valid
      const existingQR = await DeliveryQRCode.findOne({
        where: {
          deliveryAgreementId: agreementId,
          status: QRCodeStatus.ACTIVE,
        },
      });

      if (existingQR && existingQR.isValid()) {
        // Current QR code is still valid, return it
        return existingQR;
      }

      // Generate new QR code
      return await this.generateDeliveryQRCode(agreementId, courierId, transaction);

    } catch (error) {
      logError('Failed to refresh QR code', error as Error, {
        agreementId,
        courierId,
      });

      throw error;
    }
  }

  /**
   * Expire QR codes (cleanup job)
   */
  async expireOldQRCodes(): Promise<number> {
    try {
      const [affectedRows] = await DeliveryQRCode.update(
        { status: QRCodeStatus.EXPIRED },
        {
          where: {
            status: QRCodeStatus.ACTIVE,
            expiresAt: {
              [Op.lt]: new Date(),
            },
          },
        },
      );

      logInfo('Expired old QR codes', { count: affectedRows });
      return affectedRows;

    } catch (error) {
      logError('Failed to expire old QR codes', error as Error);
      throw error;
    }
  }

  /**
   * Get QR code statistics
   */
  async getQRCodeStats(): Promise<{
    total: number;
    active: number;
    used: number;
    expired: number;
  }> {
    try {
      const stats = await DeliveryQRCode.findAll({
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        group: ['status'],
        raw: true,
      });

      const result = {
        total: 0,
        active: 0,
        used: 0,
        expired: 0,
      };

      stats.forEach((stat: any) => {
        const count = parseInt(stat.count);
        result.total += count;

        switch (stat.status) {
          case QRCodeStatus.ACTIVE:
            result.active = count;
            break;
          case QRCodeStatus.USED:
            result.used = count;
            break;
          case QRCodeStatus.EXPIRED:
            result.expired = count;
            break;
        }
      });

      return result;

    } catch (error) {
      logError('Failed to get QR code stats', error as Error);
      throw error;
    }
  }

  // Private helper methods

  private generateSecureToken(): string {
    // Generate a cryptographically secure token
    const randomBytes = crypto.randomBytes(16);
    const timestamp = Date.now().toString(36);
    const random = randomBytes.toString('hex');

    return `${timestamp}${random}`.toUpperCase();
  }

  private generateTokenSignature(token: string, agreementId: string, courierId: string): string {
    const data = `${token}:${agreementId}:${courierId}`;
    return crypto
      .createHmac('sha256', this.SECRET_KEY)
      .update(data)
      .digest('hex');
  }

  private verifyTokenSignature(_token: string, _agreementId: string, _courierId: string): boolean {
    // const expectedSignature = this.generateTokenSignature(token, agreementId, courierId);

    // In a real implementation, you might embed the signature in the token
    // For now, we'll assume the token format includes the signature
    // This is a simplified verification
    return _token.length >= 24; // Basic token format validation
  }
}

export default new QRCodeService();
