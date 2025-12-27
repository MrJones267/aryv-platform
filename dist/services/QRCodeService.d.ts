import { Transaction } from 'sequelize';
import { DeliveryQRCode, DeliveryAgreement } from '../models';
export interface QRCodeData {
    token: string;
    agreementId: string;
    courierId: string;
    timestamp: number;
    signature: string;
}
export declare class QRCodeService {
    private readonly QR_CODE_VALIDITY_HOURS;
    private readonly SECRET_KEY;
    generateDeliveryQRCode(agreementId: string, courierId: string, transaction?: Transaction): Promise<DeliveryQRCode>;
    verifyAndScanQRCode(token: string, scannedByUserId: string, scanLocation?: [number, number], transaction?: Transaction): Promise<{
        qrCode: DeliveryQRCode;
        agreement: DeliveryAgreement;
        isValid: boolean;
        message: string;
    }>;
    getQRCodeData(agreementId: string, courierId: string): Promise<QRCodeData | null>;
    refreshQRCode(agreementId: string, courierId: string, transaction?: Transaction): Promise<DeliveryQRCode>;
    expireOldQRCodes(): Promise<number>;
    getQRCodeStats(): Promise<{
        total: number;
        active: number;
        used: number;
        expired: number;
    }>;
    private generateSecureToken;
    private generateTokenSignature;
    private verifyTokenSignature;
}
declare const _default: QRCodeService;
export default _default;
//# sourceMappingURL=QRCodeService.d.ts.map