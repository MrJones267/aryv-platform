import { Model, CreationOptional, InferAttributes, InferCreationAttributes, ForeignKey, NonAttribute } from 'sequelize';
import { BookingStatus } from '../types';
import type { UserModel } from './User';
import type { RideModel } from './Ride';
export interface BookingModel extends Model<InferAttributes<BookingModel>, InferCreationAttributes<BookingModel>> {
    id: CreationOptional<string>;
    rideId: ForeignKey<string>;
    passengerId: ForeignKey<string>;
    seatsBooked: number;
    totalAmount: number;
    platformFee: number;
    status: CreationOptional<BookingStatus>;
    pickupAddress: CreationOptional<string | null>;
    dropoffAddress: CreationOptional<string | null>;
    specialRequests: CreationOptional<string | null>;
    paymentIntentId: CreationOptional<string | null>;
    cancelReason: CreationOptional<string | null>;
    ratingGiven: CreationOptional<number | null>;
    reviewText: CreationOptional<string | null>;
    createdAt: CreationOptional<Date>;
    updatedAt: CreationOptional<Date>;
    ride?: NonAttribute<RideModel>;
    passenger?: NonAttribute<UserModel>;
    canCancel: NonAttribute<boolean>;
    canRate: NonAttribute<boolean>;
}
declare const Booking: import("sequelize").ModelCtor<BookingModel>;
export default Booking;
//# sourceMappingURL=Booking.d.ts.map