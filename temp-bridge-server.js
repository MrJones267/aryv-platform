// Temporary Bridge Server for ARYV Domain Testing
// This creates a server that can be deployed quickly to test the mobile app

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors({
  origin: ['https://aryv-app.com', 'https://www.aryv-app.com', 'https://admin.aryv-app.com'],
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'ARYV API Server is running!',
    timestamp: new Date().toISOString(),
    server: 'bridge-server',
    version: '1.0.0'
  });
});

// Authentication endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  console.log(`Login attempt: ${email}`);
  
  // Accept any credentials for testing
  res.json({
    success: true,
    message: 'Login successful',
    data: {
      accessToken: `aryv-token-${Date.now()}`,
      refreshToken: `aryv-refresh-${Date.now()}`,
      expiresIn: 3600,
      user: {
        id: Date.now(),
        email,
        role: 'user',
        firstName: 'ARYV',
        lastName: 'User'
      }
    }
  });
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  
  console.log(`Registration attempt: ${email}`);
  
  res.json({
    success: true,
    message: 'Registration successful',
    data: {
      accessToken: `aryv-token-${Date.now()}`,
      refreshToken: `aryv-refresh-${Date.now()}`,
      expiresIn: 3600,
      user: {
        id: Date.now(),
        email,
        role: 'user',
        firstName: firstName || 'New',
        lastName: lastName || 'User'
      }
    }
  });
});

app.post('/api/auth/refresh', (req, res) => {
  res.json({
    success: true,
    message: 'Token refreshed',
    data: {
      accessToken: `aryv-token-${Date.now()}`,
      refreshToken: `aryv-refresh-${Date.now()}`,
      expiresIn: 3600
    }
  });
});

// Catch-all for other API endpoints
app.use('/api/*', (req, res) => {
  res.json({
    success: true,
    message: 'ARYV API Bridge Server',
    endpoint: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 ARYV Bridge Server Running');
  console.log(`✅ Port: ${PORT}`);
  console.log('✅ Ready for deployment to api.aryv-app.com');
  console.log('📱 Mobile app authentication will work once deployed!');
});

module.exports = app;