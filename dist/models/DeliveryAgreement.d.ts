import { Model, Optional } from 'sequelize';
export declare enum DeliveryStatus {
    PENDING_PICKUP = "pending_pickup",
    IN_TRANSIT = "in_transit",
    COMPLETED = "completed",
    DISPUTED = "disputed",
    CANCELLED = "cancelled"
}
export interface DeliveryEvent {
    timestamp: string;
    event_type: string;
    user_id?: string;
    data: Record<string, any>;
}
export interface DeliveryAgreementAttributes {
    id: string;
    packageId: string;
    courierId: string;
    agreedPrice: number;
    platformFee: number;
    status: DeliveryStatus;
    escrowPaymentId?: string;
    escrowAmount: number;
    escrowHeldAt?: Date;
    pickupConfirmedAt?: Date;
    pickupLocation?: [number, number];
    deliveryConfirmedAt?: Date;
    deliveryLocation?: [number, number];
    paymentReleasedAt?: Date;
    qrCodeToken?: string;
    qrCodeExpiresAt?: Date;
    eventLog: DeliveryEvent[];
    chatChannelId?: string;
    courierLocations?: Array<{
        lat: number;
        lng: number;
        timestamp: string;
    }>;
    createdAt: Date;
    updatedAt: Date;
}
export interface DeliveryAgreementCreationAttributes extends Optional<DeliveryAgreementAttributes, 'id' | 'escrowPaymentId' | 'escrowHeldAt' | 'pickupConfirmedAt' | 'pickupLocation' | 'deliveryConfirmedAt' | 'deliveryLocation' | 'paymentReleasedAt' | 'qrCodeToken' | 'qrCodeExpiresAt' | 'chatChannelId' | 'createdAt' | 'updatedAt'> {
}
export declare class DeliveryAgreement extends Model<DeliveryAgreementAttributes, DeliveryAgreementCreationAttributes> implements DeliveryAgreementAttributes {
    id: string;
    packageId: string;
    courierId: string;
    agreedPrice: number;
    platformFee: number;
    status: DeliveryStatus;
    escrowPaymentId?: string;
    escrowAmount: number;
    escrowHeldAt?: Date;
    pickupConfirmedAt?: Date;
    pickupLocation?: [number, number];
    deliveryConfirmedAt?: Date;
    deliveryLocation?: [number, number];
    paymentReleasedAt?: Date;
    qrCodeToken?: string;
    qrCodeExpiresAt?: Date;
    eventLog: DeliveryEvent[];
    chatChannelId?: string;
    createdAt: Date;
    updatedAt: Date;
    readonly package?: Package;
    readonly courier?: import('./User').UserModel;
    readonly qrCodes?: DeliveryQRCode[];
    readonly disputes?: DeliveryDispute[];
    readonly locationHistory?: CourierLocation[];
    readonly chatMessages?: CourierChatMessage[];
    canTransitionTo(newStatus: DeliveryStatus): boolean;
    transitionTo(newStatus: DeliveryStatus, userId?: string, eventData?: Record<string, any>): Promise<void>;
    logEvent(eventType: string, eventData?: Record<string, any>, userId?: string): Promise<void>;
    generateQRToken(): string;
    createQRCode(): Promise<void>;
    isQRCodeValid(): boolean;
    getEventsByType(eventType: string): DeliveryEvent[];
    getLastEvent(): DeliveryEvent | null;
    toJSON(): object;
}
import { Package } from './Package';
import { DeliveryQRCode } from './DeliveryQRCode';
import { DeliveryDispute } from './DeliveryDispute';
import { CourierLocation } from './CourierLocation';
import { CourierChatMessage } from './CourierChatMessage';
export default DeliveryAgreement;
//# sourceMappingURL=DeliveryAgreement.d.ts.map