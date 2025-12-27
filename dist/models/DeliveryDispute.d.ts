import { Model, Optional } from 'sequelize';
export declare enum DisputeStatus {
    OPEN = "open",
    UNDER_REVIEW = "under_review",
    RESOLVED = "resolved",
    CLOSED = "closed"
}
export declare enum DisputeType {
    PACKAGE_NOT_DELIVERED = "package_not_delivered",
    PACKAGE_DAMAGED = "package_damaged",
    INCORRECT_LOCATION = "incorrect_location",
    WRONG_RECIPIENT = "wrong_recipient",
    LATE_DELIVERY = "late_delivery",
    COURIER_NO_SHOW = "courier_no_show",
    OTHER = "other"
}
export interface DeliveryDisputeAttributes {
    id: string;
    deliveryAgreementId: string;
    raisedByUserId: string;
    disputeType: string;
    description: string;
    evidenceImages?: string[];
    status: DisputeStatus;
    adminNotes?: string;
    resolutionAmount?: number;
    resolvedByAdminId?: string;
    resolvedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface DeliveryDisputeCreationAttributes extends Optional<DeliveryDisputeAttributes, 'id' | 'evidenceImages' | 'adminNotes' | 'resolutionAmount' | 'resolvedByAdminId' | 'resolvedAt' | 'createdAt' | 'updatedAt'> {
}
export declare class DeliveryDispute extends Model<DeliveryDisputeAttributes, DeliveryDisputeCreationAttributes> implements DeliveryDisputeAttributes {
    id: string;
    deliveryAgreementId: string;
    raisedByUserId: string;
    disputeType: string;
    description: string;
    evidenceImages?: string[];
    status: DisputeStatus;
    adminNotes?: string;
    resolutionAmount?: number;
    resolvedByAdminId?: string;
    resolvedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    readonly deliveryAgreement?: DeliveryAgreement;
    readonly raisedByUser?: import('./User').UserModel;
    readonly resolvedByAdmin?: import('./User').UserModel;
    isOpen(): boolean;
    isResolved(): boolean;
    canBeResolved(): boolean;
    moveToReview(_adminId: string, notes?: string): Promise<void>;
    resolve(adminId: string, resolutionAmount?: number, notes?: string): Promise<void>;
    close(adminId: string, notes?: string): Promise<void>;
    getDurationInHours(): number;
    addEvidenceImage(imageUrl: string): void;
    toJSON(): object;
}
import { DeliveryAgreement } from './DeliveryAgreement';
export default DeliveryDispute;
//# sourceMappingURL=DeliveryDispute.d.ts.map