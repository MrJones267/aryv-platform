/**
 * Admin Panel Router - Serves different admin interfaces
 * Routes:
 * /simple - Simplified admin (fast, mobile-friendly)
 * /pro - Professional React admin (full features)
 * / - Default to simplified
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route to professional React admin
    if (path.startsWith('/pro')) {
      // Redirect to React admin panel deployment
      const newUrl = `https://aryv-admin-react.pages.dev${path.replace('/pro', '')}`;
      return fetch(newUrl, request);
    }

    // Route to simplified admin (default)
    if (path.startsWith('/simple') || path === '/') {
      // Serve simplified admin
      const simpleAdminUrl = `https://aryv-admin-working.majokoobo.workers.dev${path.replace('/simple', '')}`;
      return fetch(simpleAdminUrl, request);
    }

    // Health check
    if (path === '/health') {
      return new Response(JSON.stringify({
        success: true,
        message: 'ARYV Admin Router - Both interfaces available',
        routes: {
          simplified: '/simple (default)',
          professional: '/pro',
          health: '/health'
        },
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Default fallback to simplified admin
    const simpleAdminUrl = `https://aryv-admin-working.majokoobo.workers.dev${path}`;
    return fetch(simpleAdminUrl, request);
  }
};