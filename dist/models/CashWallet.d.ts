import { Model, CreationOptional, InferAttributes, InferCreationAttributes, ForeignKey, NonAttribute } from 'sequelize';
import type { UserModel } from './User';
export interface CashWalletModel extends Model<InferAttributes<CashWalletModel>, InferCreationAttributes<CashWalletModel>> {
    id: CreationOptional<string>;
    userId: ForeignKey<string>;
    balance: number;
    currency: string;
    status: 'active' | 'suspended' | 'closed';
    dailyLoadLimit: number;
    monthlyLoadLimit: number;
    dailySpendLimit: number;
    monthlySpendLimit: number;
    kycLevel: 'basic' | 'enhanced' | 'full';
    isVerified: boolean;
    lastTransactionAt: CreationOptional<Date | null>;
    frozenBalance: CreationOptional<number>;
    escrowBalance: CreationOptional<number>;
    createdAt: CreationOptional<Date>;
    updatedAt: CreationOptional<Date>;
    user?: NonAttribute<UserModel>;
    transactions?: NonAttribute<CashWalletTransactionModel[]>;
    availableBalance: NonAttribute<number>;
    totalBalance: NonAttribute<number>;
}
export interface CashWalletTransactionModel extends Model<InferAttributes<CashWalletTransactionModel>, InferCreationAttributes<CashWalletTransactionModel>> {
    id: CreationOptional<string>;
    walletId: ForeignKey<string>;
    type: 'load' | 'payment' | 'refund' | 'transfer' | 'escrow_hold' | 'escrow_release' | 'fee' | 'bonus';
    amount: number;
    currency: string;
    balanceBefore: number;
    balanceAfter: number;
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
    source: 'agent' | 'kiosk' | 'partner_store' | 'mobile_money' | 'voucher' | 'bank_transfer' | 'ride_payment' | 'refund';
    sourceReference: CreationOptional<string | null>;
    description: string;
    metadata: CreationOptional<Record<string, any>>;
    processedAt: CreationOptional<Date | null>;
    expiresAt: CreationOptional<Date | null>;
    createdAt: CreationOptional<Date>;
    updatedAt: CreationOptional<Date>;
    wallet?: NonAttribute<CashWalletModel>;
}
declare const CashWallet: import("sequelize").ModelCtor<CashWalletModel>;
declare const CashWalletTransaction: import("sequelize").ModelCtor<CashWalletTransactionModel>;
export { CashWallet, CashWalletTransaction };
export default CashWallet;
//# sourceMappingURL=CashWallet.d.ts.map