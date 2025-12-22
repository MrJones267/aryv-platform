require('dotenv').config();
const express = require('express');
const { Sequelize } = require('sequelize');

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'ARYV Backend is running!'
  });
});

// Database test endpoint
app.get('/test-db', async (req, res) => {
  try {
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
    });
    
    await sequelize.authenticate();
    const [results] = await sequelize.query("SELECT ST_Distance(ST_MakePoint(-74.006, 40.7128), ST_MakePoint(-73.935, 40.7306)) as distance");
    await sequelize.close();
    
    res.json({ 
      status: 'Database OK',
      postgis_test_distance: results[0].distance,
      message: 'Database and PostGIS working!'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'Database Error',
      error: error.message 
    });
  }
});

// Basic API routes
app.get('/api/status', (req, res) => {
  res.json({ 
    message: 'ARYV API is running!',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 ARYV Backend Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Database test: http://localhost:${PORT}/test-db`);
  console.log(`API status: http://localhost:${PORT}/api/status`);
});
