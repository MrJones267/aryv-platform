import { Transaction } from 'sequelize';
import { DeliveryAgreement } from '../models';
export declare class CourierEscrowService {
    private paymentProvider;
    constructor();
    createDeliveryAgreement(packageId: string, courierId: string, transaction?: Transaction): Promise<DeliveryAgreement>;
    completeDelivery(agreementId: string, verificationData: Record<string, any>, transaction?: Transaction): Promise<DeliveryAgreement>;
    cancelDelivery(agreementId: string, reason: string, cancelledByUserId: string, transaction?: Transaction): Promise<DeliveryAgreement>;
    handleDispute(agreementId: string, disputeData: {
        raisedByUserId: string;
        disputeType: string;
        description: string;
        evidenceImages?: string[];
    }, transaction?: Transaction): Promise<DeliveryAgreement>;
    resolveDispute(agreementId: string, resolution: {
        adminId: string;
        resolution: 'release_to_courier' | 'refund_to_sender' | 'partial_split';
        courierAmount?: number;
        senderRefund?: number;
        notes?: string;
    }, transaction?: Transaction): Promise<DeliveryAgreement>;
    getEscrowStatus(agreementId: string): Promise<{
        agreement: DeliveryAgreement;
        paymentStatus: string;
        canRelease: boolean;
        canRefund: boolean;
    }>;
    private calculatePlatformFee;
}
declare const _default: CourierEscrowService;
export default _default;
//# sourceMappingURL=CourierEscrowService.d.ts.map