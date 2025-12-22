const { Client } = require('pg');

// Database configuration
const client = new Client({
  host: 'localhost',
  port: 5433,
  database: 'hitch',
  user: 'hitch_user',
  password: 'hitch_password',
});

async function testConnection() {
  try {
    await client.connect();
    console.log('✅ PostgreSQL connection established successfully.');

    // Test basic query
    const versionResult = await client.query('SELECT version()');
    console.log('✅ PostgreSQL version:', versionResult.rows[0].version.substring(0, 50) + '...');

    // Test PostGIS functionality
    const distanceResult = await client.query("SELECT ST_Distance(ST_MakePoint(-74.006, 40.7128), ST_MakePoint(-73.935, 40.7306)) as distance");
    console.log('✅ PostGIS working. Distance calculated:', distanceResult.rows[0].distance);

    await client.end();
    console.log('✅ Connection closed successfully');
  } catch (error) {
    console.error('❌ Unable to connect to the database:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
  }
}

testConnection();
