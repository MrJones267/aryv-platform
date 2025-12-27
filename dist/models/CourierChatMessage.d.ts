import { Model, Optional } from 'sequelize';
export declare enum MessageType {
    TEXT = "text",
    IMAGE = "image",
    LOCATION = "location",
    SYSTEM = "system"
}
export interface CourierChatMessageAttributes {
    id: string;
    deliveryAgreementId: string;
    senderId: string;
    recipientId: string;
    messageType: MessageType;
    content: string;
    attachmentUrl?: string;
    isRead: boolean;
    readAt?: Date;
    createdAt: Date;
}
export interface CourierChatMessageCreationAttributes extends Optional<CourierChatMessageAttributes, 'id' | 'attachmentUrl' | 'readAt' | 'createdAt'> {
}
export declare class CourierChatMessage extends Model<CourierChatMessageAttributes, CourierChatMessageCreationAttributes> implements CourierChatMessageAttributes {
    id: string;
    deliveryAgreementId: string;
    senderId: string;
    recipientId: string;
    messageType: MessageType;
    content: string;
    attachmentUrl?: string;
    isRead: boolean;
    readAt?: Date;
    createdAt: Date;
    readonly deliveryAgreement?: DeliveryAgreement;
    readonly sender?: import('./User').UserModel;
    readonly recipient?: import('./User').UserModel;
    markAsRead(): Promise<void>;
    isRecent(): boolean;
    hasAttachment(): boolean;
    getMessageAge(): number;
    toJSON(): object;
}
import { DeliveryAgreement } from './DeliveryAgreement';
export default CourierChatMessage;
//# sourceMappingURL=CourierChatMessage.d.ts.map