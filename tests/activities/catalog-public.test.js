import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { startTestApp } from '../helpers.js';

describe('activities — public catalog & detail', () => {
  let app;
  let musicCatId;
  let theaterCatId;
  let instructorId;

  before(async () => {
    app = await startTestApp();
    const hash = await bcrypt.hash('senha1234', 4);
    app.db
      .prepare('INSERT INTO admin_users (name, email, password_hash) VALUES (?, ?, ?)')
      .run('Admin', 'admin@nucleo.local', hash);

    musicCatId = Number(app.db.prepare('INSERT INTO categories (name) VALUES (?)').run('Música').lastInsertRowid);
    theaterCatId = Number(app.db.prepare('INSERT INTO categories (name) VALUES (?)').run('Teatro').lastInsertRowid);

    instructorId = Number(
      app.db
        .prepare('INSERT INTO instructors (name, bio, phone, email, active) VALUES (?, ?, ?, ?, 1)')
        .run('Ana Cantora', 'Musicista e arte-educadora.', '88999990000', 'ana@nucleo.local')
        .lastInsertRowid,
    );
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

  it('oculta atividades draft/cancelled no catálogo e detalhe até serem publicadas', async () => {
    const cookie = await loginCookie();
    const headers = { 'content-type': 'application/json', cookie };

    const createRes = await fetch(`${app.baseUrl}/api/admin/activities`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Oficina de Violão',
        description: 'Aprenda acordes básicos e ritmos nordestinos.',
        type: 'workshop',
        categoryId: musicCatId,
        instructorId,
        location: 'Sala 2',
        startDate: '2026-12-10',
        endDate: '2026-12-20',
        capacity: 12,
        schedules: [{ weekday: 3, startTime: '15:00', endTime: '17:00' }],
      }),
    });
    assert.equal(createRes.status, 201);
    const { data: created } = await createRes.json();

    // Enquanto draft -> não aparece na lista e detalhe devolve 404
    const listDraftRes = await fetch(`${app.baseUrl}/api/activities`);
    const { data: listDraft } = await listDraftRes.json();
    assert.equal(listDraft.length, 0);

    const detailDraftRes = await fetch(`${app.baseUrl}/api/activities/${created.id}`);
    assert.equal(detailDraftRes.status, 404);

    // Publicar
    const pubRes = await fetch(`${app.baseUrl}/api/admin/activities/${created.id}/status`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ status: 'published' }),
    });
    assert.equal(pubRes.status, 200);

    // Agora aparece na lista e no detalhe, sem phone/email do instrutor
    const listPubRes = await fetch(`${app.baseUrl}/api/activities`);
    const { data: listPub } = await listPubRes.json();
    assert.equal(listPub.length, 1);
    assert.equal(listPub[0].title, 'Oficina de Violão');
    assert.equal(listPub[0].seatsAvailable, 12);
    assert.equal(listPub[0].soldOut, false);
    assert.equal(listPub[0].instructor.name, 'Ana Cantora');
    assert.equal(listPub[0].instructor.phone, undefined);
    assert.equal(listPub[0].instructor.email, undefined);

    const detailPubRes = await fetch(`${app.baseUrl}/api/activities/${created.id}`);
    assert.equal(detailPubRes.status, 200);
    const { data: detail } = await detailPubRes.json();
    assert.equal(detail.id, created.id);
    assert.equal(detail.instructor.bio, 'Musicista e arte-educadora.');
    assert.equal(detail.instructor.phone, undefined);
    assert.equal(detail.instructor.email, undefined);
  });

  it('filtra por q (case-insensitive), category e type, ordenando por startDate', async () => {
    const cookie = await loginCookie();
    const headers = { 'content-type': 'application/json', cookie };

    const createAndPublish = async (payload) => {
      const res = await fetch(`${app.baseUrl}/api/admin/activities`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const { data } = await res.json();
      await fetch(`${app.baseUrl}/api/admin/activities/${data.id}/status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ status: 'published' }),
      });
      return data;
    };

    await createAndPublish({
      title: 'Curso de Dramaturgia',
      description: 'Escrita teatral para jovens.',
      type: 'course',
      categoryId: theaterCatId,
      instructorId,
      startDate: '2026-12-01',
      endDate: '2026-12-30',
      capacity: 20,
      schedules: [{ weekday: 1, startTime: '18:00', endTime: '20:00' }],
    });

    // Busca por q=violão (minúsculo) encontra "Oficina de Violão"
    const searchRes = await fetch(`${app.baseUrl}/api/activities?q=${encodeURIComponent('violão')}`);
    const { data: searchData } = await searchRes.json();
    assert.equal(searchData.length, 1);
    assert.equal(searchData[0].title, 'Oficina de Violão');

    // Filtro por categoria Teatro
    const catRes = await fetch(`${app.baseUrl}/api/activities?category=${theaterCatId}`);
    const { data: catData } = await catRes.json();
    assert.equal(catData.length, 1);
    assert.equal(catData[0].title, 'Curso de Dramaturgia');

    // Lista completa ordenada por startDate (2026-12-01 antes de 2026-12-10)
    const allRes = await fetch(`${app.baseUrl}/api/activities`);
    const { data: allData } = await allRes.json();
    assert.equal(allData.length, 2);
    assert.equal(allData[0].startDate, '2026-12-01');
    assert.equal(allData[1].startDate, '2026-12-10');
  });
});