/**
 * Cloudflare Workers Entry Point for ARYV Backend
 * Optimized for serverless deployment
 */

// CORS headers for aryv-app.com domain
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Will be restricted in production
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
};

// Handle CORS preflight
function handleCORS(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  return null;
}

// Parse JSON body
async function parseJSON(request) {
  try {
    if (request.headers.get('content-type')?.includes('application/json')) {
      return await request.json();
    }
    return {};
  } catch {
    return {};
  }
}

// Send JSON response with CORS
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: corsHeaders
  });
}

// Main request handler
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    const corsResponse = handleCORS(request);
    if (corsResponse) return corsResponse;

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const timestamp = new Date().toISOString();

    console.log(`[${timestamp}] ${method} ${path}`);

    try {
      // Health check endpoint
      if (path === '/health' && method === 'GET') {
        return jsonResponse({
          success: true,
          message: 'ARYV API Server is running on Cloudflare Workers!',
          timestamp,
          server: 'cloudflare-workers',
          version: '1.0.0',
          environment: env.NODE_ENV || 'production'
        });
      }

      // Authentication endpoints
      if (path === '/api/auth/login' && method === 'POST') {
        const body = await parseJSON(request);
        const { email, password } = body;

        // Mock authentication - replace with real auth logic
        if (email && password) {
          return jsonResponse({
            success: true,
            message: 'Login successful',
            data: {
              accessToken: `aryv-workers-token-${Date.now()}`,
              refreshToken: `aryv-workers-refresh-${Date.now()}`,
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
        } else {
          return jsonResponse({
            success: false,
            message: 'Invalid credentials'
          }, 401);
        }
      }

      if (path === '/api/auth/register' && method === 'POST') {
        const body = await parseJSON(request);
        const { email, password, firstName, lastName } = body;

        return jsonResponse({
          success: true,
          message: 'Registration successful',
          data: {
            accessToken: `aryv-workers-token-${Date.now()}`,
            refreshToken: `aryv-workers-refresh-${Date.now()}`,
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
        return jsonResponse({
          success: true,
          message: 'Token refreshed successfully',
          data: {
            accessToken: `aryv-workers-token-${Date.now()}`,
            refreshToken: `aryv-workers-refresh-${Date.now()}`,
            expiresIn: 3600
          }
        });
      }

      // User profile endpoint
      if (path === '/api/auth/profile' && method === 'GET') {
        const authHeader = request.headers.get('authorization');
        
        if (authHeader?.startsWith('Bearer ')) {
          return jsonResponse({
            success: true,
            data: {
              id: Date.now(),
              email: 'user@aryv-app.com',
              firstName: 'ARYV',
              lastName: 'User',
              role: 'user'
            }
          });
        } else {
          return jsonResponse({
            success: false,
            message: 'Authentication required'
          }, 401);
        }
      }

      // Catch-all for other API endpoints
      if (path.startsWith('/api/')) {
        return jsonResponse({
          success: true,
          message: 'ARYV API on Cloudflare Workers',
          endpoint: path,
          method,
          timestamp,
          note: 'Endpoint not implemented yet'
        });
      }

      // Default response
      return jsonResponse({
        success: false,
        message: 'Endpoint not found',
        path,
        timestamp
      }, 404);

    } catch (error) {
      console.error(`[${timestamp}] Error:`, error);
      return jsonResponse({
        success: false,
        message: 'Internal server error',
        error: error.message,
        timestamp
      }, 500);
    }
  }
};