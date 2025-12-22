// Simple ARYV API Worker for Cloudflare
export default {
  async fetch(request) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    };

    // Handle CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health check
      if (path === '/health') {
        return new Response(JSON.stringify({
          success: true,
          message: 'ARYV API is running!',
          timestamp: new Date().toISOString()
        }), { headers: corsHeaders });
      }

      // Login endpoint
      if (path === '/api/auth/login' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Login successful',
          data: {
            accessToken: `aryv-token-${Date.now()}`,
            refreshToken: `aryv-refresh-${Date.now()}`,
            expiresIn: 3600,
            user: {
              id: Date.now(),
              email: body.email || 'user@aryv-app.com',
              role: 'user',
              firstName: 'ARYV',
              lastName: 'User'
            }
          }
        }), { headers: corsHeaders });
      }

      // Default response
      return new Response(JSON.stringify({
        success: true,
        message: 'ARYV API Worker',
        path: path,
        timestamp: new Date().toISOString()
      }), { headers: corsHeaders });

    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Server error',
        error: error.message
      }), { 
        status: 500,
        headers: corsHeaders 
      });
    }
  }
};