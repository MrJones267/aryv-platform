import Call, { CallType, CallPurpose } from '../models/Call';
export interface CallInitiationRequest {
    callerId: string;
    calleeId: string;
    callType: CallType;
    callPurpose: CallPurpose;
    rideId?: string;
    deliveryId?: string;
    isEmergency?: boolean;
    metadata?: any;
}
export interface CallResult {
    success: boolean;
    call?: Call;
    error?: string;
    sessionId?: string;
}
export interface CallSignalData {
    type: 'offer' | 'answer' | 'ice-candidate' | 'call-ended';
    sessionId: string;
    data: any;
    from: string;
    to: string;
}
export interface CallSession {
    id: string;
    callId: string;
    participants: string[];
    createdAt: Date;
    isActive: boolean;
}
export declare class CallService {
    private notificationService;
    private activeSessions;
    constructor();
    initiateCall(request: CallInitiationRequest): Promise<CallResult>;
    acceptCall(callId: string, userId: string): Promise<CallResult>;
    rejectCall(callId: string, userId: string, reason?: string): Promise<CallResult>;
    endCall(callId: string, userId: string, reason?: string): Promise<CallResult>;
    handleSignaling(signalData: CallSignalData): Promise<boolean>;
    getCallHistory(userId: string, limit?: number, offset?: number): Promise<Call[]>;
    getActiveCallForUser(userId: string): Promise<Call | null>;
    updateCallQuality(callId: string, userId: string, quality: number): Promise<boolean>;
    initiateEmergencyCall(userId: string, location?: any): Promise<CallResult>;
    private shouldEnableRecording;
    private sendCallNotifications;
    private notifyCallStatusChange;
    private cleanupCallSession;
    private logCallEvent;
    private getEmergencyContact;
    private notifyEmergencyContacts;
    getCallStatistics(userId?: string): Promise<any>;
}
export default CallService;
//# sourceMappingURL=CallService.d.ts.map