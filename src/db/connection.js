import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDatabase(dbPath) {
  const inMemory = dbPath === ':memory:';
  if (!inMemory) mkdirSync(dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  if (!inMemory) db.exec('PRAGMA journal_mode = WAL');
  return db;
}

/**
 * Runs `fn` inside BEGIN IMMEDIATE (takes the write lock up front, so read-then-write
 * checks like seat counting are atomic). Nested calls join the outer transaction.
 */
export function transaction(db, fn) {
  if (db.isTransaction) return fn();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw err;
  }
}
