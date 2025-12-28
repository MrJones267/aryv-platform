/**
 * @fileoverview Database configuration for Sequelize with PostGIS support
 * @author Oabona-Majoko
 * @created 2025-01-20
 * @lastModified 2025-01-20
 */

import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration
let sequelize: Sequelize;

if (process.env['DATABASE_URL']) {
  // Railway/Heroku-style DATABASE_URL
  console.log('🔗 Using DATABASE_URL for connection');
  sequelize = new Sequelize(process.env['DATABASE_URL'], {
    dialect: 'postgres',
    logging: process.env['NODE_ENV'] === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: {
      ssl: process.env['NODE_ENV'] === 'production' ? {
        require: true,
        rejectUnauthorized: false,
      } : false,
    },
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true,
    },
  });
} else {
  // Individual environment variables (for local development)
  console.log('🔧 Using individual environment variables for connection');
  const DB_CONFIG = {
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432'),
    database: process.env['DB_NAME'] || 'aryv',
    username: process.env['DB_USER'] || 'aryv_user',
    password: process.env['DB_PASSWORD'] || 'aryv_secure_password',
    dialect: 'postgres' as const,
    logging: process.env['NODE_ENV'] === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: {
      ssl: process.env['NODE_ENV'] === 'production' ? {
        require: true,
        rejectUnauthorized: false,
      } : false,
    },
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true,
    },
  };

  sequelize = new Sequelize(
    DB_CONFIG.database,
    DB_CONFIG.username,
    DB_CONFIG.password,
    DB_CONFIG,
  );
}

// Test database connection
const testConnection = async (): Promise<void> => {
  try {
    console.log('🔍 Database connection details:', {
      hasConnectionString: !!process.env['DATABASE_URL'],
      nodeEnv: process.env['NODE_ENV'],
      sslEnabled: process.env['NODE_ENV'] === 'production',
    });
    
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');

    // Enable PostGIS extension
    try {
      await sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis;');
      console.log('✅ PostGIS extension enabled');
    } catch (postgisError) {
      console.log('⚠️ PostGIS extension setup skipped (may already exist)');
    }
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    console.error('🔧 Check DATABASE_URL and network connectivity');
    throw error;
  }
};

export { sequelize, testConnection };
export { Op, QueryTypes } from 'sequelize';
export default sequelize;
