"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QRCodeService = void 0;
const models_1 = require("../models");
const DeliveryQRCode_1 = require("../models/DeliveryQRCode");
const DeliveryAgreement_1 = require("../models/DeliveryAgreement");
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const crypto_1 = __importDefault(require("crypto"));
class QRCodeService {
    constructor() {
        this.QR_CODE_VALIDITY_HOURS = 24;
        this.SECRET_KEY = process.env['QR_CODE_SECRET'] || 'hitch-qr-secret-key';
    }
    async generateDeliveryQRCode(agreementId, courierId, transaction) {
        const t = transaction || await database_1.sequelize.transaction();
        const shouldCommit = !transaction;
        try {
            const agreement = await models_1.DeliveryAgreement.findOne({
                where: {
                    id: agreementId,
                    courierId,
                    status: DeliveryAgreement_1.DeliveryStatus.IN_TRANSIT,
                },
                transaction: t,
            });
            if (!agreement) {
                throw new Error('Delivery agreement not found or courier not authorized');
            }
            await models_1.DeliveryQRCode.update({ status: DeliveryQRCode_1.QRCodeStatus.EXPIRED }, {
                where: {
                    deliveryAgreementId: agreementId,
                    status: DeliveryQRCode_1.QRCodeStatus.ACTIVE,
                },
                transaction: t,
            });
            const token = this.generateSecureToken();
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + this.QR_CODE_VALIDITY_HOURS);
            const qrCode = await models_1.DeliveryQRCode.create({
                deliveryAgreementId: agreementId,
                qrToken: token,
                status: DeliveryQRCode_1.QRCodeStatus.ACTIVE,
                generatedAt: new Date(),
                expiresAt,
                verificationData: {
                    agreementId,
                    courierId,
                    generatedAt: new Date().toISOString(),
                },
            }, { transaction: t });
            agreement.qrCodeToken = token;
            agreement.qrCodeExpiresAt = expiresAt;
            await agreement.save({ transaction: t });
            await agreement.logEvent('qr_code_generated', {
                qr_token: token,
                expires_at: expiresAt.toISOString(),
                validity_hours: this.QR_CODE_VALIDITY_HOURS,
            }, courierId);
            if (shouldCommit) {
                await t.commit();
            }
            (0, logger_1.logInfo)('QR code generated for delivery', {
                agreementId,
                courierId,
                token,
                expiresAt,
            });
            return qrCode;
        }
        catch (error) {
            if (shouldCommit) {
                await t.rollback();
            }
            (0, logger_1.logError)('Failed to generate QR code', error, {
                agreementId,
                courierId,
            });
            throw error;
        }
    }
    async verifyAndScanQRCode(token, scannedByUserId, scanLocation, transaction) {
        const t = transaction || await database_1.sequelize.transaction();
        const shouldCommit = !transaction;
        try {
            const qrCode = await models_1.DeliveryQRCode.findOne({
                where: {
                    qrToken: token,
                },
                include: [{
                        model: models_1.DeliveryAgreement,
                        as: 'deliveryAgreement',
                        required: true,
                    }],
                transaction: t,
            });
            if (!qrCode) {
                return {
                    qrCode: null,
                    agreement: null,
                    isValid: false,
                    message: 'QR code not found',
                };
            }
            const agreement = qrCode.deliveryAgreement;
            if (!qrCode.isValid()) {
                return {
                    qrCode,
                    agreement,
                    isValid: false,
                    message: qrCode.isExpired() ? 'QR code has expired' : 'QR code is not active',
                };
            }
            if (agreement.status !== DeliveryAgreement_1.DeliveryStatus.IN_TRANSIT) {
                return {
                    qrCode,
                    agreement,
                    isValid: false,
                    message: 'Delivery is not in transit',
                };
            }
            if (!this.verifyTokenSignature(token, agreement.id, agreement.courierId)) {
                return {
                    qrCode,
                    agreement,
                    isValid: false,
                    message: 'Invalid QR code signature',
                };
            }
            const scanSuccess = await qrCode.scan(scannedByUserId, scanLocation, {
                scan_timestamp: new Date().toISOString(),
                delivery_confirmed: true,
            });
            if (!scanSuccess) {
                return {
                    qrCode,
                    agreement,
                    isValid: false,
                    message: 'Failed to scan QR code',
                };
            }
            await agreement.logEvent('qr_code_scanned', {
                qr_token: token,
                scanned_by: scannedByUserId,
                scan_location: scanLocation,
                scan_timestamp: new Date().toISOString(),
            }, scannedByUserId);
            if (shouldCommit) {
                await t.commit();
            }
            (0, logger_1.logInfo)('QR code scanned successfully', {
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
        }
        catch (error) {
            if (shouldCommit) {
                await t.rollback();
            }
            (0, logger_1.logError)('Failed to verify QR code', error, {
                token,
                scannedByUserId,
            });
            throw error;
        }
    }
    async getQRCodeData(agreementId, courierId) {
        try {
            const qrCode = await models_1.DeliveryQRCode.findOne({
                where: {
                    deliveryAgreementId: agreementId,
                    status: DeliveryQRCode_1.QRCodeStatus.ACTIVE,
                },
                include: [{
                        model: models_1.DeliveryAgreement,
                        as: 'deliveryAgreement',
                        where: {
                            courierId,
                            status: DeliveryAgreement_1.DeliveryStatus.IN_TRANSIT,
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
        }
        catch (error) {
            (0, logger_1.logError)('Failed to get QR code data', error, {
                agreementId,
                courierId,
            });
            return null;
        }
    }
    async refreshQRCode(agreementId, courierId, transaction) {
        try {
            const existingQR = await models_1.DeliveryQRCode.findOne({
                where: {
                    deliveryAgreementId: agreementId,
                    status: DeliveryQRCode_1.QRCodeStatus.ACTIVE,
                },
            });
            if (existingQR && existingQR.isValid()) {
                return existingQR;
            }
            return await this.generateDeliveryQRCode(agreementId, courierId, transaction);
        }
        catch (error) {
            (0, logger_1.logError)('Failed to refresh QR code', error, {
                agreementId,
                courierId,
            });
            throw error;
        }
    }
    async expireOldQRCodes() {
        try {
            const [affectedRows] = await models_1.DeliveryQRCode.update({ status: DeliveryQRCode_1.QRCodeStatus.EXPIRED }, {
                where: {
                    status: DeliveryQRCode_1.QRCodeStatus.ACTIVE,
                    expiresAt: {
                        [database_1.Op.lt]: new Date(),
                    },
                },
            });
            (0, logger_1.logInfo)('Expired old QR codes', { count: affectedRows });
            return affectedRows;
        }
        catch (error) {
            (0, logger_1.logError)('Failed to expire old QR codes', error);
            throw error;
        }
    }
    async getQRCodeStats() {
        try {
            const stats = await models_1.DeliveryQRCode.findAll({
                attributes: [
                    'status',
                    [database_1.sequelize.fn('COUNT', database_1.sequelize.col('id')), 'count'],
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
            stats.forEach((stat) => {
                const count = parseInt(stat.count);
                result.total += count;
                switch (stat.status) {
                    case DeliveryQRCode_1.QRCodeStatus.ACTIVE:
                        result.active = count;
                        break;
                    case DeliveryQRCode_1.QRCodeStatus.USED:
                        result.used = count;
                        break;
                    case DeliveryQRCode_1.QRCodeStatus.EXPIRED:
                        result.expired = count;
                        break;
                }
            });
            return result;
        }
        catch (error) {
            (0, logger_1.logError)('Failed to get QR code stats', error);
            throw error;
        }
    }
    generateSecureToken() {
        const randomBytes = crypto_1.default.randomBytes(16);
        const timestamp = Date.now().toString(36);
        const random = randomBytes.toString('hex');
        return `${timestamp}${random}`.toUpperCase();
    }
    generateTokenSignature(token, agreementId, courierId) {
        const data = `${token}:${agreementId}:${courierId}`;
        return crypto_1.default
            .createHmac('sha256', this.SECRET_KEY)
            .update(data)
            .digest('hex');
    }
    verifyTokenSignature(_token, _agreementId, _courierId) {
        return _token.length >= 24;
    }
}
exports.QRCodeService = QRCodeService;
exports.default = new QRCodeService();
//# sourceMappingURL=QRCodeService.js.map