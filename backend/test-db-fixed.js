require('dotenv').config();                     // loads .env automatically
const { Sequelize } = require('sequelize');

// -----------------------------------------------------------------
//  👇  Adjust the credentials only if you *don’t* have them in .env
// -----------------------------------------------------------------
const sequelize = new Sequelize({
  host: 'localhost',          // Docker maps 5432 → localhost
  port: 5432,
  database: 'hitch_db',
  username: 'hitch_user',
  password: '5PMs531kvcOpKT3JlmCmu7s5FXQBuB4M',
  dialect: 'postgres',
  logging: console.log,       // shows the generated SQL in the console
});

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    // -----------------------------------------------------------------
    //   Test PostGIS – it should return a numeric distance (meters by default)
    // -----------------------------------------------------------------
    const [results] = await sequelize.query(`
      SELECT ST_Distance(
        ST_MakePoint(-74.006, 40.7128)::geography,
        ST_MakePoint(-73.935, 40.7306)::geography
      ) AS distance
    `);
    console.log('✅ PostGIS working. Distance calculated:', results[0].distance);

    await sequelize.close();
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
    process.exit(1);
  }
}

testConnection();
