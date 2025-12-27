import { Model, CreationOptional, InferAttributes, InferCreationAttributes, ForeignKey } from 'sequelize';
export declare enum CashPaymentStatus {
    PENDING_VERIFICATION = "pending_verification",
    DRIVER_CONFIRMED = "driver_confirmed",
    RIDER_CONFIRMED = "rider_confirmed",
    BOTH_CONFIRMED = "both_confirmed",
    DISPUTED = "disputed",
    COMPLETED = "completed",
    FAILED = "failed",
    EXPIRED = "expired"
}
export interface CashTransactionModel extends Model<InferAttributes<CashTransactionModel>, InferCreationAttributes<CashTransactionModel>> {
    id: CreationOptional<string>;
    bookingId: ForeignKey<string>;
    riderId: ForeignKey<string>;
    driverId: ForeignKey<string>;
    amount: number;
    platformFee: number;
    expectedAmount: number;
    actualAmountClaimed: CreationOptional<number | null>;
    status: CreationOptional<CashPaymentStatus>;
    riderConfirmedAt: CreationOptional<Date | null>;
    driverConfirmedAt: CreationOptional<Date | null>;
    riderConfirmationCode: string;
    driverConfirmationCode: string;
    verificationPhoto: CreationOptional<string | null>;
    gpsLocationConfirmed: CreationOptional<boolean>;
    transactionLocation: CreationOptional<object | null>;
    disputeReason: CreationOptional<string | null>;
    disputeResolvedAt: CreationOptional<Date | null>;
    disputeResolution: CreationOptional<'rider_favor' | 'driver_favor' | 'split' | null>;
    riskScore: CreationOptional<number>;
    fraudFlags: CreationOptional<string[] | null>;
    metadata: CreationOptional<object | null>;
    expiresAt: Date;
    createdAt: CreationOptional<Date>;
    updatedAt: CreationOptional<Date>;
}
declare const CashTransaction: import("sequelize").ModelCtor<CashTransactionModel>;
export { CashTransaction };
export default CashTransaction;
//# sourceMappingURL=CashTransaction.d.ts.map