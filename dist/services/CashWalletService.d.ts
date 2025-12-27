export interface WalletLoadRequest {
    userId: string;
    amount: number;
    source: 'agent' | 'kiosk' | 'partner_store' | 'mobile_money' | 'voucher' | 'bank_transfer';
    sourceReference: string;
    agentId?: string;
    location?: {
        latitude: number;
        longitude: number;
    };
    metadata?: Record<string, any>;
}
export interface WalletPaymentRequest {
    userId: string;
    amount: number;
    description: string;
    bookingId?: string;
    escrowHold?: boolean;
    metadata?: Record<string, any>;
}
export interface WalletTransferRequest {
    fromUserId: string;
    toUserId: string;
    amount: number;
    description: string;
    metadata?: Record<string, any>;
}
export interface WalletResult {
    success: boolean;
    data?: any;
    error?: string;
    code?: string;
}
export declare class CashWalletService {
    createWallet(userId: string, kycLevel?: 'basic' | 'enhanced' | 'full'): Promise<WalletResult>;
    loadWallet(request: WalletLoadRequest): Promise<WalletResult>;
    processPayment(request: WalletPaymentRequest): Promise<WalletResult>;
    releaseEscrow(walletId: string, amount: number, description: string): Promise<WalletResult>;
    transferMoney(request: WalletTransferRequest): Promise<WalletResult>;
    getWalletBalance(userId: string): Promise<WalletResult>;
    getTransactionHistory(userId: string, limit?: number, offset?: number): Promise<WalletResult>;
    private getKycLimits;
    private checkLoadLimits;
    private checkSpendingLimits;
    private validateLoadSource;
}
export declare const cashWalletService: CashWalletService;
export default cashWalletService;
//# sourceMappingURL=CashWalletService.d.ts.map