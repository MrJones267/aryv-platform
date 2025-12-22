// Windows-Compatible Backend Server for Android Emulator Testing
const http = require('http');
const url = require('url');

const PORT = 3001;
const HOST = '0.0.0.0';

// Mock authentication data
const mockCredentials = {
  'user@aryv-app.com': 'user123',
  'admin@aryv-app.com': 'admin123',
  'mike.passenger@aryv-app.com': 'test123'
};

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

function sendJSON(res, data, statusCode = 200) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
  
  res.writeHead(statusCode, corsHeaders);
  res.end(JSON.stringify(data, null, 2));
}

function handleCORS(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return true;
  }
  return false;
}

const server = http.createServer(async (req, res) => {
  if (handleCORS(req, res)) return;

  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] ${method} ${path}`);

  try {
    // Health check
    if (path === '/health' && method === 'GET') {
      return sendJSON(res, {
        success: true,
        message: 'ARYV Backend Server Running',
        timestamp,
        server: 'windows-compatible',
        version: '1.0.0'
      });
    }

    // Authentication endpoints
    if (path === '/api/auth/login' && method === 'POST') {
      const body = await parseBody(req);
      const { email, password } = body;
      
      // Check mock credentials OR accept any credentials for testing
      if (mockCredentials[email] === password || true) {
        return sendJSON(res, {
          success: true,
          message: 'Login successful',
          data: {
            accessToken: `mock-token-${Date.now()}`,
            refreshToken: `refresh-${Date.now()}`,
            expiresIn: 3600,
            user: {
              id: Date.now(),
              email,
              role: 'user',
              firstName: 'Test',
              lastName: 'User'
            }
          }
        });
      } else {
        return sendJSON(res, {
          success: false,
          message: 'Invalid credentials'
        }, 401);
      }
    }

    if (path === '/api/auth/register' && method === 'POST') {
      const body = await parseBody(req);
      const { email, password, firstName, lastName } = body;
      
      return sendJSON(res, {
        success: true,
        message: 'Registration successful',
        data: {
          accessToken: `mock-token-${Date.now()}`,
          refreshToken: `refresh-${Date.now()}`,
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
    }

    if (path === '/api/auth/refresh' && method === 'POST') {
      return sendJSON(res, {
        success: true,
        message: 'Token refreshed',
        data: {
          accessToken: `mock-token-${Date.now()}`,
          refreshToken: `refresh-${Date.now()}`,
          expiresIn: 3600
        }
      });
    }

    // Default response
    return sendJSON(res, {
      success: true,
      message: 'ARYV API Mock Server',
      endpoint: { method, path, timestamp },
      note: 'Windows-compatible backend for Android emulator testing'
    });

  } catch (error) {
    console.error(`[${timestamp}] Error:`, error);
    return sendJSON(res, {
      success: false,
      message: 'Server error',
      error: error.message
    }, 500);
  }
});

server.listen(PORT, HOST, () => {
  console.log('🚀 ARYV BACKEND SERVER (WINDOWS)');
  console.log('================================');
  console.log(`✅ Server: http://localhost:${PORT}`);
  console.log(`📱 Android: http://10.0.2.2:${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
  console.log('🔑 Any email/password works for testing');
  console.log('Ready for Android emulator testing!');
});

process.on('SIGINT', () => {
  console.log('\n🛑 Server shutting down...');
  server.close(() => process.exit(0));
});