const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

function writeChanged(file, data) {
  if (!fs.existsSync(file) || !fs.readFileSync(file).equals(Buffer.from(data))) fs.writeFileSync(file, data);
}

module.exports = function buildAudio() {
  const options = { bundle: true, format: 'esm', platform: 'browser', target: 'chrome138', write: false, metafile: true };
  function bundle(entry, extra = {}) {
    const result = esbuild.buildSync({ ...options, ...extra, entryPoints: [entry] });
    // Every synth bundle must use our rejection adapter, never the upstream decoder.
    const inputs = Object.keys(result.metafile.inputs).map(p => p.replaceAll('\\', '/'));
    if (inputs.some(p => p.includes('node_modules/stb-vorbis/')) ||
        !inputs.some(p => p.endsWith('packages/sf2-only-decoder/index.js'))) {
      throw Error('Audio build must use the local SF2-only decoder boundary.');
    }
    return result.outputFiles[0].text;
  }
  const worker=bundle('src/audio/worker.ts',{format:'cjs',platform:'node',target:'node22'});
  fs.mkdirSync('vendor',{recursive:true});
  writeChanged('vendor/audio-worker.cjs',worker);
  const synth = bundle('./node_modules/spessasynth_lib/dist/index.js');
  // The distributed processor embeds stb-vorbis. Rebuild the wrapper from the
  // original TypeScript included in the pinned release's source map, using the
  // same installed core/adapter as the renderer. Never copy the prebuilt worklet.
  const map = JSON.parse(fs.readFileSync('node_modules/spessasynth_lib/dist/spessasynth_processor.min.js.map', 'utf8'));
  const temporary = fs.mkdtempSync(path.join(__dirname, '.worklet-build-'));
  let processor;
  try {
    map.sources.forEach((source, i) => {
      if (!source.startsWith('../src/')) return;
      const file = path.resolve(temporary, source.slice('../src/'.length));
      if (!file.startsWith(temporary + path.sep) || typeof map.sourcesContent[i] !== 'string') throw Error('Invalid worklet source map');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, map.sourcesContent[i]);
    });
    processor = bundle(path.join(temporary, 'worklet_processor.ts'));
    // Remove temporary-directory names from esbuild's source comments for
    // deterministic output and unchanged-file preservation across builds.
    processor = processor.replaceAll(path.basename(temporary), 'spessasynth-worklet-source');
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
  fs.mkdirSync('vendor', { recursive: true });
  writeChanged('vendor/synth.js', synth);
  writeChanged('vendor/spessasynth_processor.min.js', processor);
  writeChanged('vendor/SpessaSynth-LICENSE.txt', fs.readFileSync('node_modules/spessasynth_lib/LICENSE'));
};
