import { openDatabase } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';

const dbPath = process.env.DB_PATH || 'data/nucleo.db';
const db = openDatabase(dbPath);
const applied = migrateDatabase(db);
db.close();

console.log(applied.length
  ? `Migrações aplicadas em ${dbPath}: ${applied.join(', ')}`
  : `Banco ${dbPath} já está atualizado.`);
