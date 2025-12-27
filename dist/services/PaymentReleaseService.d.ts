import { Transaction } from 'sequelize';
export declare enum PaymentReleaseTrigger {
    QR_CODE_SCAN = "qr_code_scan",
    MANUAL_ADMIN = "manual_admin",
    AUTO_TIMEOUT = "auto_timeout",
    DISPUTE_RESOLUTION = "dispute_resolution"
}
export interface PaymentReleaseResult {
    success: boolean;
    agreementId: string;
    amount: number;
    platformFee: number;
    courierEarnings: number;
    trigger: PaymentReleaseTrigger;
    timestamp: Date;
    error?: string;
}
export declare class PaymentReleaseService {
    private readonly AUTO_RELEASE_DELAY_HOURS;
    processQRCodePaymentRelease(qrToken: string, scannedByUserId: string, scanLocation?: [number, number], transaction?: Transaction): Promise<PaymentReleaseResult>;
    processManualPaymentRelease(agreementId: string, adminId: string, reason: string, transaction?: Transaction): Promise<PaymentReleaseResult>;
    processAutoTimeoutRelease(agreementId: string, transaction?: Transaction): Promise<PaymentReleaseResult>;
    processEligibleAutoReleases(): Promise<PaymentReleaseResult[]>;
    getPaymentReleaseStats(): Promise<{
        totalReleased: number;
        totalAmount: number;
        totalCourierEarnings: number;
        totalPlatformFees: number;
        releasesByTrigger: Record<PaymentReleaseTrigger, number>;
        averageReleaseTime: number;
    }>;
    private logPaymentRelease;
    private sendPaymentReleaseNotifications;
}
declare const _default: PaymentReleaseService;
export default _default;
//# sourceMappingURL=PaymentReleaseService.d.ts.map