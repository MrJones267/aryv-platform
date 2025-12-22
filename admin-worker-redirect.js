/**
 * Redirect Worker to point to full React admin panel
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Redirect all requests to the full admin panel on Pages
    const newUrl = `https://aryv-admin-full.pages.dev${url.pathname}${url.search}`;
    
    return Response.redirect(newUrl, 301);
  }
};