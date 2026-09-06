// Compatibility boundary for SpessaSynth's optional SF3 paths.
// MML Studio loads only its bundled, uncompressed SF2 bank.
// No upstream stb-vorbis implementation is included or executed.
export const StbVorbis = Object.freeze({
  ready: Promise.resolve(),
  decode() {
    throw new Error('Compressed SF3/Vorbis sound banks are disabled. Use an uncompressed SF2 bank.');
  }
});
