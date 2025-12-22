/**
 * Google OAuth Service
 * Handles Google authentication integration
 */

const { OAuth2Client } = require('google-auth-library');
const { signToken } = require('../middleware/jwt-rotation');

class GoogleAuthService {
  constructor() {
    this.client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Generate Google OAuth URL
   */
  getAuthUrl(state = '') {
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state, // Can include redirect info
      prompt: 'select_account', // Force account selection
    });
  }

  /**
   * Verify Google ID Token (for mobile apps)
   */
  async verifyIdToken(idToken) {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      
      return {
        success: true,
        user: {
          googleId: payload.sub,
          email: payload.email,
          emailVerified: payload.email_verified,
          firstName: payload.given_name,
          lastName: payload.family_name,
          fullName: payload.name,
          picture: payload.picture,
          locale: payload.locale,
        },
      };
    } catch (error) {
      console.error('Google ID token verification failed:', error);
      return {
        success: false,
        error: 'Invalid Google token',
      };
    }
  }

  /**
   * Handle OAuth callback (web flow)
   */
  async handleCallback(code, state) {
    try {
      const { tokens } = await this.client.getToken(code);
      this.client.setCredentials(tokens);

      // Get user info
      const userInfo = await this.getUserInfo(tokens.access_token);
      
      return {
        success: true,
        user: userInfo,
        tokens: tokens,
      };
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      return {
        success: false,
        error: 'OAuth callback failed',
      };
    }
  }

  /**
   * Get user info from Google API
   */
  async getUserInfo(accessToken) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }

      const userInfo = await response.json();
      
      return {
        googleId: userInfo.id,
        email: userInfo.email,
        emailVerified: userInfo.verified_email,
        firstName: userInfo.given_name,
        lastName: userInfo.family_name,
        fullName: userInfo.name,
        picture: userInfo.picture,
        locale: userInfo.locale,
      };
    } catch (error) {
      console.error('Get user info error:', error);
      throw new Error('Failed to get user information');
    }
  }

  /**
   * Find or create user from Google data
   */
  async findOrCreateUser(googleUser, pool) {
    try {
      // Check if user exists by email
      let userQuery = 'SELECT id, email, first_name, last_name, google_id, is_active FROM users WHERE email = $1';
      let userResult = await pool.query(userQuery, [googleUser.email]);

      if (userResult.rows.length > 0) {
        // User exists, update Google ID if not set
        const existingUser = userResult.rows[0];
        
        if (!existingUser.google_id) {
          await pool.query(
            'UPDATE users SET google_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [googleUser.googleId, existingUser.id]
          );
        }

        return existingUser;
      } else {
        // Create new user
        const insertQuery = `
          INSERT INTO users (email, first_name, last_name, google_id, is_verified, user_type, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, email, first_name, last_name, user_type, status
        `;
        
        const newUserResult = await pool.query(insertQuery, [
          googleUser.email,
          googleUser.firstName || '',
          googleUser.lastName || '',
          googleUser.googleId,
          true, // Email verified through Google
          'passenger', // Default type
          'active'
        ]);

        return newUserResult.rows[0];
      }
    } catch (error) {
      console.error('Find or create user error:', error);
      throw new Error('Failed to process user data');
    }
  }

  /**
   * Generate JWT for Google authenticated user
   */
  generateTokensForUser(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.user_type || 'passenger',
      authMethod: 'google',
    };

    const accessToken = signToken(payload);
    const refreshToken = signToken(payload, { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' 
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
    };
  }
}

// Export singleton instance
const googleAuthService = new GoogleAuthService();

module.exports = {
  googleAuthService,
  GoogleAuthService,
};