import { Model, CreationOptional, InferAttributes, InferCreationAttributes, ForeignKey } from 'sequelize';
export declare enum VerificationLevel {
    BASIC = "basic",
    VERIFIED = "verified",
    PREMIUM = "premium"
}
export interface UserWalletModel extends Model<InferAttributes<UserWalletModel>, InferCreationAttributes<UserWalletModel>> {
    id: CreationOptional<string>;
    userId: ForeignKey<string>;
    availableBalance: CreationOptional<number>;
    pendingBalance: CreationOptional<number>;
    escrowBalance: CreationOptional<number>;
    dailyCashLimit: CreationOptional<number>;
    weeklyCashLimit: CreationOptional<number>;
    monthlyCashLimit: CreationOptional<number>;
    dailyCashUsed: CreationOptional<number>;
    weeklyCashUsed: CreationOptional<number>;
    monthlyCashUsed: CreationOptional<number>;
    lastResetDate: CreationOptional<Date>;
    verificationLevel: CreationOptional<VerificationLevel>;
    phoneVerified: CreationOptional<boolean>;
    idVerified: CreationOptional<boolean>;
    addressVerified: CreationOptional<boolean>;
    trustScore: CreationOptional<number>;
    completedCashTransactions: CreationOptional<number>;
    disputedTransactions: CreationOptional<number>;
    successfulTransactions: CreationOptional<number>;
    totalTransactionValue: CreationOptional<number>;
    averageTransactionValue: CreationOptional<number>;
    lastTrustScoreUpdate: CreationOptional<Date>;
    isSuspended: CreationOptional<boolean>;
    suspensionReason: CreationOptional<string | null>;
    suspendedUntil: CreationOptional<Date | null>;
    createdAt: CreationOptional<Date>;
    updatedAt: CreationOptional<Date>;
}
declare const UserWallet: import("sequelize").ModelCtor<UserWalletModel>;
export { UserWallet };
export default UserWallet;
//# sourceMappingURL=UserWallet.d.ts.map