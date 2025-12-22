@echo off
REM ARYV Cloudflare Workers Deployment Script

echo 🚀 ARYV CLOUDFLARE DEPLOYMENT
echo =============================

cd /d "C:\Users\majok\Hitch\backend"

echo ✅ Installing Wrangler CLI...
call npm install -g wrangler

echo ✅ Authenticating with Cloudflare...
call wrangler login

echo ✅ Deploying ARYV API to Cloudflare Workers...
call wrangler publish

echo.
echo 🎉 DEPLOYMENT COMPLETE!
echo.
echo Next Steps:
echo 1. Go to Cloudflare Dashboard → Workers
echo 2. Find your 'aryv-api' worker
echo 3. Add custom domain: api.aryv-app.com
echo 4. Test mobile app authentication
echo.
pause