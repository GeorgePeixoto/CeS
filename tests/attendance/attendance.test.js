import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { startTestApp } from '../helpers.js';
import { addDays, todayInFortaleza, weekdayOf } from '../../src/lib/dates.js';
import { listSessionDates } from '../../src/modules/attendance/sessions.js';

describe('attendance — sessions & roll call API', () => {
  let app;
  let categoryId;

  before(async () => {
    app = await startTestApp();
    const hash = await bcrypt.hash('senha1234', 4);
    app.db
      .prepare('INSERT INTO admin_users (name, email, password_hash) VALUES (?, ?, ?)')
      .run('Admin', 'admin@nucleo.local', hash);

    categoryId = Number(app.db.prepare('INSERT INTO categories (name) VALUES (?)').run('Dança').lastInsertRowid);
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

  function createActivityWithSchedules({ title, startDate, endDate, weekdays, capacity = 10 }) {
    const res = app.db
      .prepare(
        `INSERT INTO activities (title, type, category_id, start_date, end_date, capacity, status)
         VALUES (?, 'course', ?, ?, ?, ?, 'published')`,
      )
      .run(title, categoryId, startDate, endDate, capacity);
    const activityId = Number(res.lastInsertRowid);

    const insSched = app.db.prepare(
      'INSERT INTO activity_schedules (activity_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)',
    );
    for (const wd of weekdays) {
      insSched.run(activityId, wd, '14:00', '16:00');
    }
    return activityId;
  }

  function createEnrollment({ activityId, name, phone, status = 'confirmed' }) {
    const part = app.db
      .prepare("INSERT INTO participants (name, phone, birth_date) VALUES (?, ?, '1995-01-01')")
      .run(name, phone);
    const participantId = Number(part.lastInsertRowid);

    const protocol = `NMJ-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const enr = app.db
      .prepare(
        `INSERT INTO enrollments (activity_id, participant_id, protocol, status, consent_at)
         VALUES (?, ?, ?, ?, '2026-11-01T10:00:00.000Z')`,
      )
      .run(activityId, participantId, protocol, status);
    return Number(enr.lastInsertRowid);
  }

  it('listSessionDates devolve exatamente as terças e quintas entre 01/11 e 15/11 (Critério 1)', () => {
    // Novembro de 2026: dia 1 = domingo; terças = 3, 10; quintas = 5, 12
    const dates = listSessionDates({
      startDate: '2026-11-01',
      endDate: '2026-11-15',
      schedules: [
        { weekday: 2, startTime: '14:00', endTime: '16:00' },
        { weekday: 4, startTime: '14:00', endTime: '16:00' },
      ],
    });

    assert.deepEqual(dates, ['2026-11-03', '2026-11-05', '2026-11-10', '2026-11-12']);
  });

  it('bloqueia todas as rotas /api/admin/activities/:id/sessions e attendance sem sessão (401 - Critério 6)', async () => {
    const endpoints = [
      ['GET', '/api/admin/activities/1/sessions'],
      ['GET', '/api/admin/activities/1/attendance?date=2026-11-03'],
      ['PUT', '/api/admin/activities/1/attendance?date=2026-11-03'],
    ];

    for (const [method, path] of endpoints) {
      const res = await fetch(`${app.baseUrl}${path}`, {
        method,
        headers: { 'content-type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify({ records: [] }),
      });
      assert.equal(res.status, 401, `${method} ${path} deveria retornar 401`);
    }
  });

  it('salva chamada (3 presentes, 1 ausente), sobrescreve sem duplicar e oculta cancelados nas próximas chamadas (Critérios 2 e 5)', async () => {
    const cookie = await loginCookie();
    const headers = { 'content-type': 'application/json', cookie };

    const today = todayInFortaleza();
    const pastDate1 = addDays(today, -7);
    const pastDate2 = addDays(today, -1);
    const weekdays = [...new Set([weekdayOf(pastDate1), weekdayOf(pastDate2)])];

    const activityId = createActivityWithSchedules({
      title: 'Dança Contemporânea',
      startDate: pastDate1,
      endDate: today,
      weekdays,
    });

    const e1 = createEnrollment({ activityId, name: 'Ana', phone: '88999000001', status: 'confirmed' });
    const e2 = createEnrollment({ activityId, name: 'Bruno', phone: '88999000002', status: 'confirmed' });
    const e3 = createEnrollment({ activityId, name: 'Carla', phone: '88999000003', status: 'confirmed' });
    const e4 = createEnrollment({ activityId, name: 'Diego', phone: '88999000004', status: 'confirmed' });
    createEnrollment({ activityId, name: 'Eva Pendente', phone: '88999000005', status: 'pending' });

    // Antes de salvar -> recorded: false e present: null
    const sessionsBefore = await (
      await fetch(`${app.baseUrl}/api/admin/activities/${activityId}/sessions`, { headers: { cookie } })
    ).json();
    const s1Before = sessionsBefore.data.find((s) => s.date === pastDate1);
    assert.equal(s1Before.recorded, false);

    const getInitial = await (
      await fetch(`${app.baseUrl}/api/admin/activities/${activityId}/attendance?date=${pastDate1}`, {
        headers: { cookie },
      })
    ).json();
    assert.equal(getInitial.data.pendingCount, 1);
    assert.equal(getInitial.data.records.length, 4);
    assert.ok(getInitial.data.records.every((r) => r.present === null));

    // Salvar chamada (3 presentes, 1 ausente)
    const putRes = await fetch(`${app.baseUrl}/api/admin/activities/${activityId}/attendance?date=${pastDate1}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        records: [
          { enrollmentId: e1, present: true },
          { enrollmentId: e2, present: true },
          { enrollmentId: e3, present: true },
          { enrollmentId: e4, present: false },
        ],
      }),
    });
    assert.equal(putRes.status, 200);
    const putJson = await putRes.json();
    assert.equal(putJson.data.presentCount, 3);
    assert.equal(putJson.data.absentCount, 1);

    // Salvar novamente invertendo e4 -> sobrescreve sem duplicar
    const putRes2 = await fetch(`${app.baseUrl}/api/admin/activities/${activityId}/attendance?date=${pastDate1}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        records: [
          { enrollmentId: e1, present: true },
          { enrollmentId: e2, present: true },
          { enrollmentId: e3, present: false },
          { enrollmentId: e4, present: true },
        ],
      }),
    });
    assert.equal(putRes2.status, 200);

    const totalRows = app.db
      .prepare('SELECT COUNT(*) AS c FROM attendance WHERE session_date = ?')
      .get(pastDate1);
    assert.equal(totalRows.c, 4);

    // Cancelar inscrição e4 -> mantém histórico em pastDate1, mas não aparece em pastDate2 (Critério 5)
    await fetch(`${app.baseUrl}/api/admin/enrollments/${e4}/status`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ status: 'cancelled' }),
    });

    const nextSessionRes = await fetch(
      `${app.baseUrl}/api/admin/activities/${activityId}/attendance?date=${pastDate2}`,
      { headers: { cookie } },
    );
    const nextSessionJson = await nextSessionRes.json();
    assert.equal(nextSessionJson.data.records.length, 3);
    assert.equal(
      nextSessionJson.data.records.some((r) => r.enrollmentId === e4),
      false,
    );

    const historyCount = app.db
      .prepare('SELECT COUNT(*) AS c FROM attendance WHERE enrollment_id = ?')
      .get(e4);
    assert.equal(historyCount.c, 1);
  });

  it('rejeita data fora dos encontros, data futura e enrollmentId inválido/pending fazendo rollback total (Critérios 3 e 4)', async () => {
    const cookie = await loginCookie();
    const headers = { 'content-type': 'application/json', cookie };

    const today = todayInFortaleza();
    const pastDate = addDays(today, -2);
    const futureDate = addDays(today, 2);
    const nonSessionDate = addDays(today, -1);

    const activityId = createActivityWithSchedules({
      title: 'Oficina de Percussão',
      startDate: pastDate,
      endDate: futureDate,
      weekdays: [weekdayOf(pastDate), weekdayOf(futureDate)],
    });

    const otherActivityId = createActivityWithSchedules({
      title: 'Outra Oficina',
      startDate: pastDate,
      endDate: today,
      weekdays: [weekdayOf(pastDate)],
    });

    const confirmedId = createEnrollment({ activityId, name: 'Lucas', phone: '88999000010', status: 'confirmed' });
    const pendingId = createEnrollment({ activityId, name: 'Marina', phone: '88999000011', status: 'pending' });
    const foreignId = createEnrollment({ activityId: otherActivityId, name: 'Nádia', phone: '88999000012', status: 'confirmed' });

    // Data que não é encontro -> 400
    const badDateRes = await fetch(
      `${app.baseUrl}/api/admin/activities/${activityId}/attendance?date=${nonSessionDate}`,
      { headers: { cookie } },
    );
    assert.equal(badDateRes.status, 400);

    // Data futura -> 400
    const futureRes = await fetch(
      `${app.baseUrl}/api/admin/activities/${activityId}/attendance?date=${futureDate}`,
      { headers: { cookie } },
    );
    assert.equal(futureRes.status, 400);

    // Lote contendo confirmedId + pendingId -> 400 e rollback total (nada gravado!)
    const badPendingPut = await fetch(
      `${app.baseUrl}/api/admin/activities/${activityId}/attendance?date=${pastDate}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          records: [
            { enrollmentId: confirmedId, present: true },
            { enrollmentId: pendingId, present: true },
          ],
        }),
      },
    );
    assert.equal(badPendingPut.status, 400);

    // Lote contendo confirmedId + foreignId -> 400 e rollback total
    const badForeignPut = await fetch(
      `${app.baseUrl}/api/admin/activities/${activityId}/attendance?date=${pastDate}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          records: [
            { enrollmentId: confirmedId, present: true },
            { enrollmentId: foreignId, present: true },
          ],
        }),
      },
    );
    assert.equal(badForeignPut.status, 400);

    const savedRows = app.db
      .prepare('SELECT COUNT(*) AS c FROM attendance WHERE session_date = ?')
      .get(pastDate);
    assert.equal(savedRows.c, 0);
  });
});