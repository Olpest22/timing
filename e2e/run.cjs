/* Запуск всех сквозных тестов по порядку: node run.cjs  (или один: node tests/04-events.cjs) */
const { execFileSync } = require('node:child_process');
const { mkdirSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

mkdirSync(join(__dirname, 'screenshots'), { recursive: true });
const tests = readdirSync(join(__dirname, 'tests')).filter((f) => f.endsWith('.cjs')).sort();
let failed = 0;
for (const t of tests) {
  process.stdout.write(`▸ ${t}\n`);
  try {
    execFileSync(process.execPath, [join(__dirname, 'tests', t)], { stdio: 'inherit' });
  } catch {
    failed++;
  }
}
console.log(failed ? `\nУпало: ${failed} из ${tests.length}` : `\nВсе ${tests.length} тестов прошли`);
process.exit(failed ? 1 : 0);
