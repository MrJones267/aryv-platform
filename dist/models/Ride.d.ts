import { Model, CreationOptional, InferAttributes, InferCreationAttributes, ForeignKey, NonAttribute } from 'sequelize';
import { RideStatus, Coordinates, GeoPoint } from '../types';
import type { UserModel } from './User';
import type { VehicleModel } from './Vehicle';
export interface RideModel extends Model<InferAttributes<RideModel>, InferCreationAttributes<RideModel>> {
    id: CreationOptional<string>;
    driverId: ForeignKey<string>;
    vehicleId: ForeignKey<string>;
    originAddress: string;
    originCoordinates: GeoPoint;
    destinationAddress: string;
    destinationCoordinates: GeoPoint;
    departureTime: Date;
    estimatedDuration: CreationOptional<number | null>;
    distance: CreationOptional<number | null>;
    availableSeats: number;
    pricePerSeat: number;
    status: CreationOptional<RideStatus>;
    description: CreationOptional<string | null>;
    route: CreationOptional<Coordinates[] | null>;
    createdAt: CreationOptional<Date>;
    updatedAt: CreationOptional<Date>;
    driver?: NonAttribute<UserModel>;
    vehicle?: NonAttribute<VehicleModel>;
    isActive: NonAttribute<boolean>;
    bookedSeats: NonAttribute<number>;
}
declare const Ride: import("sequelize").ModelCtor<RideModel>;
export default Ride;
//# sourceMappingURL=Ride.d.ts.map