import { Model, Optional } from 'sequelize';
export interface DemandMetricsAttributes {
    id: string;
    locationHash: string;
    timeSlot: Date;
    availableCouriers: number;
    activeDemand: number;
    completedDeliveries: number;
    averageDeliveryTime: number;
    demandMultiplier: number;
    weatherConditions: string | null;
    eventModifier: number;
    calculatedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
interface DemandMetricsCreationAttributes extends Optional<DemandMetricsAttributes, 'id' | 'createdAt' | 'updatedAt'> {
}
declare class DemandMetrics extends Model<DemandMetricsAttributes, DemandMetricsCreationAttributes> implements DemandMetricsAttributes {
    id: string;
    locationHash: string;
    timeSlot: Date;
    availableCouriers: number;
    activeDemand: number;
    completedDeliveries: number;
    averageDeliveryTime: number;
    demandMultiplier: number;
    weatherConditions: string | null;
    eventModifier: number;
    calculatedAt: Date;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    getDemandLevel(): 'LOW' | 'NORMAL' | 'HIGH' | 'SURGE';
    getSupplyDemandRatio(): number;
    isDataFresh(maxAgeMinutes?: number): boolean;
    toJSON(): {
        demandLevel: "LOW" | "NORMAL" | "HIGH" | "SURGE";
        supplyDemandRatio: number;
        isDataFresh: boolean;
        id: string;
        locationHash: string;
        timeSlot: Date;
        availableCouriers: number;
        activeDemand: number;
        completedDeliveries: number;
        averageDeliveryTime: number;
        demandMultiplier: number;
        weatherConditions: string | null;
        eventModifier: number;
        calculatedAt: Date;
        createdAt: Date;
        updatedAt: Date;
    };
}
export { DemandMetrics };
export default DemandMetrics;
//# sourceMappingURL=DemandMetrics.d.ts.map