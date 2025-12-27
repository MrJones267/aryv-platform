"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDeliveryTiers = initializeDeliveryTiers;
const database_1 = require("../config/database");
const DemandPricingEngine_1 = __importDefault(require("../services/DemandPricingEngine"));
async function initializeDeliveryTiers() {
    try {
        console.log('🚀 Initializing delivery tiers...');
        await database_1.sequelize.authenticate();
        console.log('✅ Database connection established');
        await database_1.sequelize.sync();
        console.log('✅ Database models synchronized');
        const pricingEngine = DemandPricingEngine_1.default.getInstance();
        await pricingEngine.initializeDefaultTiers();
        console.log('✅ Default delivery tiers initialized');
        console.log('🎉 Delivery tier initialization completed successfully!');
        await database_1.sequelize.close();
    }
    catch (error) {
        console.error('❌ Error initializing delivery tiers:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    initializeDeliveryTiers();
}
//# sourceMappingURL=initialize-delivery-tiers.js.map