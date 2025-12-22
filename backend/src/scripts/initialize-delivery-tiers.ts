/**
 * @fileoverview Script to initialize default delivery tiers
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { sequelize } from '../config/database';
import DemandPricingEngine from '../services/DemandPricingEngine';

async function initializeDeliveryTiers() {
  try {
    console.log('🚀 Initializing delivery tiers...');

    // Ensure database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Sync database models
    await sequelize.sync();
    console.log('✅ Database models synchronized');

    // Initialize default delivery tiers
    const pricingEngine = DemandPricingEngine.getInstance();
    await pricingEngine.initializeDefaultTiers();
    console.log('✅ Default delivery tiers initialized');

    console.log('🎉 Delivery tier initialization completed successfully!');

    // Close database connection
    await sequelize.close();

  } catch (error) {
    console.error('❌ Error initializing delivery tiers:', error);
    process.exit(1);
  }
}

// Run the initialization if this script is executed directly
if (require.main === module) {
  initializeDeliveryTiers();
}

export { initializeDeliveryTiers };
