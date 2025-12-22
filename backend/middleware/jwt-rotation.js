/**
 * JWT Secret Rotation Middleware
 * Handles secure JWT secret rotation for production environment
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class JWTSecretManager {
  constructor() {
    this.currentSecret = process.env.JWT_SECRET || this.generateSecret();
    this.previousSecret = null;
    this.rotationInterval = parseInt(process.env.JWT_ROTATION_INTERVAL) || (30 * 24 * 60 * 60 * 1000); // 30 days
    this.lastRotation = Date.now();
    
    // Auto-rotation timer (only in production)
    if (process.env.NODE_ENV === 'production' && process.env.JWT_AUTO_ROTATION === 'true') {
      this.startAutoRotation();
    }
  }

  generateSecret() {
    return crypto.randomBytes(64).toString('hex');
  }

  shouldRotate() {
    return Date.now() - this.lastRotation > this.rotationInterval;
  }

  rotateSecret() {
    console.log('🔄 JWT Secret rotation initiated');
    this.previousSecret = this.currentSecret;
    this.currentSecret = this.generateSecret();
    this.lastRotation = Date.now();
    
    // In production, you might want to store this in a secure key management service
    console.log('✅ JWT Secret rotated successfully');
    
    // Notify monitoring systems
    if (process.env.WEBHOOK_SECRET_ROTATION) {
      this.notifySecretRotation();
    }
  }

  notifySecretRotation() {
    // Optional: Send notification to monitoring/alerting systems
    console.log('📢 JWT Secret rotation notification sent');
  }

  startAutoRotation() {
    setInterval(() => {
      if (this.shouldRotate()) {
        this.rotateSecret();
      }
    }, 24 * 60 * 60 * 1000); // Check daily
  }

  signToken(payload, options = {}) {
    const defaultOptions = {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: process.env.JWT_ISSUER || 'aryv-app.com',
      audience: process.env.JWT_AUDIENCE || 'aryv-users',
    };

    return jwt.sign(payload, this.currentSecret, { ...defaultOptions, ...options });
  }

  verifyToken(token) {
    try {
      // Try current secret first
      return jwt.verify(token, this.currentSecret);
    } catch (error) {
      // If current secret fails and we have a previous secret, try it
      if (this.previousSecret && error.name === 'JsonWebTokenError') {
        try {
          console.log('🔄 Verifying token with previous secret');
          return jwt.verify(token, this.previousSecret);
        } catch (previousError) {
          throw error; // Throw original error
        }
      }
      throw error;
    }
  }

  // Middleware for automatic token verification
  authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = this.verifyToken(token);
      req.user = decoded;
      
      // Add token refresh hint if token is close to expiry
      const timeUntilExpiry = decoded.exp * 1000 - Date.now();
      const refreshThreshold = 2 * 60 * 60 * 1000; // 2 hours
      
      if (timeUntilExpiry < refreshThreshold) {
        res.setHeader('X-Token-Refresh-Suggested', 'true');
      }
      
      next();
    } catch (error) {
      console.error('JWT verification failed:', error.message);
      
      let message = 'Invalid token';
      let code = 'INVALID_TOKEN';
      
      if (error.name === 'TokenExpiredError') {
        message = 'Token expired';
        code = 'TOKEN_EXPIRED';
      } else if (error.name === 'JsonWebTokenError') {
        message = 'Token malformed';
        code = 'TOKEN_MALFORMED';
      }

      return res.status(401).json({
        success: false,
        message,
        code
      });
    }
  }

  // Endpoint for token refresh
  refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token required'
        });
      }

      // Verify refresh token (you might store these differently)
      const decoded = this.verifyToken(refreshToken);
      
      // Generate new access token
      const newAccessToken = this.signToken({
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role
      });

      // Generate new refresh token
      const newRefreshToken = this.signToken({
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role
      }, { 
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
      });

      res.json({
        success: true,
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn: 7 * 24 * 60 * 60 // 7 days in seconds
        }
      });
    } catch (error) {
      console.error('Token refresh failed:', error.message);
      res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
  }

  // Get current secret info (for debugging/monitoring)
  getSecretInfo() {
    return {
      hasCurrentSecret: !!this.currentSecret,
      hasPreviousSecret: !!this.previousSecret,
      lastRotation: new Date(this.lastRotation).toISOString(),
      nextRotation: new Date(this.lastRotation + this.rotationInterval).toISOString(),
      shouldRotate: this.shouldRotate()
    };
  }
}

// Export singleton instance
const jwtManager = new JWTSecretManager();

module.exports = {
  jwtManager,
  authenticateToken: (req, res, next) => jwtManager.authenticateToken(req, res, next),
  refreshToken: (req, res) => jwtManager.refreshToken(req, res),
  signToken: (payload, options) => jwtManager.signToken(payload, options),
  verifyToken: (token) => jwtManager.verifyToken(token)
};