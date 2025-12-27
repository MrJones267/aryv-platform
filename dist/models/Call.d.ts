import { Model, Optional } from 'sequelize';
import User from './User';
export declare enum CallType {
    VOICE = "voice",
    VIDEO = "video",
    EMERGENCY = "emergency"
}
export declare enum CallStatus {
    INITIATED = "initiated",
    RINGING = "ringing",
    ACCEPTED = "accepted",
    REJECTED = "rejected",
    ENDED = "ended",
    FAILED = "failed",
    MISSED = "missed"
}
export declare enum CallPurpose {
    RIDE_COMMUNICATION = "ride_communication",
    COURIER_DELIVERY = "courier_delivery",
    EMERGENCY_CALL = "emergency_call",
    CUSTOMER_SUPPORT = "customer_support"
}
export interface CallAttributes {
    id: string;
    callerId: string;
    calleeId: string;
    callType: CallType;
    callPurpose: CallPurpose;
    status: CallStatus;
    rideId?: string;
    deliveryId?: string;
    isEmergency: boolean;
    startedAt?: Date;
    endedAt?: Date;
    duration?: number;
    recordingUrl?: string;
    recordingEnabled: boolean;
    quality: number;
    metadata: {
        userAgent?: string;
        deviceInfo?: any;
        networkType?: string;
        resolution?: string;
        bandwidth?: number;
        rejectionReason?: string;
        endReason?: string;
    };
    createdAt: Date;
    updatedAt: Date;
}
export interface CallCreationAttributes extends Optional<CallAttributes, 'id' | 'startedAt' | 'endedAt' | 'duration' | 'recordingUrl' | 'quality' | 'createdAt' | 'updatedAt'> {
}
export declare class Call extends Model<CallAttributes, CallCreationAttributes> implements CallAttributes {
    id: string;
    callerId: string;
    calleeId: string;
    callType: CallType;
    callPurpose: CallPurpose;
    status: CallStatus;
    rideId?: string;
    deliveryId?: string;
    isEmergency: boolean;
    startedAt?: Date;
    endedAt?: Date;
    duration?: number;
    recordingUrl?: string;
    recordingEnabled: boolean;
    quality: number;
    metadata: any;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    Caller?: typeof User;
    Callee?: typeof User;
    getDurationFormatted(): string;
    isActiveCall(): boolean;
    canRecord(): boolean;
}
export default Call;
//# sourceMappingURL=Call.d.ts.map