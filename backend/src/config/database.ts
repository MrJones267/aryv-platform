/**
 * @fileoverview Database configuration for Sequelize with PostGIS support
 * @author Oabona-Majoko
 * @created 2025-01-20
 * @lastModified 2025-01-20
 */

import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env['NODE_ENV'] === 'production';

const SHARED_CONFIG = {
  dialect: 'postgres' as const,
  logging: false,
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  dialectOptions: {
    ssl: isProduction ? { require: true, rejectUnauthorized: false } : false,
  },
  define: { timestamps: true, underscored: true, freezeTableName: true },
};

// Railway injects DATABASE_URL; fall back to individual PG* / DB_* vars
const DATABASE_URL =
  process.env['DATABASE_URL'] ||
  process.env['POSTGRES_URL'] ||
  process.env['POSTGRESQL_URL'];

const sequelize = DATABASE_URL
  ? new Sequelize(DATABASE_URL, SHARED_CONFIG)
  : new Sequelize(
      process.env['DB_NAME'] || process.env['PGDATABASE'] || 'aryv',
      process.env['DB_USER'] || process.env['PGUSER'] || 'aryv_user',
      process.env['DB_PASSWORD'] || process.env['PGPASSWORD'] || '',
      {
        ...SHARED_CONFIG,
        host: process.env['DB_HOST'] || process.env['PGHOST'] || 'localhost',
        port: parseInt(process.env['DB_PORT'] || process.env['PGPORT'] || '5432'),
      },
    );

// Test database connection
const testConnection = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');

    // Enable PostGIS extension
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    console.log('✅ PostGIS extension enabled');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    throw error;
  }
};

export { sequelize, testConnection };
export { Op, QueryTypes } from 'sequelize';
export default sequelize;
