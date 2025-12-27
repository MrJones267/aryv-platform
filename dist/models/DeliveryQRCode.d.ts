import { Model, Optional } from 'sequelize';
export declare enum QRCodeStatus {
    ACTIVE = "active",
    USED = "used",
    EXPIRED = "expired"
}
export interface DeliveryQRCodeAttributes {
    id: string;
    deliveryAgreementId: string;
    qrToken: string;
    status: QRCodeStatus;
    generatedAt: Date;
    expiresAt: Date;
    scannedAt?: Date;
    scannedByUserId?: string;
    scanLocation?: [number, number];
    verificationData?: Record<string, any>;
}
export interface DeliveryQRCodeCreationAttributes extends Optional<DeliveryQRCodeAttributes, 'id' | 'scannedAt' | 'scannedByUserId' | 'scanLocation' | 'verificationData'> {
}
export declare class DeliveryQRCode extends Model<DeliveryQRCodeAttributes, DeliveryQRCodeCreationAttributes> implements DeliveryQRCodeAttributes {
    id: string;
    deliveryAgreementId: string;
    qrToken: string;
    status: QRCodeStatus;
    generatedAt: Date;
    expiresAt: Date;
    scannedAt?: Date;
    scannedByUserId?: string;
    scanLocation?: [number, number];
    verificationData?: Record<string, any>;
    readonly deliveryAgreement?: DeliveryAgreement;
    readonly scannedByUser?: import('./User').UserModel;
    isValid(): boolean;
    isExpired(): boolean;
    scan(userId: string, location?: [number, number], additionalData?: Record<string, any>): Promise<boolean>;
    expire(): Promise<void>;
    getTimeUntilExpiry(): number;
    toJSON(): object;
}
import { DeliveryAgreement } from './DeliveryAgreement';
export default DeliveryQRCode;
//# sourceMappingURL=DeliveryQRCode.d.ts.map