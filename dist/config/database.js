"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryTypes = exports.Op = exports.testConnection = exports.sequelize = void 0;
const sequelize_1 = require("sequelize");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
let sequelize;
if (process.env['DATABASE_URL']) {
    console.log('🔗 Using DATABASE_URL for connection');
    exports.sequelize = sequelize = new sequelize_1.Sequelize(process.env['DATABASE_URL'], {
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
}
else {
    console.log('🔧 Using individual environment variables for connection');
    const DB_CONFIG = {
        host: process.env['DB_HOST'] || 'localhost',
        port: parseInt(process.env['DB_PORT'] || '5432'),
        database: process.env['DB_NAME'] || 'aryv',
        username: process.env['DB_USER'] || 'aryv_user',
        password: process.env['DB_PASSWORD'] || 'aryv_secure_password',
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
    };
    exports.sequelize = sequelize = new sequelize_1.Sequelize(DB_CONFIG.database, DB_CONFIG.username, DB_CONFIG.password, DB_CONFIG);
}
const testConnection = async () => {
    try {
        console.log('🔍 Database connection details:', {
            hasConnectionString: !!process.env['DATABASE_URL'],
            nodeEnv: process.env['NODE_ENV'],
            sslEnabled: process.env['NODE_ENV'] === 'production',
        });
        await sequelize.authenticate();
        console.log('✅ Database connection established successfully');
        try {
            await sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis;');
            console.log('✅ PostGIS extension enabled');
        }
        catch (postgisError) {
            console.log('⚠️ PostGIS extension setup skipped (may already exist)');
        }
    }
    catch (error) {
        console.error('❌ Unable to connect to the database:', error);
        console.error('🔧 Check DATABASE_URL and network connectivity');
        throw error;
    }
};
exports.testConnection = testConnection;
var sequelize_2 = require("sequelize");
Object.defineProperty(exports, "Op", { enumerable: true, get: function () { return sequelize_2.Op; } });
Object.defineProperty(exports, "QueryTypes", { enumerable: true, get: function () { return sequelize_2.QueryTypes; } });
exports.default = sequelize;
//# sourceMappingURL=database.js.map