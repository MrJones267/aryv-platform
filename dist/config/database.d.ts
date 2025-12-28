import { Sequelize } from 'sequelize';
declare let sequelize: Sequelize;
declare const testConnection: () => Promise<void>;
export { sequelize, testConnection };
export { Op, QueryTypes } from 'sequelize';
export default sequelize;
//# sourceMappingURL=database.d.ts.map