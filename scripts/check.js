// Runs `node --check` on every project .js file (syntax-only lint, no dependencies).
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOTS = ['src', 'scripts', 'tests', 'public/js'];

function listJsFiles(dir) {
  let files = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files = files.concat(listJsFiles(path));
    else if (path.endsWith('.js')) files.push(path);
  }
  return files;
}

const files = ROOTS.flatMap(listJsFiles);
let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed += 1;
    process.stderr.write(result.stderr);
  }
}
console.log(`check: ${files.length} arquivos, ${failed} com erro`);
process.exit(failed ? 1 : 0);
