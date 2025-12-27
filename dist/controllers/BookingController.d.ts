import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare class BookingController {
    getMyBookings(req: AuthenticatedRequest, res: Response): Promise<void>;
    getBookingById(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateBooking(req: AuthenticatedRequest, res: Response): Promise<void>;
    cancelBooking(req: AuthenticatedRequest, res: Response): Promise<void>;
    confirmBooking(req: AuthenticatedRequest, res: Response): Promise<void>;
    rateBooking(req: AuthenticatedRequest, res: Response): Promise<void>;
    createPaymentIntent(req: AuthenticatedRequest, res: Response): Promise<void>;
    confirmPayment(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=BookingController.d.ts.map