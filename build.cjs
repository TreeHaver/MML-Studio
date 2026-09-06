const fs = require('node:fs');
const path = require('node:path');
const { transpile } = require('./transpile.cjs');
function build(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { build(file); continue; }
    if (!file.endsWith('.ts')) continue;
    const target = path.join('dist', path.relative('src', file)).replace(/\.ts$/, '.js');
    const code = transpile(fs.readFileSync(file, 'utf8'), file)
      .replace(/(from\s+['"][^'"]+)\.ts(['"])/g, '$1.js$2');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== code) {
      fs.writeFileSync(target, code);
    }
  }
}
build('src');
console.log('Built editor modules (unchanged outputs preserved).');
require('./build-audio.cjs')();
