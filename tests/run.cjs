const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { transpile } = require('../transpile.cjs');
const testFile = 'tests/core.compiled.test.mjs';
try {
  const result = spawnSync(process.execPath, ['build.cjs'], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
  const source = fs.readFileSync('tests/core.test.ts', 'utf8').replace('../src/core.ts', '../dist/core.js');
  fs.writeFileSync(testFile, transpile(source, 'tests/core.test.ts'));
  const tests = spawnSync(process.execPath, ['--experimental-vm-modules', '--test', testFile, 'tests/renderer.test.cjs', 'tests/playback.test.mjs', 'tests/preview.test.cjs', 'tests/midi-import.test.mjs', 'tests/timeline.test.mjs', 'tests/mml.test.mjs', 'tests/mml-import.test.mjs', 'tests/sheets.test.mjs', 'tests/note-density.test.mjs', 'tests/instrument-operations.test.mjs'], { stdio: 'inherit' });
  process.exitCode = tests.status || (tests.error ? 1 : 0);
} finally {
  fs.rmSync(testFile, { force: true });
}
