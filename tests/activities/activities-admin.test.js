import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { startTestApp } from '../helpers.js';
import { createActivitiesRepository } from '../../src/modules/activities/repository.js';
import { createActivitiesService } from '../../src/modules/activities/service.js';

describe('activities — admin CRUD, schedules & status', () => {
  let app;
  let categoryId;
  let activeInstructorId;
  let inactiveInstructorId;

  before(async () => {
    app = await startTestApp();
    const hash = await bcrypt.hash('senha1234', 4);
    app.db
      .prepare('INSERT INTO admin_users (name, email, password_hash) VALUES (?, ?, ?)')
      .run('Admin', 'admin@nucleo.local', hash);

    const cat = app.db.prepare('INSERT INTO categories (name) VALUES (?)').run('Música');
    categoryId = Number(cat.lastInsertRowid);

    const inst1 = app.db
      .prepare('INSERT INTO instructors (name, bio, active) VALUES (?, ?, 1)')
      .run('João Violão', 'Professor de violão');
    activeInstructorId = Number(inst1.lastInsertRowid);

    const inst2 = app.db
      .prepare('INSERT INTO instructors (name, active) VALUES (?, 0)')
      .run('Instrutor Inativo');
    inactiveInstructorId = Number(inst2.lastInsertRowid);
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

  it('bloqueia todas as rotas /api/admin/activities* sem sessão (401)', async () => {
    const routes = [
      ['GET', '/api/admin/activities'],
      ['POST', '/api/admin/activities'],
      ['GET', '/api/admin/activities/1'],
      ['PUT', '/api/admin/activities/1'],
      ['POST', '/api/admin/activities/1/status'],
    ];

    for (const [method, path] of routes) {
      const res = await fetch(`${app.baseUrl}${path}`, {
        method,
        headers: { 'content-type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify({}),
      });
      assert.equal(res.status, 401, `${method} ${path} deveria retornar 401`);
    }
  });

  it('cria atividade com 2 horários (201), edita substituindo horários e altera status', async () => {
    const cookie = await loginCookie();
    const headers = { 'content-type': 'application/json', cookie };

    const createRes = await fetch(`${app.baseUrl}/api/admin/activities`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Oficina de Violão Popular',
        description: 'Aulas práticas para iniciantes.',
        type: 'workshop',
        categoryId,
        instructorId: activeInstructorId,
        location: 'Sala 01',
        startDate: '2026-12-01',
        endDate: '2026-12-20',
        capacity: 15,
        minAge: 12,
        schedules: [
          { weekday: 2, startTime: '14:00', endTime: '16:00' },
          { weekday: 4, startTime: '14:00', endTime: '16:00' },
        ],
      }),
    });

    assert.equal(createRes.status, 201);
    const { data: created } = await createRes.json();
    assert.equal(created.title, 'Oficina de Violão Popular');
    assert.equal(created.status, 'draft');
    assert.equal(created.minAge, 12);
    assert.equal(created.seatsAvailable, 15);
    assert.equal(created.schedules.length, 2);

    // Detalhe devolve os 2 horários
    const detailRes = await fetch(`${app.baseUrl}/api/admin/activities/${created.id}`, {
      headers: { cookie },
    });
    assert.equal(detailRes.status, 200);
    const { data: detail } = await detailRes.json();
    assert.equal(detail.schedules.length, 2);

    // PUT substitui os horários
    const updateRes = await fetch(`${app.baseUrl}/api/admin/activities/${created.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        title: 'Oficina de Violão Popular II',
        description: 'Turma única.',
        type: 'workshop',
        categoryId,
        instructorId: activeInstructorId,
        location: 'Auditório',
        startDate: '2026-12-01',
        endDate: '2026-12-20',
        capacity: 20,
        minAge: 0,
        schedules: [{ weekday: 6, startTime: '09:00', endTime: '11:30' }],
      }),
    });

    assert.equal(updateRes.status, 200);
    const { data: updated } = await updateRes.json();
    assert.equal(updated.title, 'Oficina de Violão Popular II');
    assert.equal(updated.minAge, 0);
    assert.equal(updated.schedules.length, 1);
    assert.equal(updated.schedules[0].weekday, 6);

    // Publicar atividade
    const statusRes = await fetch(`${app.baseUrl}/api/admin/activities/${created.id}/status`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ status: 'published' }),
    });
    assert.equal(statusRes.status, 200);
    const { data: published } = await statusRes.json();
    assert.equal(published.status, 'published');
  });

  it('rejeita endDate < startDate, capacity = 0, horário invertido, minAge > 120 e instrutor inativo com 400', async () => {
    const cookie = await loginCookie();
    const headers = { 'content-type': 'application/json', cookie };

    const badRes = await fetch(`${app.baseUrl}/api/admin/activities`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Curso Inválido',
        type: 'course',
        categoryId,
        instructorId: inactiveInstructorId,
        startDate: '2026-12-10',
        endDate: '2026-12-05',
        capacity: 0,
        minAge: 121,
        schedules: [{ weekday: 1, startTime: '16:00', endTime: '14:00' }],
      }),
    });

    assert.equal(badRes.status, 400);
    const { error } = await badRes.json();
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.ok(error.fields.endDate);
    assert.ok(error.fields.capacity);
    assert.ok(error.fields.minAge);
    assert.ok(error.fields.instructorId);
    assert.ok(error.fields['schedules.0.endTime']);
  });

  it('retorna 409 CAPACITY_BELOW_ENROLLED ao reduzir capacidade abaixo dos inscritos ativos', () => {
    const baseRepo = createActivitiesRepository(app.db);
    const created = baseRepo.createActivity({
      title: 'Teatro Experimental',
      description: null,
      type: 'course',
      categoryId,
      instructorId: activeInstructorId,
      location: 'Palco',
      startDate: '2026-12-01',
      endDate: '2026-12-15',
      capacity: 10,
      minAge: null,
      schedules: [{ weekday: 3, startTime: '18:00', endTime: '20:00' }],
    });

    const repoWithEnrollments = {
      ...baseRepo,
      countActiveEnrollments: () => 6,
    };
    const service = createActivitiesService(repoWithEnrollments);

    assert.throws(
      () =>
        service.updateActivity(created.id, {
          title: 'Teatro Experimental',
          type: 'course',
          categoryId,
          instructorId: activeInstructorId,
          startDate: '2026-12-01',
          endDate: '2026-12-15',
          capacity: 5,
          schedules: [{ weekday: 3, startTime: '18:00', endTime: '20:00' }],
        }),
      (err) => err.status === 409 && err.code === 'CAPACITY_BELOW_ENROLLED',
    );
  });
});