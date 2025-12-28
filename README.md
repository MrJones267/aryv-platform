# ARYV Backend - Railway Deployment (Docker Mirror)

This deployment **exactly mirrors** the Docker backend configuration.

## Docker vs Railway Comparison

### ✅ Exact Matches:
- **Start Command**: `node dist/index.js`
- **Build Process**: TypeScript compilation to dist/
- **Health Check**: `/health` endpoint
- **Dependencies**: Exact same package.json
- **Source Structure**: Same src/ and dist/ layout

### 🔄 Build Process (Mirrors Docker multi-stage):
1. **Install all deps**: `npm ci --include=dev` (like Docker build stage)
2. **Build TypeScript**: `npm run build` (compiles to dist/)
3. **Production deps**: `npm ci --only=production` (like Docker production stage)
4. **Start**: `node dist/index.js` (exact Docker CMD)

## Key Features (From Docker):
- Express.js with TypeScript
- PostgreSQL with Sequelize ORM
- Authentication with JWT + bcrypt
- Socket.io real-time features
- Comprehensive API endpoints
- Security middleware (helmet, rate limiting)
- Health monitoring

## Environment Variables (Same as Docker):
```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
JWT_SECRET=...
CORS_ORIGIN=...
```

## Health Check:
- **Endpoint**: `GET /health`
- **Expected**: 200 OK with system info
- **Timeout**: 30 seconds

Generated to exactly mirror Docker backend for Railway deployment.
