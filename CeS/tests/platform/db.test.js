import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase, transaction } from '../../src/db/connection.js';
import { migrateDatabase } from '../../src/db/migrate.js';

describe('connection', () => {
  test('enables foreign keys', () => {
    const db = openDatabase(':memory:');
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    db.close();
  });

  test('transaction commits on success and rolls back on error', () => {
    const db = openDatabase(':memory:');
    db.exec('CREATE TABLE t (v INTEGER)');

    transaction(db, () => db.prepare('INSERT INTO t VALUES (1)').run());
    assert.throws(() => transaction(db, () => {
      db.prepare('INSERT INTO t VALUES (2)').run();
      throw new Error('boom');
    }), /boom/);

    assert.deepEqual(db.prepare('SELECT v FROM t').all().map((r) => r.v), [1]);
    db.close();
  });

  test('nested transaction joins the outer one', () => {
    const db = openDatabase(':memory:');
    db.exec('CREATE TABLE t (v INTEGER)');
    assert.throws(() => transaction(db, () => {
      transaction(db, () => db.prepare('INSERT INTO t VALUES (1)').run());
      throw new Error('outer fails');
    }));
    assert.equal(db.prepare('SELECT COUNT(*) n FROM t').get().n, 0);
    db.close();
  });
});

describe('migrations', () => {
  test('applies pending migrations in order and is idempotent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nmj-mig-'));
    try {
      writeFileSync(join(dir, '001_a.sql'), 'CREATE TABLE a (id INTEGER PRIMARY KEY);');
      writeFileSync(join(dir, '002_b.sql'), 'CREATE TABLE b (a_id INTEGER REFERENCES a(id));');
      const db = openDatabase(':memory:');

      assert.deepEqual(migrateDatabase(db, dir), ['001_a.sql', '002_b.sql']);
      assert.deepEqual(migrateDatabase(db, dir), []);

      const names = db.prepare('SELECT name FROM schema_migrations ORDER BY name').all();
      assert.deepEqual(names.map((r) => r.name), ['001_a.sql', '002_b.sql']);
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a failing migration is rolled back and not recorded', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nmj-mig-'));
    try {
      writeFileSync(join(dir, '001_ok.sql'), 'CREATE TABLE ok (id INTEGER);');
      writeFileSync(join(dir, '002_bad.sql'), 'CREATE TABLE half (id INTEGER); THIS IS NOT SQL;');
      const db = openDatabase(':memory:');

      assert.throws(() => migrateDatabase(db, dir), /002_bad\.sql/);
      const names = db.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name);
      assert.deepEqual(names, ['001_ok.sql']);
      const half = db.prepare("SELECT name FROM sqlite_master WHERE name = 'half'").get();
      assert.equal(half, undefined);
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('project migrations apply cleanly to an empty database', () => {
    const db = openDatabase(':memory:');
    assert.ok(migrateDatabase(db).length >= 1);
    db.close();
  });
});
