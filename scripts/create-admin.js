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

function askHidden(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    let value = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (char) => {
      if (char === '\u0003') { // Ctrl+C
        cleanup();
        reject(new Error('Cancelado.'));
      } else if (char === '\r' || char === '\n') {
        cleanup();
        stdout.write('\n');
        resolve(value);
      } else if (char === '\u0008' || char === '\u007f') { // backspace
        value = value.slice(0, -1);
      } else {
        value += char;
      }
    };
    function cleanup() {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
    }
    stdin.on('data', onData);
  });
}

async function readFirstLine() {
  const rl = createInterface({ input: process.stdin });
  for await (const line of rl) { rl.close(); return line; }
  return '';
}

async function readPassword() {
  if (!process.stdin.isTTY) return readFirstLine();
  const password = await askHidden('Senha (mínimo 8 caracteres): ');
  const confirmation = await askHidden('Confirme a senha: ');
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
