// Usage: npm run admin:create -- --email equipe@nucleo.local --name "Equipe"
// Asks for the password without echoing it. When stdin is not a terminal (piped),
// reads the password from the first line of stdin instead.
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline';
import { openDatabase } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createAdminUserRepository } from '../src/modules/admin-auth/repository.js';
import { createAdminUser } from '../src/modules/admin-auth/service.js';
import { HttpError } from '../src/lib/errors.js';
import { askHidden } from './lib/hidden-input.js';

async function readFirstLine() {
  const rl = createInterface({ input: process.stdin });
  for await (const line of rl) { rl.close(); return line; }
  return '';
}

async function readPassword() {
  if (!process.stdin.isTTY) return readFirstLine();
  // One raw-mode session for both prompts, so a trailing "\n" from Enter can't leak
  // into the confirmation (bug seen on Windows terminals).
  const [password, confirmation] = await askHidden(['Senha (mínimo 8 caracteres): ', 'Confirme a senha: ']);
  if (password !== confirmation) throw new Error('As senhas não conferem.');
  return password;
}

async function main() {
  const { values } = parseArgs({
    options: { email: { type: 'string' }, name: { type: 'string' } },
  });
  if (!values.email || !values.name) {
    console.error('Uso: npm run admin:create -- --email equipe@nucleo.local --name "Equipe"');
    process.exit(1);
  }

  const password = await readPassword();
  const dbPath = process.env.DB_PATH || 'data/nucleo.db';
  const db = openDatabase(dbPath);
  migrateDatabase(db);
  try {
    const user = await createAdminUser(createAdminUserRepository(db), { ...values, password });
    console.log(`Usuário criado: ${user.name} <${user.email}> (id ${user.id}) em ${dbPath}`);
  } finally {
    db.close();
  }
}

main().catch((err) => {
  if (err instanceof HttpError && err.fields) {
    console.error(`Erro: ${Object.values(err.fields).join(' ')}`);
  } else {
    console.error(`Erro: ${err.message}`);
  }
  process.exit(1);
});
