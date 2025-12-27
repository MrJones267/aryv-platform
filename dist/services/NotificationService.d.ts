import { Server as SocketIOServer } from 'socket.io';
import { BookingStatus, RideStatus } from '../types';
export interface NotificationData {
    type: string;
    title: string;
    message: string;
    data?: any;
    timestamp: string;
}
export interface BookingNotification extends NotificationData {
    bookingId: string;
    rideId: string;
    recipientId: string;
}
export interface RideNotification extends NotificationData {
    rideId: string;
    recipientId: string;
}
export declare class NotificationService {
    private io;
    private connectedUsers;
    constructor(io?: SocketIOServer);
    setSocketIO(io: SocketIOServer): void;
    private setupSocketHandlers;
    sendToUser(userId: string, notification: NotificationData): Promise<void>;
    sendToBooking(bookingId: string, notification: NotificationData): Promise<void>;
    sendToRide(rideId: string, notification: NotificationData): Promise<void>;
    notifyBookingStatusChange(bookingId: string, newStatus: BookingStatus, updatedBy: string): Promise<void>;
    notifyRideStatusChange(rideId: string, newStatus: RideStatus, updatedBy: string): Promise<void>;
    notifyNewBookingRequest(bookingId: string): Promise<void>;
    private createBookingStatusNotifications;
    private getRideStatusMessage;
    getConnectedUsersCount(): number;
    getUserSocketCount(userId: string): number;
    isUserConnected(userId: string): boolean;
}
export declare const notificationService: NotificationService;
export default notificationService;
//# sourceMappingURL=NotificationService.d.ts.map