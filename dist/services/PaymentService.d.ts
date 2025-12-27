import Stripe from 'stripe';
export interface PaymentIntentData {
    bookingId: string;
    amount: number;
    currency: string;
    description?: string;
    receiptEmail?: string;
}
export interface PaymentResult {
    success: boolean;
    data?: any;
    error?: string;
}
export declare class PaymentService {
    private stripe;
    constructor();
    createPaymentIntent(data: PaymentIntentData): Promise<PaymentResult>;
    verifyPaymentIntent(paymentIntentId: string): Promise<PaymentResult>;
    processRefund(bookingId: string, amount?: number, reason?: string): Promise<PaymentResult>;
    handleWebhookEvent(event: Stripe.Event): Promise<PaymentResult>;
    private handlePaymentSucceeded;
    private handlePaymentFailed;
    private handleChargeDispute;
    constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event | null;
}
export declare const paymentService: PaymentService;
export default paymentService;
//# sourceMappingURL=PaymentService.d.ts.map