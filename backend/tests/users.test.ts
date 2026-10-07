import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { cleanupTestUsers, createTestUser } from './test.helper';

describe('Users Module Integration Tests', () => {
  let user1: any;
  let user2: any;

  beforeAll(async () => {
    await cleanupTestUsers();
    user1 = await createTestUser('test_u1');
    user2 = await createTestUser('test_u2');
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  it('1. GET /api/v1/users/me returns logged in user profile', async () => {
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', user1.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.id).toBe(user1.user.id);
    expect(res.body.data.user.email).toBe(user1.user.email);
    expect(res.body.data.user.hasPassword).toBe(true);
    expect(res.body.data.user.authProvider).toBe('local');
  });

  it('2. PATCH /api/v1/users/me updates profile fields', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', user1.authHeader)
      .send({
        name: 'Updated Name',
        bio: 'Hello, this is my new bio',
        statusMessage: 'Available',
        themePreference: 'dark',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('Updated Name');
    expect(res.body.data.user.bio).toBe('Hello, this is my new bio');
    expect(res.body.data.user.statusMessage).toBe('Available');
    expect(res.body.data.user.themePreference).toBe('dark');
  });

  it('3. GET /api/v1/users/search returns matches with relationship status and excludes existing conversations', async () => {
    const user3 = await createTestUser('test_search3');

    // Before conversation: user3 is found
    const resBefore = await request(app)
      .get(`/api/v1/users/search?q=${user3.user.username}`)
      .set('Authorization', user1.authHeader);

    expect(resBefore.status).toBe(200);
    const matchBefore = resBefore.body.data.users.find((u: any) => u.id === user3.user.id);
    expect(matchBefore).toBeDefined();

    // Create a pending conversation between user1 and user3
    await request(app)
      .post('/api/v1/conversations')
      .set('Authorization', user1.authHeader)
      .send({ recipientId: user3.user.id, message: 'Hello user3' });

    // After conversation: user3 is excluded in BOTH directions
    const resAfter1 = await request(app)
      .get(`/api/v1/users/search?q=${user3.user.username}`)
      .set('Authorization', user1.authHeader);
    expect(resAfter1.status).toBe(200);
    const matchAfter1 = resAfter1.body.data.users.find((u: any) => u.id === user3.user.id);
    expect(matchAfter1).toBeUndefined();

    const resAfter2 = await request(app)
      .get(`/api/v1/users/search?q=${user1.user.username}`)
      .set('Authorization', user3.authHeader);
    expect(resAfter2.status).toBe(200);
    const matchAfter2 = resAfter2.body.data.users.find((u: any) => u.id === user1.user.id);
    expect(matchAfter2).toBeUndefined();
  });

  it('4. DELETE /api/v1/users/me/avatar clears avatar', async () => {
    const res = await request(app)
      .delete('/api/v1/users/me/avatar')
      .set('Authorization', user1.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.user.avatarUrl).toBeNull();
  });

  it('5. POST /api/v1/users/me/avatar rejects non-image files with 400', async () => {
    const res = await request(app)
      .post('/api/v1/users/me/avatar')
      .set('Authorization', user1.authHeader)
      .attach('file', Buffer.from('hello text'), { filename: 'test.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
  });

  it('6. POST /api/v1/users/me/avatar rejects file > 10MB with 413', async () => {
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
    const res = await request(app)
      .post('/api/v1/users/me/avatar')
      .set('Authorization', user1.authHeader)
      .attach('file', largeBuffer, { filename: 'big.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Photo must be smaller than 10 MB');
  });

  it('7. POST /api/v1/uploads/image rejects file > 5MB with 413', async () => {
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
    const res = await request(app)
      .post('/api/v1/uploads/image')
      .set('Authorization', user1.authHeader)
      .attach('file', largeBuffer, { filename: 'attachment.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('File must be smaller than 5 MB');
  });

  it('8. GET /api/v1/users/:id suppresses presence unless conversation is accepted', async () => {
    // user1 and user2 have NO accepted conversation -> presence suppressed
    const resSuppressed = await request(app)
      .get(`/api/v1/users/${user2.user.id}`)
      .set('Authorization', user1.authHeader);

    expect(resSuppressed.status).toBe(200);
    expect(resSuppressed.body.success).toBe(true);
    expect(resSuppressed.body.data.user.id).toBe(user2.user.id);
    expect(resSuppressed.body.data.user.isOnline).toBe(false);
    expect(resSuppressed.body.data.user.lastSeen).toBeNull();
  });
});
