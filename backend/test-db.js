require('dotenv').config({ path: '../.env.production' });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log,
});

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    console.log('Database URL:', process.env.DATABASE_URL);
    
    // Test PostGIS functionality
    const [results] = await sequelize.query("SELECT ST_Distance(ST_MakePoint(-74.006, 40.7128), ST_MakePoint(-73.935, 40.7306)) as distance");
    console.log('✅ PostGIS working. Distance calculated:', results[0].distance);
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
  }
}

testConnection();
