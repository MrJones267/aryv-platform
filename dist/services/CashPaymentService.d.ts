export interface CashPaymentResult {
    success: boolean;
    transactionId?: string;
    riderCode?: string;
    driverCode?: string | null;
    instructions?: string;
    error?: string | undefined;
    trustScore?: number | undefined;
}
export interface ConfirmationResult {
    success: boolean;
    status: string;
    message: string;
    error?: string;
    nextStep?: string;
}
export interface FraudAnalysis {
    riskScore: number;
    patterns: string[];
    recommendation: 'approve' | 'review' | 'reject';
    trustRequired: number;
}
export interface LocationData {
    lat: number;
    lng: number;
    accuracy?: number;
    timestamp?: Date;
}
export declare class CashPaymentService {
    private notificationService;
    constructor();
    createCashPayment(bookingId: string, riderId: string, driverId: string, amount: number): Promise<CashPaymentResult>;
    confirmCashReceived(transactionId: string, driverId: string, actualAmount: number, location?: LocationData): Promise<ConfirmationResult>;
    confirmCashPaid(transactionId: string, riderId: string, confirmationCode: string): Promise<ConfirmationResult>;
    private checkCashPaymentEligibility;
    private calculateRequiredTrust;
    private checkTransactionLimits;
    private generateConfirmationCode;
    private calculatePlatformFee;
    private createTrustHold;
    private completeCashTransaction;
    private calculateNewTrustScore;
    private getVerificationBonus;
    private getCashPaymentInstructions;
    private sendCashPaymentNotifications;
    private notifyRiderForConfirmation;
    private logSuspiciousActivity;
    private verifyTransactionLocation;
    private resetLimitCountersIfNeeded;
}
export default CashPaymentService;
//# sourceMappingURL=CashPaymentService.d.ts.map