/**
 * @fileoverview Application configuration
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface Config {
  server: {
    port: number;
    host: string;
    nodeEnv: string;
  };
  database: {
    url: string;
    host: string;
    port: number;
    name: string;
    username: string;
    password: string;
    ssl: boolean;
    logging: boolean;
  };
  redis: {
    url: string;
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  cors: {
    origin: string[];
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  upload: {
    maxFileSize: number;
    maxFiles: number;
    allowedTypes: string[];
    destination: string;
  };
  email: {
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
    };
  };
  payment: {
    stripe: {
      secretKey: string;
      publishableKey: string;
      webhookSecret: string;
    };
  };
  aws: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    s3Bucket: string;
  };
  aiServices: {
    baseURL: string;
    timeout: number;
    enabled: boolean;
  };
  maps: {
    googleApiKey: string;
  };
  monitoring: {
    sentryDsn?: string;
    logLevel: string;
  };
  features: {
    aiMatching: boolean;
    blockchainCourier: boolean;
    realTimeChat: boolean;
    pushNotifications: boolean;
  };
}

export const config: Config = {
  server: {
    port: parseInt(process.env['PORT'] || '3001', 10),
    host: process.env['HOST'] || '0.0.0.0',
    nodeEnv: process.env['NODE_ENV'] || 'development',
  },

  database: {
    url: process.env['DATABASE_URL'] || '',
    host: process.env['POSTGRES_HOST'] || 'postgres',
    port: parseInt(process.env['POSTGRES_PORT'] || '5432', 10),
    name: process.env['POSTGRES_DB'] || 'aryv_db',
    username: process.env['POSTGRES_USER'] || 'aryv_user',
    password: process.env['POSTGRES_PASSWORD'] || 'aryv_secure_password_change_me',
    ssl: process.env['DATABASE_SSL'] === 'true',
    logging: process.env['DATABASE_LOGGING'] === 'true',
  },

  redis: {
    url: process.env['REDIS_URL'] || '',
    host: process.env['REDIS_HOST'] || 'redis',
    port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
    ...(process.env['REDIS_PASSWORD'] && { password: process.env['REDIS_PASSWORD'] }),
    db: parseInt(process.env['REDIS_DB'] || '0', 10),
  },

  jwt: {
    secret: process.env['JWT_SECRET'] || 'your-super-secret-jwt-key-at-least-32-characters-long-change-in-production',
    expiresIn: process.env['JWT_EXPIRES_IN'] || '7d',
  },

  cors: {
    origin: (process.env['CORS_ORIGIN'] || 'http://localhost:3000,http://localhost:19006').split(','),
  },

  rateLimit: {
    windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100', 10),
  },

  upload: {
    maxFileSize: parseInt(process.env['MAX_FILE_SIZE'] || '10485760', 10), // 10MB
    maxFiles: parseInt(process.env['MAX_FILES'] || '10', 10),
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    destination: process.env['UPLOAD_DESTINATION'] || './uploads',
  },

  email: {
    smtp: {
      host: process.env['SMTP_HOST'] || 'smtp.gmail.com',
      port: parseInt(process.env['SMTP_PORT'] || '587', 10),
      secure: process.env['SMTP_SECURE'] === 'true',
      user: process.env['SMTP_USER'] || '',
      pass: process.env['SMTP_PASS'] || '',
    },
  },

  payment: {
    stripe: {
      secretKey: process.env['STRIPE_SECRET_KEY'] || '',
      publishableKey: process.env['STRIPE_PUBLISHABLE_KEY'] || '',
      webhookSecret: process.env['STRIPE_WEBHOOK_SECRET'] || '',
    },
  },

  aws: {
    accessKeyId: process.env['AWS_ACCESS_KEY_ID'] || '',
    secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] || '',
    region: process.env['AWS_REGION'] || 'us-east-1',
    s3Bucket: process.env['AWS_S3_BUCKET'] || 'aryv-uploads',
  },

  aiServices: {
    baseURL: process.env['AI_SERVICES_URL'] || 'http://ai-services:5000',
    timeout: parseInt(process.env['AI_SERVICES_TIMEOUT'] || '30000', 10),
    enabled: process.env['FEATURE_AI_MATCHING'] === 'true',
  },

  maps: {
    googleApiKey: process.env['GOOGLE_MAPS_API_KEY'] || '',
  },

  monitoring: {
    ...(process.env['SENTRY_DSN'] && { sentryDsn: process.env['SENTRY_DSN'] }),
    logLevel: process.env['LOG_LEVEL'] || 'info',
  },

  features: {
    aiMatching: process.env['FEATURE_AI_MATCHING'] === 'true',
    blockchainCourier: process.env['FEATURE_BLOCKCHAIN_COURIER'] === 'true',
    realTimeChat: process.env['FEATURE_REAL_TIME_CHAT'] !== 'false', // Default enabled
    pushNotifications: process.env['FEATURE_PUSH_NOTIFICATIONS'] !== 'false', // Default enabled
  },
};

// Validate required configuration
const requiredEnvVars = [
  'JWT_SECRET',
  'POSTGRES_PASSWORD',
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  if (config.server.nodeEnv === 'production') {
    process.exit(1);
  }
}

// Export individual config sections for convenience
export const serverConfig = config.server;
export const databaseConfig = config.database;
export const redisConfig = config.redis;
export const jwtConfig = config.jwt;
export const aiServicesConfig = config.aiServices;
