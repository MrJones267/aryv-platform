/**
 * @fileoverview Comprehensive test suite for Admin User Management API endpoints
 * @author Oabona-Majoko
 * @created 2025-01-25
 */

const request = require('supertest');
const { app } = require('../src/app');
const { sequelize } = require('../src/config/database');
const User = require('../src/models/User');
const bcrypt = require('bcryptjs');

describe('Admin User Management API', () => {
  let adminToken;
  let testUsers = [];
  let adminUser;

  beforeAll(async () => {
    // Wait for database connection
    await sequelize.authenticate();
    
    // Create admin user for testing
    const hashedPassword = await bcrypt.hash('admin123', 12);
    adminUser = await User.create({
      email: 'admin.test@hitch.com',
      passwordHash: hashedPassword,
      firstName: 'Admin',
      lastName: 'Test',
      phoneNumber: '+1234567890',
      role: 'admin',
      isVerified: true,
      isActive: true
    });

    // Login as admin to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin.test@hitch.com',
        password: 'admin123'
      });

    adminToken = loginResponse.body.data.accessToken;
  });

  beforeEach(async () => {
    // Create test users for each test
    const testUserData = [
      {
        email: 'driver.test@hitch.com',
        passwordHash: await bcrypt.hash('test123', 12),
        firstName: 'John',
        lastName: 'Driver',
        phoneNumber: '+1234567801',
        role: 'driver',
        isVerified: true,
        isActive: true
      },
      {
        email: 'passenger.test@hitch.com',
        passwordHash: await bcrypt.hash('test123', 12),
        firstName: 'Jane',
        lastName: 'Passenger',
        phoneNumber: '+1234567802',
        role: 'passenger',
        isVerified: false,
        isActive: true
      },
      {
        email: 'suspended.test@hitch.com',
        passwordHash: await bcrypt.hash('test123', 12),
        firstName: 'Suspended',
        lastName: 'User',
        phoneNumber: '+1234567803',
        role: 'driver',
        isVerified: true,
        isActive: false
      }
    ];

    testUsers = await User.bulkCreate(testUserData, { returning: true });
  });

  afterEach(async () => {
    // Clean up test users after each test
    if (testUsers.length > 0) {
      await User.destroy({
        where: {
          id: testUsers.map(user => user.id)
        }
      });
      testUsers = [];
    }
  });

  afterAll(async () => {
    // Clean up admin user
    if (adminUser) {
      await User.destroy({ where: { id: adminUser.id } });
    }
    await sequelize.close();
  });

  describe('GET /api/admin/users', () => {
    it('should return paginated list of users', async () => {
      const response = await request(app)
        .get('/api/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.pagination).toHaveProperty('page', 1);
      expect(response.body.data.pagination).toHaveProperty('limit', 10);
      expect(Array.isArray(response.body.data.users)).toBe(true);
    });

    it('should filter users by role', async () => {
      const response = await request(app)
        .get('/api/admin/users?role=driver')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users.every(user => user.role === 'driver')).toBe(true);
    });

    it('should filter users by status', async () => {
      const response = await request(app)
        .get('/api/admin/users?status=active')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users.every(user => user.status === 'active')).toBe(true);
    });

    it('should search users by name and email', async () => {
      const response = await request(app)
        .get('/api/admin/users?search=john')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const hasJohnInResults = response.body.data.users.some(user => 
        user.firstName.toLowerCase().includes('john') || 
        user.lastName.toLowerCase().includes('john') ||
        user.email.toLowerCase().includes('john')
      );
      expect(hasJohnInResults).toBe(true);
    });

    it('should filter by verification status', async () => {
      const response = await request(app)
        .get('/api/admin/users?verified=true')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users.every(user => user.isEmailVerified === true)).toBe(true);
    });

    it('should sort users by creation date', async () => {
      const response = await request(app)
        .get('/api/admin/users?sortBy=createdAt&sortOrder=ASC')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const users = response.body.data.users;
      if (users.length > 1) {
        expect(new Date(users[0].createdAt) <= new Date(users[1].createdAt)).toBe(true);
      }
    });

    it('should return 401 without valid admin token', async () => {
      await request(app)
        .get('/api/admin/users')
        .expect(401);
    });
  });

  describe('GET /api/admin/users/:id', () => {
    it('should return detailed user information', async () => {
      const userId = testUsers[0].id;
      
      const response = await request(app)
        .get(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('stats');
      expect(response.body.data.user.id).toBe(userId);
      expect(response.body.data.user).not.toHaveProperty('password');
      expect(response.body.data.user).not.toHaveProperty('refreshToken');
    });

    it('should return 404 for non-existent user', async () => {
      const fakeUserId = '123e4567-e89b-12d3-a456-426614174000';
      
      const response = await request(app)
        .get(`/api/admin/users/${fakeUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });

    it('should include user statistics', async () => {
      const userId = testUsers[0].id;
      
      const response = await request(app)
        .get(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.stats).toHaveProperty('totalRides');
      expect(response.body.data.stats).toHaveProperty('completedRides');
      expect(response.body.data.stats).toHaveProperty('totalBookings');
      expect(response.body.data.stats).toHaveProperty('accountAge');
    });
  });

  describe('PUT /api/admin/users/:id', () => {
    it('should update user information', async () => {
      const userId = testUsers[0].id;
      const updateData = {
        firstName: 'UpdatedJohn',
        lastName: 'UpdatedDriver',
        role: 'passenger'
      };

      const response = await request(app)
        .put(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.firstName).toBe('UpdatedJohn');
      expect(response.body.data.user.lastName).toBe('UpdatedDriver');
      expect(response.body.data.user.role).toBe('passenger');
    });

    it('should not allow updating sensitive fields', async () => {
      const userId = testUsers[0].id;
      const updateData = {
        firstName: 'UpdatedJohn',
        password: 'hacked123',
        id: 'fake-id'
      };

      const response = await request(app)
        .put(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.firstName).toBe('UpdatedJohn');
      // Verify sensitive fields weren't updated
      expect(response.body.data.user.id).toBe(userId);
    });

    it('should validate role changes', async () => {
      const userId = testUsers[0].id;
      const updateData = {
        role: 'invalid_role'
      };

      const response = await request(app)
        .put(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid user role');
    });

    it('should return 404 for non-existent user', async () => {
      const fakeUserId = '123e4567-e89b-12d3-a456-426614174000';
      
      const response = await request(app)
        .put(`/api/admin/users/${fakeUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Test' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/admin/users/:id/block', () => {
    it('should block a user account', async () => {
      const userId = testUsers[0].id;
      const blockData = {
        reason: 'Violation of terms and conditions'
      };

      const response = await request(app)
        .post(`/api/admin/users/${userId}/block`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(blockData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.newStatus).toBe('suspended');
      expect(response.body.data.reason).toBe(blockData.reason);

      // Verify user is actually blocked in database
      const updatedUser = await User.findByPk(userId);
      expect(updatedUser.status).toBe('suspended');
    });

    it('should require a reason for blocking', async () => {
      const userId = testUsers[0].id;

      const response = await request(app)
        .post(`/api/admin/users/${userId}/block`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Block reason is required');
    });

    it('should not block already blocked user', async () => {
      const userId = testUsers[2].id; // Already suspended user
      const blockData = {
        reason: 'Additional violation'
      };

      const response = await request(app)
        .post(`/api/admin/users/${userId}/block`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(blockData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User is already blocked');
    });

    it('should return 404 for non-existent user', async () => {
      const fakeUserId = '123e4567-e89b-12d3-a456-426614174000';
      
      const response = await request(app)
        .post(`/api/admin/users/${fakeUserId}/block`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Test reason' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/admin/users/:id/unblock', () => {
    beforeEach(async () => {
      // Block the first test user for unblock testing
      await User.update(
        { status: 'suspended' },
        { where: { id: testUsers[0].id } }
      );
    });

    it('should unblock a user account', async () => {
      const userId = testUsers[0].id;
      const unblockData = {
        reason: 'Issue resolved'
      };

      const response = await request(app)
        .post(`/api/admin/users/${userId}/unblock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(unblockData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.newStatus).toBe('active');
      expect(response.body.data.reason).toBe(unblockData.reason);

      // Verify user is actually unblocked in database
      const updatedUser = await User.findByPk(userId);
      expect(updatedUser.status).toBe('active');
    });

    it('should unblock without reason', async () => {
      const userId = testUsers[0].id;

      const response = await request(app)
        .post(`/api/admin/users/${userId}/unblock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reason).toBe('No reason provided');
    });

    it('should not unblock non-blocked user', async () => {
      const userId = testUsers[1].id; // Active user

      const response = await request(app)
        .post(`/api/admin/users/${userId}/unblock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Test unblock' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User is not blocked');
    });
  });

  describe('PUT /api/admin/users/:id/verify', () => {
    it('should verify user email', async () => {
      const userId = testUsers[1].id; // Unverified user
      const verificationData = {
        verificationType: 'email',
        notes: 'Manual verification completed'
      };

      const response = await request(app)
        .put(`/api/admin/users/${userId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(verificationData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.verificationType).toBe('email');

      // Verify in database
      const updatedUser = await User.findByPk(userId);
      expect(updatedUser.isEmailVerified).toBe(true);
    });

    it('should verify user phone', async () => {
      const userId = testUsers[1].id;
      const verificationData = {
        verificationType: 'phone',
        notes: 'Phone number verified'
      };

      const response = await request(app)
        .put(`/api/admin/users/${userId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(verificationData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.verificationType).toBe('phone');
    });

    it('should verify both email and phone', async () => {
      const userId = testUsers[1].id;
      const verificationData = {
        verificationType: 'both',
        notes: 'Full verification completed'
      };

      const response = await request(app)
        .put(`/api/admin/users/${userId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(verificationData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.verificationType).toBe('both');

      // Verify in database
      const updatedUser = await User.findByPk(userId);
      expect(updatedUser.isEmailVerified).toBe(true);
      expect(updatedUser.isPhoneVerified).toBe(true);
    });

    it('should handle identity verification', async () => {
      const userId = testUsers[1].id;
      const verificationData = {
        verificationType: 'identity',
        documents: ['drivers_license', 'passport'],
        notes: 'Identity documents verified'
      };

      const response = await request(app)
        .put(`/api/admin/users/${userId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(verificationData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.verificationType).toBe('identity');
    });

    it('should return 404 for non-existent user', async () => {
      const fakeUserId = '123e4567-e89b-12d3-a456-426614174000';
      
      const response = await request(app)
        .put(`/api/admin/users/${fakeUserId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ verificationType: 'email' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/users/analytics', () => {
    it('should return user analytics', async () => {
      const response = await request(app)
        .get('/api/admin/users/analytics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('trendData');
      expect(response.body.data.summary).toHaveProperty('totalUsers');
      expect(response.body.data.summary).toHaveProperty('usersByStatus');
      expect(response.body.data.summary).toHaveProperty('usersByRole');
    });

    it('should filter analytics by date range', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const endDate = new Date();

      const response = await request(app)
        .get(`/api/admin/users/analytics?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.period.start).toBeDefined();
      expect(response.body.data.summary.period.end).toBeDefined();
    });

    it('should group analytics by time period', async () => {
      const response = await request(app)
        .get('/api/admin/users/analytics?groupBy=week')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.trendData)).toBe(true);
    });

    it('should include verification statistics', async () => {
      const response = await request(app)
        .get('/api/admin/users/analytics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary).toHaveProperty('verification');
      expect(response.body.data.summary.verification).toHaveProperty('total_users');
    });

    it('should return top drivers data', async () => {
      const response = await request(app)
        .get('/api/admin/users/analytics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.topDrivers)).toBe(true);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should reject requests without authentication token', async () => {
      await request(app)
        .get('/api/admin/users')
        .expect(401);
    });

    it('should reject requests with invalid token', async () => {
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);
    });

    it('should reject non-admin user requests', async () => {
      // Create a regular user
      const regularUser = await User.create({
        email: 'regular.test@hitch.com',
        passwordHash: await bcrypt.hash('test123', 12),
        firstName: 'Regular',
        lastName: 'User',
        phoneNumber: '+1234567891',
        role: 'passenger',
        isVerified: true,
        isActive: true
      });

      // Login as regular user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'regular.test@hitch.com',
          password: 'test123'
        });

      const regularToken = loginResponse.body.data.accessToken;

      // Try to access admin endpoint
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);

      // Clean up
      await User.destroy({ where: { id: regularUser.id } });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Temporarily close database connection to simulate error
      await sequelize.close();

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();

      // Reconnect database
      await sequelize.authenticate();
    });

    it('should validate request parameters', async () => {
      const response = await request(app)
        .get('/api/admin/users?page=invalid&limit=abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200); // Should default to valid values

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.page).toBe(1); // Default value
    });

    it('should handle malformed request bodies', async () => {
      const userId = testUsers[0].id;
      
      const response = await request(app)
        .put(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Data Integrity', () => {
    it('should not expose sensitive user data', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const users = response.body.data.users;
      users.forEach(user => {
        expect(user).not.toHaveProperty('password');
        expect(user).not.toHaveProperty('passwordHash');
        expect(user).not.toHaveProperty('refreshToken');
      });
    });

    it('should maintain data consistency during updates', async () => {
      const userId = testUsers[0].id;
      const originalUser = await User.findByPk(userId);

      const updateData = {
        firstName: 'UpdatedName',
        role: 'passenger'
      };

      const response = await request(app)
        .put(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      const updatedUser = await User.findByPk(userId);
      
      // Verify changes
      expect(updatedUser.firstName).toBe('UpdatedName');
      expect(updatedUser.role).toBe('passenger');
      
      // Verify unchanged fields
      expect(updatedUser.email).toBe(originalUser.email);
      expect(updatedUser.phoneNumber).toBe(originalUser.phoneNumber);
      expect(updatedUser.passwordHash).toBe(originalUser.passwordHash);
    });

    it('should handle concurrent user modifications', async () => {
      const userId = testUsers[0].id;

      // Simulate concurrent updates
      const updatePromises = [
        request(app)
          .put(`/api/admin/users/${userId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ firstName: 'FirstUpdate' }),
        request(app)
          .put(`/api/admin/users/${userId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ lastName: 'SecondUpdate' })
      ];

      const responses = await Promise.all(updatePromises);
      
      // Both requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Verify final state
      const finalUser = await User.findByPk(userId);
      expect(finalUser.firstName).toBe('FirstUpdate');
      expect(finalUser.lastName).toBe('SecondUpdate');
    });
  });
});