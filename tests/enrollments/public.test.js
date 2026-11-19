import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp } from '../helpers.js';
import { addDays, todayInFortaleza } from '../../src/lib/dates.js';

describe('enrollments — public pre-enrollment & seat locking', () => {
  let app;
  let categoryId;

  before(async () => {
    app = await startTestApp();
    categoryId = Number(app.db.prepare('INSERT INTO categories (name) VALUES (?)').run('Música').lastInsertRowid);
  });

  after(async () => {
    await app.close();
  });

  function insertActivity({
    title = 'Oficina Teste',
    capacity = 5,
    minAge = null,
    status = 'published',
    startDate = addDays(todayInFortaleza(), 5),
    endDate = addDays(todayInFortaleza(), 20),
  } = {}) {
    const res = app.db
      .prepare(
        `INSERT INTO activities (title, type, category_id, start_date, end_date, capacity, min_age, status)
         VALUES (?, 'workshop', ?, ?, ?, ?, ?, ?)`,
      )
      .run(title, categoryId, startDate, endDate, capacity, minAge, status);
    const id = Number(res.lastInsertRowid);
    app.db
      .prepare('INSERT INTO activity_schedules (activity_id, weekday, start_time, end_time) VALUES (?, 2, ?, ?)')
      .run(id, '14:00', '16:00');
    return id;
  }

  it('realiza pré-inscrição válida (201, NMJ-XXXXXX, pending) e reduz seatsAvailable até esgotar (409 NO_SEATS)', async () => {
    const activityId = insertActivity({ title: 'Xilogravura', capacity: 2 });

    // 1ª inscrição
    const res1 = await fetch(`${app.baseUrl}/api/activities/${activityId}/enrollments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Maria das Dores',
        phone: '(88) 99999-1111',
        email: 'maria@exemplo.com',
        birthDate: '1995-05-10',
        consent: true,
      }),
    });
    assert.equal(res1.status, 201);
    const { data: d1 } = await res1.json();
    assert.match(d1.protocol, /^NMJ-[A-HJ-NP-Z2-9]{6}$/);
    assert.equal(d1.status, 'pending');
    assert.equal(d1.activity.title, 'Xilogravura');
    assert.equal(d1.activity.schedules.length, 1);

    // seatsAvailable caiu de 2 para 1
    const actAfter1 = await (await fetch(`${app.baseUrl}/api/activities/${activityId}`)).json();
    assert.equal(actAfter1.data.seatsAvailable, 1);
    assert.equal(actAfter1.data.soldOut, false);

    // 2ª inscrição (irmão com mesmo telefone, nome diferente -> permitido)
    const res2 = await fetch(`${app.baseUrl}/api/activities/${activityId}/enrollments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'José das Dores',
        phone: '(88) 99999-1111',
        birthDate: '1998-08-20',
        consent: true,
      }),
    });
    assert.equal(res2.status, 201);

    // Catálogo agora mostra soldOut: true
    const actAfter2 = await (await fetch(`${app.baseUrl}/api/activities/${activityId}`)).json();
    assert.equal(actAfter2.data.seatsAvailable, 0);
    assert.equal(actAfter2.data.soldOut, true);

    // 3ª inscrição -> 409 NO_SEATS
    const res3 = await fetch(`${app.baseUrl}/api/activities/${activityId}/enrollments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Terceiro Candidato',
        phone: '(88) 98888-2222',
        birthDate: '1990-01-01',
        consent: true,
      }),
    });
    assert.equal(res3.status, 409);
    const { error } = await res3.json();
    assert.equal(error.code, 'NO_SEATS');
  });

  it('aceita exatamente 3 de 10 pedidos simultâneos para uma atividade com 3 vagas', async () => {
    const activityId = insertActivity({ title: 'Turma Concorrida', capacity: 3 });

    const requests = Array.from({ length: 10 }, (_, idx) =>
      fetch(`${app.baseUrl}/api/activities/${activityId}/enrollments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: `Participante ${idx + 1}`,
          phone: `889990000${String(idx).padStart(2, '0')}`,
          birthDate: '2000-03-15',
          consent: true,
        }),
      }),
    );

    const responses = await Promise.all(requests);
    const statuses = responses.map((r) => r.status);
    const okCount = statuses.filter((s) => s === 201).length;
    const conflictCount = statuses.filter((s) => s === 409).length;

    assert.equal(okCount, 3);
    assert.equal(conflictCount, 7);
  });

  it('impede inscrição duplicada ativa (409 ALREADY_ENROLLED) mesmo com acentos/maiúsculas diferentes', async () => {
    const activityId = insertActivity({ title: 'Coral Aberto', capacity: 10 });

    const first = await fetch(`${app.baseUrl}/api/activities/${activityId}/enrollments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'João Antônio',
        phone: '(88) 97777-3333',
        birthDate: '1992-07-10',
        consent: true,
      }),
    });
    assert.equal(first.status, 201);

    const dup = await fetch(`${app.baseUrl}/api/activities/${activityId}/enrollments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: '  joao   antonio ',
        phone: '88977773333',
        birthDate: '1992-07-10',
        consent: true,
      }),
    });
    assert.equal(dup.status, 409);
    const { error } = await dup.json();
    assert.equal(error.code, 'ALREADY_ENROLLED');
  });

  it('exige responsável para menor de 18 anos, exige consentimento, valida minAge e ACTIVITY_ENDED', async () => {
    const activityId = insertActivity({ title: 'Dança Juvenil', capacity: 10, minAge: 14 });
    const today = todayInFortaleza();
    const minorBirthDate = `${Number(today.slice(0, 4)) - 15}${today.slice(4)}`; // 15 anos hoje
    const underMinAgeBirthDate = `${Number(today.slice(0, 4)) - 12}${today.slice(4)}`; // 12 anos hoje

    // Sem consentimento -> 400
    const noConsentRes = await fetch(`${app.baseUrl}/api/activities/${activityId}/enrollments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Ana Jovem',
        phone: '88966664444',
        birthDate: minorBirthDate,
        guardianName: 'Mãe da Ana',
        guardianPhone: '88966665555',
        consent: false,
      }),
    });
    assert.equal(noConsentRes.status, 400);

    // Menor sem dados do responsável -> 400 com fields.guardianName
    const noGuardianRes = await fetch(`${app.baseUrl}/api/activities/${activityId}/enrollments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Ana Jovem',
        phone: '88966664444',
        birthDate: minorBirthDate,
        consent: true,
      }),
    });
    assert.equal(noGuardianRes.status, 400);
    const noGuardianJson = await noGuardianRes.json();
    assert.ok(noGuardianJson.error.fields.guardianName);

    // Menor com dados completos -> 201
    const okMinorRes = await fetch(`${app.baseUrl}/api/activities/${activityId}/enrollments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Ana Jovem',
        phone: '88966664444',
        birthDate: minorBirthDate,
        guardianName: 'Mãe da Ana',
        guardianPhone: '88966665555',
        consent: true,
      }),
    });
    assert.equal(okMinorRes.status, 201);

    // Abaixo da idade mínima (12 < 14) -> 400 BELOW_MIN_AGE
    const belowMinAgeRes = await fetch(`${app.baseUrl}/api/activities/${activityId}/enrollments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Pedro Criança',
        phone: '88966667777',
        birthDate: underMinAgeBirthDate,
        guardianName: 'Pai do Pedro',
        guardianPhone: '88966668888',
        consent: true,
      }),
    });
    assert.equal(belowMinAgeRes.status, 400);
    const belowJson = await belowMinAgeRes.json();
    assert.equal(belowJson.error.code, 'BELOW_MIN_AGE');

    // Atividade encerrada -> 409 ACTIVITY_ENDED
    const endedActivityId = insertActivity({
      title: 'Evento Passado',
      startDate: addDays(today, -10),
      endDate: addDays(today, -1),
    });
    const endedRes = await fetch(`${app.baseUrl}/api/activities/${endedActivityId}/enrollments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Adulto Teste',
        phone: '88955551111',
        birthDate: '1990-01-01',
        consent: true,
      }),
    });
    assert.equal(endedRes.status, 409);
    const endedJson = await endedRes.json();
    assert.equal(endedJson.error.code, 'ACTIVITY_ENDED');
  })

  it('consulta inscrição pelo protocolo e telefone (200 sem dados sensíveis) e retorna 404 genérico se não bater', async () => {
    const activityId = insertActivity({ title: 'Teatro de Bonecos', capacity: 8 });

    const enrollRes = await fetch(`${app.baseUrl}/api/activities/${activityId}/enrollments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Carlos Pereira',
        phone: '(88) 99444-1212',
        email: 'carlos@exemplo.com',
        birthDate: '2012-04-10',
        guardianName: 'Lúcia Pereira',
        guardianPhone: '(88) 99444-3434',
        consent: true,
      }),
    });
    assert.equal(enrollRes.status, 201);
    const { data: created } = await enrollRes.json();

    // Consulta com protocolo e telefone corretos -> 200
    const okLookup = await fetch(
      `${app.baseUrl}/api/enrollments/lookup?protocol=${created.protocol.toLowerCase()}&phone=${encodeURIComponent('(88) 99444-1212')}`,
    );
    assert.equal(okLookup.status, 200);
    const { data: found } = await okLookup.json();
    assert.equal(found.protocol, created.protocol);
    assert.equal(found.status, 'pending');
    assert.equal(found.participantName, 'Carlos Pereira');
    assert.equal(found.activity.title, 'Teatro de Bonecos');

    // Não vaza dados sensíveis (LGPD / Critério 7)
    assert.equal(found.email, undefined);
    assert.equal(found.birthDate, undefined);
    assert.equal(found.guardianName, undefined);
    assert.equal(found.guardianPhone, undefined);
    assert.equal(found.phone, undefined);

    // Telefone errado -> 404 genérico
    const wrongPhone = await fetch(
      `${app.baseUrl}/api/enrollments/lookup?protocol=${created.protocol}&phone=88900000000`,
    );
    assert.equal(wrongPhone.status, 404);
    const wrongJson = await wrongPhone.json();
    assert.equal(wrongJson.error.message, 'Inscrição não encontrada.');
  });
  
});