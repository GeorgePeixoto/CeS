import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { startTestApp } from '../helpers.js';

describe('reports — summary API', () => {
  let app;
  let musicCategoryId;
  let theaterCategoryId;
  let activityAId;
  let activityBId;

  before(async () => {
    app = await startTestApp();
    const hash = await bcrypt.hash('senha1234', 4);
    app.db
      .prepare('INSERT INTO admin_users (name, email, password_hash) VALUES (?, ?, ?)')
      .run('Admin', 'admin@nucleo.local', hash);

    musicCategoryId = Number(
      app.db.prepare('INSERT INTO categories (name) VALUES (?)').run('Música').lastInsertRowid,
    );
    theaterCategoryId = Number(
      app.db.prepare('INSERT INTO categories (name) VALUES (?)').run('Teatro').lastInsertRowid,
    );

    // Atividade A (Música, 2026-11-05): capacity = 10, 6 ativas (4 confirmed + 2 pending) e 1 cancelled
    activityAId = Number(
      app.db
        .prepare(
          `INSERT INTO activities (title, type, category_id, start_date, end_date, capacity, status)
           VALUES ('Oficina de Violão', 'workshop', ?, '2026-11-05', '2026-11-25', 10, 'published')`,
        )
        .run(musicCategoryId).lastInsertRowid,
    );

    // Atividade B (Teatro, 2026-12-10): capacity = 20, 2 ativas, sem registros de presença
    activityBId = Number(
      app.db
        .prepare(
          `INSERT INTO activities (title, type, category_id, start_date, end_date, capacity, status)
           VALUES ('Curso de Teatro', 'course', ?, '2026-12-10', '2026-12-20', 20, 'published')`,
        )
        .run(theaterCategoryId).lastInsertRowid,
    );

    // Atividade C (Rascunho): nunca deve aparecer no relatório
    app.db
      .prepare(
        `INSERT INTO activities (title, type, category_id, start_date, end_date, capacity, status)
         VALUES ('Rascunho Secreto', 'event', ?, '2026-11-10', '2026-11-10', 15, 'draft')`,
      )
      .run(musicCategoryId);

    const insertPart = app.db.prepare(
      "INSERT INTO participants (name, phone, email, birth_date) VALUES (?, ?, ?, '1995-05-05')",
    );
    const insertEnr = app.db.prepare(
      `INSERT INTO enrollments (activity_id, participant_id, protocol, status, consent_at)
       VALUES (?, ?, ?, ?, '2026-11-01T10:00:00.000Z')`,
    );
    const insertAtt = app.db.prepare(
      'INSERT INTO attendance (enrollment_id, session_date, present) VALUES (?, ?, ?)',
    );

    const confirmedIdsA = [];
    for (let i = 1; i <= 4; i += 1) {
      const pId = Number(
        insertPart.run(`Participante Sigiloso ${i}`, `8899900000${i}`, `sigilo${i}@teste.com`).lastInsertRowid,
      );
      const eId = Number(
        insertEnr.run(activityAId, pId, `NMJ-A0000${i}`, 'confirmed').lastInsertRowid,
      );
      confirmedIdsA.push(eId);

      // Também inscreve o Participante 1 na Atividade B para validar contagem de participantes únicos
      if (i === 1) {
        insertEnr.run(activityBId, pId, 'NMJ-B00001', 'confirmed');
      }
    }

    // 2 pendentes na Atividade A (total ativo = 4 + 2 = 6)
    for (let i = 5; i <= 6; i += 1) {
      const pId = Number(
        insertPart.run(`Participante Sigiloso ${i}`, `8899900000${i}`, null).lastInsertRowid,
      );
      insertEnr.run(activityAId, pId, `NMJ-A0000${i}`, 'pending');
    }

    // 1 cancelada na Atividade A (não entra no enrolled)
    const cancelledPartId = Number(
      insertPart.run('Cancelado Teste', '88999000099', null).lastInsertRowid,
    );
    insertEnr.run(activityAId, cancelledPartId, 'NMJ-A00099', 'cancelled');

    // Mais 1 inscrição na Atividade B (total ativo em B = 2)
    const partB2 = Number(insertPart.run('Aluno Teatro 2', '88999000077', null).lastInsertRowid);
    insertEnr.run(activityBId, partB2, 'NMJ-B00002', 'pending');

    // 8 registros de presença na Atividade A (2 datas x 4 confirmados), sendo 6 presentes (75%)
    const session1 = [1, 1, 1, 0];
    const session2 = [1, 1, 1, 0];
    confirmedIdsA.forEach((eId, idx) => {
      insertAtt.run(eId, '2026-11-05', session1[idx]);
      insertAtt.run(eId, '2026-11-12', session2[idx]);
    });
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

  it('bloqueia /api/admin/reports/summary sem sessão (401 - Critério 6)', async () => {
    const res = await fetch(`${app.baseUrl}/api/admin/reports/summary`);
    assert.equal(res.status, 401);
  });

  it('calcula totais, ocupação (60%), frequência (75% e null), omite rascunhos e não vaza dados pessoais (Critérios 1, 2 e 3)', async () => {
    const cookie = await loginCookie();
    const res = await fetch(`${app.baseUrl}/api/admin/reports/summary`, {
      headers: { cookie },
    });
    assert.equal(res.status, 200);

    const rawText = await res.text();
    // Nenhum dado pessoal deve aparecer na resposta
    assert.equal(rawText.includes('Participante Sigiloso'), false);
    assert.equal(rawText.includes('88999000001'), false);
    assert.equal(rawText.includes('sigilo1@teste.com'), false);
    assert.equal(rawText.includes('Rascunho Secreto'), false);

    const { data } = JSON.parse(rawText);

    // Totais: 2 atividades (A e B), 8 inscrições ativas (6 + 2), 7 participantes únicos
    assert.equal(data.totals.activities, 2);
    assert.equal(data.totals.enrollments, 8);
    assert.equal(data.totals.participants, 7);
    assert.equal(data.totals.avgOccupancy, 35); // média de 60% e 10%
    assert.equal(data.totals.avgAttendance, 75); // média apenas das atividades com presença (75%)

    const actA = data.byActivity.find((a) => a.id === activityAId);
    assert.ok(actA);
    assert.equal(actA.enrolled, 6);
    assert.equal(actA.confirmed, 4);
    assert.equal(actA.occupancy, 60);
    assert.equal(actA.attendanceRate, 75);

    const actB = data.byActivity.find((a) => a.id === activityBId);
    assert.ok(actB);
    assert.equal(actB.enrolled, 2);
    assert.equal(actB.occupancy, 10);
    assert.equal(actB.attendanceRate, null);

    assert.deepEqual(data.byCategory, [
      { category: 'Música', enrolled: 6 },
      { category: 'Teatro', enrolled: 2 },
    ]);
  });

  it('filtra por período (from/to) e categoria (Critério 4)', async () => {
    const cookie = await loginCookie();

    // Filtro por período de novembro -> traz só Atividade A
    const novRes = await fetch(
      `${app.baseUrl}/api/admin/reports/summary?from=2026-11-01&to=2026-11-30`,
      { headers: { cookie } },
    );
    assert.equal(novRes.status, 200);
    const { data: novData } = await novRes.json();
    assert.equal(novData.totals.activities, 1);
    assert.equal(novData.byActivity[0].id, activityAId);

    // Filtro por categoria Teatro -> traz só Atividade B
    const theaterRes = await fetch(
      `${app.baseUrl}/api/admin/reports/summary?category=${theaterCategoryId}`,
      { headers: { cookie } },
    );
    assert.equal(theaterRes.status, 200);
    const { data: theaterData } = await theaterRes.json();
    assert.equal(theaterData.totals.activities, 1);
    assert.equal(theaterData.byActivity[0].id, activityBId);
    assert.equal(theaterData.totals.avgAttendance, null);
  });
});