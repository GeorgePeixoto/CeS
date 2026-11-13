import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transaction } from './connection.js';

const DEFAULT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

/** Applies pending *.sql migrations in filename order. Returns the names applied. */
export function migrateDatabase(db, dir = DEFAULT_DIR) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name       TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`);

  const applied = new Set(db.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name));
  const pending = readdirSync(dir).filter((f) => f.endsWith('.sql') && !applied.has(f)).sort();
  const record = db.prepare('INSERT INTO schema_migrations (name) VALUES (?)');

  for (const name of pending) {
    const sql = readFileSync(join(dir, name), 'utf8');
    try {
      transaction(db, () => {
        db.exec(sql);
        record.run(name);
      });
    } catch (err) {
      throw new Error(`Migration ${name} failed: ${err.message}`, { cause: err });
    }
  }
  return pending;
}
