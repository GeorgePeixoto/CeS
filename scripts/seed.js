import { openDatabase } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';

const dbPath = process.env.DB_PATH || 'data/nucleo.db';
const db = openDatabase(dbPath);
migrateDatabase(db);

const CATEGORIES = ['Música', 'Teatro', 'Dança', 'Artes Visuais'];

const INSTRUCTORS = [
  {
    name: 'Mestre Antônio Bezerra',
    bio: 'Violonista, compositor e educador musical com 20 anos de atuação na cultura popular nordestina.',
    phone: '88999112233',
    email: 'antonio.bezerra@nucleo.local',
    active: 1,
  },
  {
    name: 'Clara Menezes',
    bio: 'Atriz, diretora teatral e pesquisadora de dramaturgia contemporânea e teatro de grupo.',
    phone: '88999223344',
    email: 'clara.menezes@nucleo.local',
    active: 1,
  },
  {
    name: 'Raimundo Nonato Filho',
    bio: 'Coreógrafo e brincante dedicado às danças tradicionais do Cariri e expressão corporal.',
    phone: '88999334455',
    email: 'raimundo.nonato@nucleo.local',
    active: 1,
  },
  {
    name: 'Helena Vasconcelos',
    bio: 'Artista visual, xilogravadora e ilustradora com foco em técnicas gráficas artesanais.',
    phone: '88999445566',
    email: 'helena.vasconcelos@nucleo.local',
    active: 1,
  },
];

const ACTIVITIES = [
  {
    title: 'Oficina de Violão Popular',
    description: 'Introdução aos acordes fundamentais, batidas de baião, xote e MPB para iniciantes.',
    type: 'workshop',
    category: 'Música',
    instructor: 'Mestre Antônio Bezerra',
    location: 'Sala de Música 01',
    startDate: '2026-12-01',
    endDate: '2026-12-22',
    capacity: 15,
    minAge: null,
    status: 'published',
    schedules: [
      { weekday: 2, startTime: '14:00', endTime: '16:00' },
      { weekday: 4, startTime: '14:00', endTime: '16:00' },
    ],
  },
  {
    title: 'Iniciação ao Teatro Contemporâneo',
    description: 'Jogos teatrais, improvisação, leitura dramática e criação coletiva de cenas.',
    type: 'course',
    category: 'Teatro',
    instructor: 'Clara Menezes',
    location: 'Sala Cênica',
    startDate: '2026-12-02',
    endDate: '2027-01-27',
    capacity: 20,
    minAge: null,
    status: 'published',
    schedules: [
      { weekday: 1, startTime: '18:00', endTime: '20:00' },
      { weekday: 3, startTime: '18:00', endTime: '20:00' },
    ],
  },
  {
    title: 'Dança Popular e Coco do Cariri',
    description: 'Vivência rítmica e coreográfica inspirada nas tradições populares da região do Cariri.',
    type: 'workshop',
    category: 'Dança',
    instructor: 'Raimundo Nonato Filho',
    location: 'Pátio Cultural',
    startDate: '2026-12-04',
    endDate: '2026-12-18',
    capacity: 25,
    minAge: 14,
    status: 'published',
    schedules: [{ weekday: 5, startTime: '16:00', endTime: '18:00' }],
  },
  {
    title: 'Xilogravura e Gravura em Relevo',
    description: 'Entalhe em madeira, entintamento e impressão artesanal de matrizes em papel.',
    type: 'workshop',
    category: 'Artes Visuais',
    instructor: 'Helena Vasconcelos',
    location: 'Ateliê de Artes',
    startDate: '2026-12-05',
    endDate: '2026-12-19',
    capacity: 2, // turma reduzida / últimas vagas
    minAge: 16,
    status: 'published',
    schedules: [{ weekday: 6, startTime: '09:00', endTime: '12:00' }],
  },
  {
    title: 'Sarau Aberto: Poesia, Viola e Cordel',
    description: 'Encontro cultural de um dia com apresentações musicais, declamação e microfone aberto.',
    type: 'event',
    category: 'Música',
    instructor: 'Mestre Antônio Bezerra',
    location: 'Auditório Marcus Jussier',
    startDate: '2026-12-12',
    endDate: '2026-12-12', // evento de um único dia
    capacity: 60,
    minAge: null,
    status: 'published',
    schedules: [{ weekday: 6, startTime: '18:30', endTime: '21:00' }],
  },
  {
    title: 'Canto Coral Juvenil',
    description: 'Técnica vocal básica, percepção harmônica e repertório brasileiro em grupo.',
    type: 'course',
    category: 'Música',
    instructor: 'Mestre Antônio Bezerra',
    location: 'Sala de Música 02',
    startDate: '2026-12-03',
    endDate: '2027-01-28',
    capacity: 18,
    minAge: 12,
    status: 'published',
    schedules: [{ weekday: 4, startTime: '16:30', endTime: '18:00' }],
  },
  {
    title: 'Desenho de Observação e Aquarela',
    description: 'Estudo de luz, sombra, proporção e mistura de pigmentos em paisagens e objetos.',
    type: 'course',
    category: 'Artes Visuais',
    instructor: 'Helena Vasconcelos',
    location: 'Ateliê de Artes',
    startDate: '2026-12-08',
    endDate: '2027-01-26',
    capacity: 14,
    minAge: null,
    status: 'published',
    schedules: [{ weekday: 2, startTime: '09:00', endTime: '11:30' }],
  },
  {
    title: 'Laboratório de Dramaturgia e Cena Curta',
    description: 'Atividade em planejamento para montagem cênica do próximo semestre.',
    type: 'workshop',
    category: 'Teatro',
    instructor: 'Clara Menezes',
    location: 'Sala Cênica',
    startDate: '2027-01-10',
    endDate: '2027-02-14',
    capacity: 12,
    minAge: 15,
    status: 'draft', // rascunho — não aparece no catálogo público
    schedules: [{ weekday: 6, startTime: '14:00', endTime: '17:00' }],
  },
];

function seed() {
  let createdCategories = 0;
  let createdInstructors = 0;
  let createdActivities = 0;

  db.exec('BEGIN');
  try {
    const findCategory = db.prepare('SELECT id FROM categories WHERE name = ?');
    const insertCategory = db.prepare('INSERT INTO categories (name) VALUES (?)');
    const categoryIds = new Map();

    for (const name of CATEGORIES) {
      let row = findCategory.get(name);
      if (!row) {
        const res = insertCategory.run(name);
        row = { id: Number(res.lastInsertRowid) };
        createdCategories += 1;
      }
      categoryIds.set(name, row.id);
    }

    const findInstructor = db.prepare('SELECT id FROM instructors WHERE name = ?');
    const insertInstructor = db.prepare(
      'INSERT INTO instructors (name, bio, phone, email, active) VALUES (?, ?, ?, ?, ?)',
    );
    const instructorIds = new Map();

    for (const inst of INSTRUCTORS) {
      let row = findInstructor.get(inst.name);
      if (!row) {
        const res = insertInstructor.run(inst.name, inst.bio, inst.phone, inst.email, inst.active);
        row = { id: Number(res.lastInsertRowid) };
        createdInstructors += 1;
      }
      instructorIds.set(inst.name, row.id);
    }

    const findActivity = db.prepare('SELECT id FROM activities WHERE title = ?');
    const insertActivity = db.prepare(
      `INSERT INTO activities (
        title, description, type, category_id, instructor_id,
        location, start_date, end_date, capacity, min_age, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertSchedule = db.prepare(
      'INSERT INTO activity_schedules (activity_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)',
    );

    for (const act of ACTIVITIES) {
      const existing = findActivity.get(act.title);
      if (existing) continue;

      const res = insertActivity.run(
        act.title,
        act.description,
        act.type,
        categoryIds.get(act.category),
        instructorIds.get(act.instructor) ?? null,
        act.location,
        act.startDate,
        act.endDate,
        act.capacity,
        act.minAge,
        act.status,
      );

      const activityId = Number(res.lastInsertRowid);
      for (const s of act.schedules) {
        insertSchedule.run(activityId, s.weekday, s.startTime, s.endTime);
      }
      createdActivities += 1;
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    db.close();
  }

  console.log(
    `Seed concluído: +${createdCategories} categorias, +${createdInstructors} instrutores, +${createdActivities} atividades.`,
  );
}

seed();