import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { startTestApp } from '../helpers.js';

describe('activities — categories & instructors (admin)', () => {
  let app;

  before(async () => {
    app = await startTestApp();
    const hash = await bcrypt.hash('senha1234', 4);
    app.db
      .prepare('INSERT INTO admin_users (name, email, password_hash) VALUES (?, ?, ?)')
      .run('Admin', 'admin@nucleo.local', hash);
  });

  after(async () => {
    await app.close();
  });

  async function loginCookie() {
    const res = await fetch(`${app.baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@nucleo.local', password: 'senha1234' }),
    });
    assert.equal(res.status, 200);
    return res.headers.get('set-cookie');
  }

  it('bloqueia rotas /api/admin/categories e /api/admin/instructors sem sessão (401)', async () => {
    const endpoints = [
      ['GET', '/api/admin/categories'],
      ['POST', '/api/admin/categories'],
      ['PUT', '/api/admin/categories/1'],
      ['GET', '/api/admin/instructors'],
      ['POST', '/api/admin/instructors'],
      ['GET', '/api/admin/instructors/1'],
      ['PUT', '/api/admin/instructors/1'],
    ];

    for (const [method, path] of endpoints) {
      const res = await fetch(`${app.baseUrl}${path}`, {
        method,
        headers: { 'content-type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify({}),
      });
      assert.equal(res.status, 401, `${method} ${path} deveria retornar 401`);
    }
  });

  it('cria, edita e lista categorias, rejeitando nome duplicado com 409', async () => {
    const cookie = await loginCookie();
    const headers = { 'content-type': 'application/json', cookie };

    const createRes = await fetch(`${app.baseUrl}/api/admin/categories`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Música' }),
    });
    assert.equal(createRes.status, 201);
    const { data: created } = await createRes.json();
    assert.equal(created.name, 'Música');

    // Duplicada (case-insensitive) -> 409
    const dupRes = await fetch(`${app.baseUrl}/api/admin/categories`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'música' }),
    });
    assert.equal(dupRes.status, 409);

    // Editar -> 200
    const editRes = await fetch(`${app.baseUrl}/api/admin/categories/${created.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ name: 'Música Popular' }),
    });
    assert.equal(editRes.status, 200);
    const { data: updated } = await editRes.json();
    assert.equal(updated.name, 'Música Popular');

    // Rota pública GET /api/categories
    const publicRes = await fetch(`${app.baseUrl}/api/categories`);
    assert.equal(publicRes.status, 200);
    const { data: list } = await publicRes.json();
    assert.equal(list.length, 1);
    assert.equal(list[0].name, 'Música Popular');
  });

  it('cria, edita, lista e desativa instrutor (active = false), sem DELETE', async () => {
    const cookie = await loginCookie();
    const headers = { 'content-type': 'application/json', cookie };

    const createRes = await fetch(`${app.baseUrl}/api/admin/instructors`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Maria Silva',
        bio: 'Violonista e educadora musical.',
        phone: '(88) 99999-1234',
        email: 'maria@nucleo.local',
      }),
    });
    assert.equal(createRes.status, 201);
    const { data: created } = await createRes.json();
    assert.equal(created.name, 'Maria Silva');
    assert.equal(created.phone, '88999991234');
    assert.equal(created.active, true);

    // Desativar via PUT
    const deactivateRes = await fetch(`${app.baseUrl}/api/admin/instructors/${created.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        name: 'Maria Silva',
        bio: 'Violonista e educadora musical.',
        phone: '(88) 99999-1234',
        email: 'maria@nucleo.local',
        active: false,
      }),
    });
    assert.equal(deactivateRes.status, 200);
    const { data: deactivated } = await deactivateRes.json();
    assert.equal(deactivated.active, false);

    // Sem DELETE físico
    const delRes = await fetch(`${app.baseUrl}/api/admin/instructors/${created.id}`, {
      method: 'DELETE',
      headers,
    });
    assert.equal(delRes.status, 404);
  });
});