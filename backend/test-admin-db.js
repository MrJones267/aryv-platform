/**
 * Test script to verify admin system database integration
 */

const { Sequelize } = require('sequelize');

// Database configuration
const sequelize = new Sequelize('hitch', 'hitch_user', 'hitch_secure_password', {
  host: 'localhost',
  port: 5433,
  dialect: 'postgres',
  logging: false
});

async function testAdminSystem() {
  try {
    console.log('🔄 Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection successful');

    console.log('🔄 Testing admin users table...');
    const [results] = await sequelize.query('SELECT * FROM admin_users LIMIT 5');
    console.log('✅ Admin users table accessible');
    console.log(`Found ${results.length} admin users:`);
    results.forEach(user => {
      console.log(`  - ${user.email} (${user.role})`);
    });

    console.log('🔄 Testing rides table...');
    const [rideResults] = await sequelize.query('SELECT COUNT(*) as count FROM rides');
    console.log(`✅ Rides table accessible - ${rideResults[0].count} rides found`);

    console.log('🔄 Testing bookings table...');
    const [bookingResults] = await sequelize.query('SELECT COUNT(*) as count FROM bookings');
    console.log(`✅ Bookings table accessible - ${bookingResults[0].count} bookings found`);

    console.log('🔄 Testing users table...');
    const [userResults] = await sequelize.query('SELECT COUNT(*) as count FROM users');
    console.log(`✅ Users table accessible - ${userResults[0].count} users found`);

    console.log('\n🎉 Database integration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the test
testAdminSystem().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});