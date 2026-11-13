import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../../src/db/connection.js';
import { migrateDatabase } from '../../src/db/migrate.js';
import { createAdminUserRepository } from '../../src/modules/admin-auth/repository.js';
import { createAdminUser, verifyPassword } from '../../src/modules/admin-auth/service.js';
import { ConflictError, ValidationError } from '../../src/lib/errors.js';

const FAST_COST = 4; // bcrypt cost for tests only; production default is 12

describe('admin users', () => {
  let repo;
  beforeEach(() => {
    const db = openDatabase(':memory:');
    migrateDatabase(db);
    repo = createAdminUserRepository(db);
  });

  test('createAdminUser stores a bcrypt hash, never the password', async () => {
    const user = await createAdminUser(repo, {
      name: 'Equipe', email: 'Equipe@Nucleo.local', password: 'senha-forte-1',
    }, { cost: FAST_COST });

    assert.equal(user.email, 'equipe@nucleo.local');
    assert.equal('passwordHash' in user, false);

    const stored = repo.findByEmail('equipe@nucleo.local');
    assert.match(stored.passwordHash, /^\$2[aby]\$/);
    assert.notEqual(stored.passwordHash, 'senha-forte-1');
    assert.equal(await verifyPassword('senha-forte-1', stored.passwordHash), true);
    assert.equal(await verifyPassword('outra-senha', stored.passwordHash), false);
  });

  test('default bcrypt cost is 12', async () => {
    await createAdminUser(repo, { name: 'A', email: 'a@nucleo.local', password: '12345678' });
    assert.match(repo.findByEmail('a@nucleo.local').passwordHash, /^\$2[aby]\$12\$/);
  });

  test('e-mail is unique regardless of case', async () => {
    await createAdminUser(repo, { name: 'A', email: 'a@nucleo.local', password: '12345678' }, { cost: FAST_COST });
    await assert.rejects(
      createAdminUser(repo, { name: 'B', email: 'A@NUCLEO.LOCAL', password: '12345678' }, { cost: FAST_COST }),
      (err) => err instanceof ConflictError && err.code === 'EMAIL_TAKEN',
    );
  });

  test('rejects short passwords and invalid e-mails', async () => {
    await assert.rejects(
      createAdminUser(repo, { name: 'A', email: 'a@nucleo.local', password: '1234567' }, { cost: FAST_COST }),
      (err) => err instanceof ValidationError && 'password' in err.fields,
    );
    await assert.rejects(
      createAdminUser(repo, { name: 'A', email: 'nao-e-email', password: '12345678' }, { cost: FAST_COST }),
      (err) => err instanceof ValidationError && 'email' in err.fields,
    );
  });

  test('findByEmail is case-insensitive and returns undefined when missing', async () => {
    await createAdminUser(repo, { name: 'A', email: 'a@nucleo.local', password: '12345678' }, { cost: FAST_COST });
    assert.equal(repo.findByEmail('A@Nucleo.Local').name, 'A');
    assert.equal(repo.findByEmail('ninguem@nucleo.local'), undefined);
  });
});
