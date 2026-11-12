import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp } from '../helpers.js';
import { createApp } from '../../src/app.js';
import { createAdminUserRepository } from '../../src/modules/admin-auth/repository.js';
import { createAdminUser, createLoginLimiter } from '../../src/modules/admin-auth/service.js';

const CREDENTIALS = { email: 'equipe@nucleo.local', password: 'senha-forte-1' };

describe('admin auth API', () => {
  let ctx;
  before(async () => {
    ctx = await startTestApp();
    await createAdminUser(
      createAdminUserRepository(ctx.db),
      { name: 'Equipe', ...CREDENTIALS },
      { cost: 4 },
    );
  });
  after(() => ctx.close());

  test('login with valid credentials sets a session cookie and /me returns the user', async () => {
    const client = ctx.client();
    const login = await client.post('/api/admin/login', CREDENTIALS);

    assert.equal(login.status, 200);
    assert.deepEqual(Object.keys(login.body.data).sort(), ['email', 'id', 'name']);
    const cookie = login.headers.getSetCookie().join(';');
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);

    const me = await client.get('/api/admin/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.data.email, CREDENTIALS.email);
  });

  test('login is case-insensitive on e-mail', async () => {
    const res = await ctx.client().post('/api/admin/login', { ...CREDENTIALS, email: 'EQUIPE@nucleo.local' });
    assert.equal(res.status, 200);
  });

  test('wrong password and unknown e-mail get the same 401 message', async () => {
    const wrongPassword = await ctx.client().post('/api/admin/login', { ...CREDENTIALS, password: 'errada-123' });
    const unknownEmail = await ctx.client().post('/api/admin/login', { email: 'x@nucleo.local', password: 'errada-123' });

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.equal(wrongPassword.body.error.code, 'INVALID_CREDENTIALS');
    assert.equal(wrongPassword.body.error.message, unknownEmail.body.error.message);
  });

  test('missing fields → 400', async () => {
    const res = await ctx.client().post('/api/admin/login', {});
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.email);
    assert.ok(res.body.error.fields.password);
  });

  test('every /api/admin route requires a session, even unknown ones', async () => {
    const client = ctx.client();
    for (const path of ['/api/admin/me', '/api/admin/qualquer-rota-protegida']) {
      const res = await client.get(path);
      assert.equal(res.status, 401, path);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    }
  });

  test('logged-in user gets 404 (not 401) for unknown admin routes', async () => {
    const client = ctx.client();
    await client.post('/api/admin/login', CREDENTIALS);
    const res = await client.get('/api/admin/qualquer-rota-protegida');
    assert.equal(res.status, 404);
  });

  test('logout ends the session', async () => {
    const client = ctx.client();
    await client.post('/api/admin/login', CREDENTIALS);
    const logout = await client.post('/api/admin/logout');
    assert.equal(logout.status, 204);
    assert.equal((await client.get('/api/admin/me')).status, 401);
  });

  test('session id changes on login (no session fixation)', async () => {
    const client = ctx.client();
    await client.post('/api/admin/login', CREDENTIALS);
    const first = client.cookies.get('nmj.sid');
    await client.post('/api/admin/login', CREDENTIALS);
    assert.notEqual(client.cookies.get('nmj.sid'), first);
  });

  test('responses never include the password hash', async () => {
    const client = ctx.client();
    const login = await client.post('/api/admin/login', CREDENTIALS);
    const me = await client.get('/api/admin/me');
    assert.doesNotMatch(login.text + me.text, /\$2[aby]\$|password/i);
  });
});

describe('login rate limit', () => {
  let ctx;
  beforeEach(async () => {
    ctx?.close();
    ctx = await startTestApp();
    await createAdminUser(createAdminUserRepository(ctx.db), { name: 'Equipe', ...CREDENTIALS }, { cost: 4 });
  });
  after(() => ctx.close());

  test('6th attempt after 5 failures in the window → 429, even with the right password', async () => {
    const client = ctx.client();
    for (let i = 0; i < 5; i += 1) {
      const res = await client.post('/api/admin/login', { ...CREDENTIALS, password: 'errada-123' });
      assert.equal(res.status, 401);
    }
    const blocked = await client.post('/api/admin/login', CREDENTIALS);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.error.code, 'TOO_MANY_ATTEMPTS');
  });

  test('a successful login resets the failure count', async () => {
    const client = ctx.client();
    for (let i = 0; i < 4; i += 1) await client.post('/api/admin/login', { ...CREDENTIALS, password: 'errada-123' });
    assert.equal((await client.post('/api/admin/login', CREDENTIALS)).status, 200);
    for (let i = 0; i < 4; i += 1) await client.post('/api/admin/login', { ...CREDENTIALS, password: 'errada-123' });
    assert.equal((await client.post('/api/admin/login', CREDENTIALS)).status, 200);
  });
});

describe('createLoginLimiter', () => {
  test('blocks after max failures and unblocks when the window passes', () => {
    let now = 0;
    const limiter = createLoginLimiter({ max: 5, windowMs: 15 * 60_000, now: () => now });
    for (let i = 0; i < 5; i += 1) limiter.fail('k');
    assert.equal(limiter.isBlocked('k'), true);
    assert.equal(limiter.isBlocked('other'), false);

    now = 15 * 60_000 + 1;
    assert.equal(limiter.isBlocked('k'), false);
  });
});

describe('configuration', () => {
  test('createApp refuses to start without a session secret', () => {
    assert.throws(() => createApp({ dbPath: ':memory:', sessionSecret: '' }), /SESSION_SECRET/);
  });
});
