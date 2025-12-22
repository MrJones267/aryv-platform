/**
 * @fileoverview Integration tests for complete admin user management flow
 * @author Oabona-Majoko
 * @created 2025-01-25
 */

const request = require('supertest');
const { app } = require('../../src/app');
const { sequelize } = require('../../src/config/database');
const User = require('../../src/models/User');
const bcrypt = require('bcryptjs');

describe('Admin User Management Flow Integration Tests', () => {
  let adminToken;
  let adminUser;
  let testDriver;
  let testPassenger;

  beforeAll(async () => {
    // Ensure database connection
    await sequelize.authenticate();
    
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 12);
    adminUser = await User.create({
      email: 'flow.admin@hitch.com',
      passwordHash: hashedPassword,
      firstName: 'Flow',
      lastName: 'Admin',
      phoneNumber: '+1234567890',
      role: 'admin',
      isVerified: true,
      isActive: true
    });

    // Login as admin
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'flow.admin@hitch.com',
        password: 'admin123'
      });

    adminToken = loginResponse.body.data.accessToken;

    // Create test users for flow testing
    testDriver = await User.create({
      email: 'flow.driver@hitch.com',
      passwordHash: await bcrypt.hash('test123', 12),
      firstName: 'Flow',
      lastName: 'Driver',
      phoneNumber: '+1234567801',
      role: 'driver',
      isVerified: false,
      isActive: true
    });

    testPassenger = await User.create({
      email: 'flow.passenger@hitch.com',
      passwordHash: await bcrypt.hash('test123', 12),
      firstName: 'Flow',
      lastName: 'Passenger',
      phoneNumber: '+1234567802',
      role: 'passenger',
      isVerified: true,
      isActive: true
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (adminUser) await User.destroy({ where: { id: adminUser.id } });
    if (testDriver) await User.destroy({ where: { id: testDriver.id } });
    if (testPassenger) await User.destroy({ where: { id: testPassenger.id } });
    
    await sequelize.close();
  });

  describe('Complete User Management Workflow', () => {
    it('should complete full user verification workflow', async () => {
      // Step 1: Get user details (unverified driver)
      const getUserResponse = await request(app)
        .get(`/api/admin/users/${testDriver.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(getUserResponse.body.data.user.isEmailVerified).toBe(false);
      expect(getUserResponse.body.data.user.isPhoneVerified).toBe(false);

      // Step 2: Verify user email
      const verifyEmailResponse = await request(app)
        .put(`/api/admin/users/${testDriver.id}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          verificationType: 'email',
          notes: 'Manual email verification completed'
        })
        .expect(200);

      expect(verifyEmailResponse.body.success).toBe(true);

      // Step 3: Verify user phone
      const verifyPhoneResponse = await request(app)
        .put(`/api/admin/users/${testDriver.id}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          verificationType: 'phone',
          notes: 'Phone verification completed'
        })
        .expect(200);

      expect(verifyPhoneResponse.body.success).toBe(true);

      // Step 4: Get updated user details
      const updatedUserResponse = await request(app)
        .get(`/api/admin/users/${testDriver.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(updatedUserResponse.body.data.user.isEmailVerified).toBe(true);
      expect(updatedUserResponse.body.data.user.isPhoneVerified).toBe(true);

      // Step 5: Update user role
      const updateUserResponse = await request(app)
        .put(`/api/admin/users/${testDriver.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'driver',
          firstName: 'Verified',
          lastName: 'Driver'
        })
        .expect(200);

      expect(updateUserResponse.body.data.user.firstName).toBe('Verified');
      expect(updateUserResponse.body.data.user.lastName).toBe('Driver');

      // Step 6: Verify user appears in analytics
      const analyticsResponse = await request(app)
        .get('/api/admin/users/analytics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(analyticsResponse.body.data.summary.usersByRole.driver).toBeGreaterThan(0);
    });

    it('should complete user suspension and restoration workflow', async () => {
      // Step 1: Check user is active
      const initialUserResponse = await request(app)
        .get(`/api/admin/users/${testPassenger.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(initialUserResponse.body.data.user.status).toBe('active');

      // Step 2: Block user with reason
      const blockResponse = await request(app)
        .post(`/api/admin/users/${testPassenger.id}/block`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Integration test suspension for policy violation'
        })
        .expect(200);

      expect(blockResponse.body.success).toBe(true);
      expect(blockResponse.body.data.newStatus).toBe('suspended');

      // Step 3: Verify user is blocked in system
      const blockedUserResponse = await request(app)
        .get(`/api/admin/users/${testPassenger.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(blockedUserResponse.body.data.user.status).toBe('suspended');

      // Step 4: Attempt to block already blocked user (should fail)
      const doubleBlockResponse = await request(app)
        .post(`/api/admin/users/${testPassenger.id}/block`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Attempt to block again'
        })
        .expect(400);

      expect(doubleBlockResponse.body.success).toBe(false);
      expect(doubleBlockResponse.body.error).toBe('User is already blocked');

      // Step 5: Unblock user
      const unblockResponse = await request(app)
        .post(`/api/admin/users/${testPassenger.id}/unblock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Issue resolved, restoring access'
        })
        .expect(200);

      expect(unblockResponse.body.success).toBe(true);
      expect(unblockResponse.body.data.newStatus).toBe('active');

      // Step 6: Verify user is active again
      const restoredUserResponse = await request(app)
        .get(`/api/admin/users/${testPassenger.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(restoredUserResponse.body.data.user.status).toBe('active');

      // Step 7: Verify analytics reflect status changes
      const finalAnalyticsResponse = await request(app)
        .get('/api/admin/users/analytics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(finalAnalyticsResponse.body.data.summary.usersByStatus.active).toBeGreaterThan(0);
    });

    it('should handle complex user search and filtering workflow', async () => {
      // Step 1: Search for users by name
      const nameSearchResponse = await request(app)
        .get('/api/admin/users?search=Flow')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(nameSearchResponse.body.data.users.length).toBeGreaterThan(0);
      expect(nameSearchResponse.body.data.users.every(user => 
        user.firstName.includes('Flow') || 
        user.lastName.includes('Flow') ||
        user.email.includes('flow')
      )).toBe(true);

      // Step 2: Filter by role
      const driverFilterResponse = await request(app)
        .get('/api/admin/users?role=driver')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(driverFilterResponse.body.data.users.every(user => user.role === 'driver')).toBe(true);

      // Step 3: Filter by verification status
      const verifiedFilterResponse = await request(app)
        .get('/api/admin/users?verified=true')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(verifiedFilterResponse.body.data.users.every(user => user.isEmailVerified === true)).toBe(true);

      // Step 4: Combine filters
      const combinedFilterResponse = await request(app)
        .get('/api/admin/users?role=passenger&verified=true&search=flow')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const users = combinedFilterResponse.body.data.users;
      expect(users.every(user => 
        user.role === 'passenger' && 
        user.isEmailVerified === true &&
        (user.firstName.toLowerCase().includes('flow') || 
         user.lastName.toLowerCase().includes('flow') ||
         user.email.toLowerCase().includes('flow'))
      )).toBe(true);

      // Step 5: Test pagination
      const paginatedResponse = await request(app)
        .get('/api/admin/users?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(paginatedResponse.body.data.pagination.page).toBe(1);
      expect(paginatedResponse.body.data.pagination.limit).toBe(2);
      expect(paginatedResponse.body.data.users.length).toBeLessThanOrEqual(2);

      // Step 6: Test sorting
      const sortedResponse = await request(app)
        .get('/api/admin/users?sortBy=firstName&sortOrder=ASC')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const sortedUsers = sortedResponse.body.data.users;
      if (sortedUsers.length > 1) {
        expect(sortedUsers[0].firstName <= sortedUsers[1].firstName).toBe(true);
      }
    });

    it('should provide comprehensive analytics across the workflow', async () => {
      // Step 1: Get initial analytics
      const initialAnalytics = await request(app)
        .get('/api/admin/users/analytics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(initialAnalytics.body.data.summary).toHaveProperty('totalUsers');
      expect(initialAnalytics.body.data.summary).toHaveProperty('usersByStatus');
      expect(initialAnalytics.body.data.summary).toHaveProperty('usersByRole');
      expect(initialAnalytics.body.data.summary).toHaveProperty('verification');

      // Step 2: Test date range filtering
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const dateFilteredAnalytics = await request(app)
        .get(`/api/admin/users/analytics?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(dateFilteredAnalytics.body.data.summary.period.start).toBeDefined();
      expect(dateFilteredAnalytics.body.data.summary.period.end).toBeDefined();

      // Step 3: Test groupBy parameter
      const weeklyAnalytics = await request(app)
        .get('/api/admin/users/analytics?groupBy=week')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(weeklyAnalytics.body.data.trendData)).toBe(true);

      // Step 4: Verify analytics structure
      const analytics = initialAnalytics.body.data;
      expect(analytics.summary.usersByStatus).toBeInstanceOf(Object);
      expect(analytics.summary.usersByRole).toBeInstanceOf(Object);
      expect(analytics.summary.verification).toHaveProperty('total_users');
      expect(Array.isArray(analytics.trendData)).toBe(true);
      expect(Array.isArray(analytics.topDrivers)).toBe(true);
    });

    it('should maintain data integrity throughout the workflow', async () => {
      // Step 1: Get initial user counts
      const initialUsers = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const initialCount = initialUsers.body.data.pagination.total;

      // Step 2: Perform multiple operations on the same user
      const userId = testDriver.id;

      // Update user information
      await request(app)
        .put(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Updated',
          lastName: 'Name'
        })
        .expect(200);

      // Verify user
      await request(app)
        .put(`/api/admin/users/${userId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          verificationType: 'both'
        })
        .expect(200);

      // Block user
      await request(app)
        .post(`/api/admin/users/${userId}/block`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Data integrity test'
        })
        .expect(200);

      // Unblock user
      await request(app)
        .post(`/api/admin/users/${userId}/unblock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Test completed'
        })
        .expect(200);

      // Step 3: Verify final user state
      const finalUser = await request(app)
        .get(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(finalUser.body.data.user.firstName).toBe('Updated');
      expect(finalUser.body.data.user.lastName).toBe('Name');
      expect(finalUser.body.data.user.isEmailVerified).toBe(true);
      expect(finalUser.body.data.user.isPhoneVerified).toBe(true);
      expect(finalUser.body.data.user.status).toBe('active');

      // Step 4: Verify user count remains the same
      const finalUsers = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(finalUsers.body.data.pagination.total).toBe(initialCount);

      // Step 5: Verify no sensitive data is exposed
      const allUsers = finalUsers.body.data.users;
      allUsers.forEach(user => {
        expect(user).not.toHaveProperty('password');
        expect(user).not.toHaveProperty('passwordHash');
        expect(user).not.toHaveProperty('refreshToken');
      });
    });

    it('should handle concurrent operations gracefully', async () => {
      const userId = testPassenger.id;

      // Perform concurrent operations
      const concurrentPromises = [
        request(app)
          .get(`/api/admin/users/${userId}`)
          .set('Authorization', `Bearer ${adminToken}`),
        request(app)
          .put(`/api/admin/users/${userId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ firstName: 'Concurrent1' }),
        request(app)
          .put(`/api/admin/users/${userId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ lastName: 'Concurrent2' }),
        request(app)
          .get('/api/admin/users/analytics')
          .set('Authorization', `Bearer ${adminToken}`)
      ];

      const results = await Promise.all(concurrentPromises);

      // All operations should succeed
      results.forEach((result, index) => {
        expect(result.status).toBe(200);
        expect(result.body.success).toBe(true);
      });

      // Verify final state
      const finalUser = await request(app)
        .get(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Should have at least one of the concurrent updates
      expect(
        finalUser.body.data.user.firstName === 'Concurrent1' ||
        finalUser.body.data.user.lastName === 'Concurrent2'
      ).toBe(true);
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle invalid user IDs gracefully', async () => {
      const invalidId = '123e4567-e89b-12d3-a456-426614174000';

      // Test all endpoints with invalid ID
      const endpoints = [
        { method: 'get', path: `/api/admin/users/${invalidId}` },
        { method: 'put', path: `/api/admin/users/${invalidId}`, body: { firstName: 'Test' } },
        { method: 'post', path: `/api/admin/users/${invalidId}/block`, body: { reason: 'Test' } },
        { method: 'post', path: `/api/admin/users/${invalidId}/unblock`, body: { reason: 'Test' } },
        { method: 'put', path: `/api/admin/users/${invalidId}/verify`, body: { verificationType: 'email' } }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(endpoint.body || {})
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('not found');
      }
    });

    it('should validate request parameters properly', async () => {
      // Test invalid pagination parameters
      const invalidPaginationResponse = await request(app)
        .get('/api/admin/users?page=-1&limit=abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200); // Should use defaults

      expect(invalidPaginationResponse.body.data.pagination.page).toBe(1);
      expect(invalidPaginationResponse.body.data.pagination.limit).toBe(20);

      // Test invalid role update
      const invalidRoleResponse = await request(app)
        .put(`/api/admin/users/${testDriver.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'invalid_role' })
        .expect(400);

      expect(invalidRoleResponse.body.success).toBe(false);
      expect(invalidRoleResponse.body.error).toBe('Invalid user role');
    });

    it('should maintain transaction integrity on failures', async () => {
      const userId = testDriver.id;

      // Get initial user state
      const initialUser = await request(app)
        .get(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const initialFirstName = initialUser.body.data.user.firstName;

      // Attempt update with invalid data (should fail)
      const failedUpdate = await request(app)
        .put(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Valid',
          role: 'invalid_role' // This should cause failure
        })
        .expect(400);

      expect(failedUpdate.body.success).toBe(false);

      // Verify user state hasn't changed
      const unchangedUser = await request(app)
        .get(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(unchangedUser.body.data.user.firstName).toBe(initialFirstName);
    });
  });
});