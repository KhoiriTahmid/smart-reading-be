/**
 * Integration / E2E Tests for the Live Smart Reading Device Backend.
 *
 * Runs against the active NestJS backend service (http://127.0.0.1:3001)
 * and tests:
 * 1. Authentication (login, tokens, permissions)
 * 2. Role-based access control (Admin vs User permissions)
 * 3. Dashboard API
 * 4. Reading History CRUD & detail endpoints
 * 5. Users and Roles management
 */

import * as request from 'supertest';

const BASE_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3001';

describe('Smart Reading Device - Live Backend Integration', () => {
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    // 1. Authenticate as Admin
    const adminRes = await request(BASE_URL)
      .post('/auth/signin-by-email?isRedirect=false')
      .send({ email: 'admin@gmail.com', password: 'password' });

    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.payload.access_token;
    expect(adminToken).toBeDefined();

    // 2. Authenticate as Standard User
    const userRes = await request(BASE_URL)
      .post('/auth/signin-by-email?isRedirect=false')
      .send({ email: 'user@gmail.com', password: 'password' });

    expect(userRes.status).toBe(200);
    userToken = userRes.body.payload.access_token;
    expect(userToken).toBeDefined();
  });

  describe('1. Authentication & Profile', () => {
    it('GET /auth/me returns current admin profile and role permissions', async () => {
      const res = await request(BASE_URL)
        .get('/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.payload).toMatchObject({
        email: 'admin@gmail.com',
        role: expect.objectContaining({
          permissions: { FULL_ACCESS: true },
        }),
      });
    });

    it('rejects unauthenticated requests to protected endpoints with 401', async () => {
      const res = await request(BASE_URL).get('/auth/me');
      expect(res.status).toBe(401);
    });

    it('rejects bad password with 401', async () => {
      const res = await request(BASE_URL)
        .post('/auth/signin-by-email?isRedirect=false')
        .send({ email: 'admin@gmail.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
    });
  });

  describe('2. Dashboard API', () => {
    it('GET /dashboard returns health summary and active queue task count', async () => {
      const res = await request(BASE_URL)
        .get('/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.payload).toHaveProperty('backend');
      expect(res.body.payload.backend).toHaveProperty('healthy', true);
      expect(res.body.payload).toHaveProperty('queueTasks');
    });

    it('GET /dashboard is accessible to standard users with DASHBOARD permission', async () => {
      const res = await request(BASE_URL)
        .get('/dashboard')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('3. Roles & Permissions Security Guard', () => {
    it('GET /roles is allowed for Admin', async () => {
      const res = await request(BASE_URL)
        .get('/roles')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.payload.results.length).toBeGreaterThanOrEqual(2);
    });

    it('GET /roles is denied (403) for Standard User who has no ROLE permissions', async () => {
      const res = await request(BASE_URL)
        .get('/roles')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('4. Users Management Security Guard', () => {
    it('GET /users is allowed for Admin', async () => {
      const res = await request(BASE_URL)
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.payload.results.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /users is denied (403) for Standard User', async () => {
      const res = await request(BASE_URL)
        .get('/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('5. Reading Histories Integration', () => {
    it('GET /reading-histories returns paginated history list', async () => {
      const res = await request(BASE_URL)
        .get('/reading-histories?limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.payload).toHaveProperty('results');
      expect(Array.isArray(res.body.payload.results)).toBe(true);
    });

    it('Standard user can also query /reading-histories', async () => {
      const res = await request(BASE_URL)
        .get('/reading-histories?limit=5')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
    });
  });
});
