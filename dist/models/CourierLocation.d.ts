import { Model, Optional } from 'sequelize';
export interface CourierLocationAttributes {
    id: string;
    deliveryAgreementId: string;
    courierId: string;
    location: [number, number];
    accuracy?: number;
    speed?: number;
    heading?: number;
    timestamp: Date;
}
export interface CourierLocationCreationAttributes extends Optional<CourierLocationAttributes, 'id' | 'accuracy' | 'speed' | 'heading'> {
}
export declare class CourierLocation extends Model<CourierLocationAttributes, CourierLocationCreationAttributes> implements CourierLocationAttributes {
    id: string;
    deliveryAgreementId: string;
    courierId: string;
    location: [number, number];
    accuracy?: number;
    speed?: number;
    heading?: number;
    timestamp: Date;
    readonly deliveryAgreement?: DeliveryAgreement;
    readonly courier?: import('./User').UserModel;
    isRecentLocation(): boolean;
    isAccurate(): boolean;
    getLocationAge(): number;
    toJSON(): object;
}
import { DeliveryAgreement } from './DeliveryAgreement';
export default CourierLocation;
//# sourceMappingURL=CourierLocation.d.ts.map