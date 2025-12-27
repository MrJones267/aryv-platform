"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../config/database");
const models_1 = require("../models");
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-jwt-secret';
process.env['DB_NAME'] = 'hitch_test_db';
beforeAll(async () => {
    try {
        await (0, models_1.syncDatabase)(true);
    }
    catch (error) {
        console.error('Test setup failed:', error);
        throw error;
    }
});
afterAll(async () => {
    try {
        await database_1.sequelize.close();
    }
    catch (error) {
        console.error('Test teardown failed:', error);
    }
});
beforeEach(async () => {
    try {
        await database_1.sequelize.truncate({ cascade: true });
    }
    catch (error) {
        console.error('Test cleanup failed:', error);
    }
});
jest.setTimeout(30000);
//# sourceMappingURL=setup.js.map