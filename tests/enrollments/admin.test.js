import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { startTestApp } from '../helpers.js';
import { addDays, todayInFortaleza } from '../../src/lib/dates.js';

describe('enrollments & participants — admin API', () => {
  let app;
  let categoryId;

  before(async () => {
    app = await startTestApp();
    const hash = await bcrypt.hash('senha1234', 4);
    app.db
      .prepare('INSERT INTO admin_users (name, email, password_hash) VALUES (?, ?, ?)')
      .run('Admin', 'admin@nucleo.local', hash);

    categoryId = Number(app.db.prepare('INSERT INTO categories (name) VALUES (?)').run('Teatro').lastInsertRowid);
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

  function insertActivity({ title = 'Oficina Admin', capacity = 2 } = {}) {
    const today = todayInFortaleza();
    const res = app.db
      .prepare(
        `INSERT INTO activities (title, type, category_id, start_date, end_date, capacity, status)
         VALUES (?, 'workshop', ?, ?, ?, ?, 'published')`,
      )
      .run(title, categoryId, addDays(today, 2), addDays(today, 15), capacity);
    const id = Number(res.lastInsertRowid);
    app.db
      .prepare('INSERT INTO activity_schedules (activity_id, weekday, start_time, end_time) VALUES (?, 3, ?, ?)')
      .run(id, '14:00', '16:00');
    return id;
  }

  it('bloqueia todas as rotas /api/admin/enrollments* e /api/admin/participants* sem sessão (401)', async () => {
    const endpoints = [
      ['GET', '/api/admin/enrollments'],
      ['POST', '/api/admin/enrollments/1/status'],
      ['POST', '/api/admin/activities/1/enrollments'],
      ['GET', '/api/admin/participants'],
      ['GET', '/api/admin/participants/1'],
      ['PUT', '/api/admin/participants/1'],
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

  it('confirma, cancela (devolvendo vaga ao catálogo e permitindo recadastro) e bloqueia reabertura (409)', async () => {
    const cookie = await loginCookie();
    const headers = { 'content-type': 'application/json', cookie };
    const activityId = insertActivity({ title: 'Turma Única', capacity: 1 });

    // 1. Pré-inscrição pública esgota a única vaga
    const pubRes = await fetch(`${app.baseUrl}/api/activities/${activityId}/enrollments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Fernanda Lima',
        phone: '(88) 99111-2233',
        birthDate: '1996-09-12',
        consent: true,
      }),
    });
    assert.equal(pubRes.status, 201);

    const soldOutCheck = await (await fetch(`${app.baseUrl}/api/activities/${activityId}`)).json();
    assert.equal(soldOutCheck.data.soldOut, true);
    assert.equal(soldOutCheck.data.seatsAvailable, 0);

    // 2. Listar inscrições no admin
    const listRes = await fetch(`${app.baseUrl}/api/admin/enrollments?activity=${activityId}`, {
      headers: { cookie },
    });
    assert.equal(listRes.status, 200);
    const { data: list } = await listRes.json();
    assert.equal(list.length, 1);
    assert.equal(list[0].status, 'pending');
    assert.equal(list[0].participant.name, 'Fernanda Lima');
    const enrollmentId = list[0].id;

    // 3. Confirmar inscrição -> confirmed
    const confirmRes = await fetch(`${app.baseUrl}/api/admin/enrollments/${enrollmentId}/status`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ status: 'confirmed' }),
    });
    assert.equal(confirmRes.status, 200);
    const { data: confirmed } = await confirmRes.json();
    assert.equal(confirmed.status, 'confirmed');

    // 4. Cancelar inscrição -> cancelled e vaga volta ao catálogo (Critério 8)
    const cancelRes = await fetch(`${app.baseUrl}/api/admin/enrollments/${enrollmentId}/status`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ status: 'cancelled' }),
    });
    assert.equal(cancelRes.status, 200);
    const { data: cancelled } = await cancelRes.json();
    assert.equal(cancelled.status, 'cancelled');

    const availableCheck = await (await fetch(`${app.baseUrl}/api/activities/${activityId}`)).json();
    assert.equal(availableCheck.data.soldOut, false);
    assert.equal(availableCheck.data.seatsAvailable, 1);

    // 5. Tentar reabrir cancelada -> 409
    const reopenRes = await fetch(`${app.baseUrl}/api/admin/enrollments/${enrollmentId}/status`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ status: 'confirmed' }),
    });
    assert.equal(reopenRes.status, 409);

    // 6. Mesma pessoa consegue se inscrever novamente após cancelamento (Critério 4)
    const reEnrollRes = await fetch(`${app.baseUrl}/api/activities/${activityId}/enrollments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Fernanda Lima',
        phone: '(88) 99111-2233',
        birthDate: '1996-09-12',
        consent: true,
      }),
    });
    assert.equal(reEnrollRes.status, 201);
  });

  it('realiza inscrição presencial já confirmada e lista/edita participantes com histórico', async () => {
    const cookie = await loginCookie();
    const headers = { 'content-type': 'application/json', cookie };
    const activityId = insertActivity({ title: 'Oficina Presencial', capacity: 5 });

    // Inscrição presencial pelo admin
    const walkInRes = await fetch(`${app.baseUrl}/api/admin/activities/${activityId}/enrollments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Roberto Carlos',
        phone: '(88) 99222-3344',
        email: 'roberto@exemplo.com',
        birthDate: '1985-04-19',
      }),
    });
    assert.equal(walkInRes.status, 201);
    const { data: walkIn } = await walkInRes.json();
    assert.equal(walkIn.status, 'confirmed');

    // Listar participantes
    const partsRes = await fetch(`${app.baseUrl}/api/admin/participants?q=Roberto`, {
      headers: { cookie },
    });
    assert.equal(partsRes.status, 200);
    const { data: parts } = await partsRes.json();
    assert.equal(parts.length, 1);
    const participantId = parts[0].id;

    // Detalhe do participante com histórico
    const detailRes = await fetch(`${app.baseUrl}/api/admin/participants/${participantId}`, {
      headers: { cookie },
    });
    assert.equal(detailRes.status, 200);
    const { data: detail } = await detailRes.json();
    assert.equal(detail.enrollments.length, 1);
    assert.equal(detail.enrollments[0].protocol, walkIn.protocol);

    // Editar participante
    const editRes = await fetch(`${app.baseUrl}/api/admin/participants/${participantId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        name: 'Roberto Carlos Silva',
        phone: '(88) 99222-9999',
        email: 'roberto.silva@exemplo.com',
        birthDate: '1985-04-19',
      }),
    });
    assert.equal(editRes.status, 200);
    const { data: edited } = await editRes.json();
    assert.equal(edited.name, 'Roberto Carlos Silva');
    assert.equal(edited.phone, '88992229999');
  });
});