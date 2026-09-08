# Audio dependency decision — 2026-09-06

Windows blocked the installed `stb-vorbis` 0.0.6 JavaScript entry point. No antivirus exclusions or protection changes were made.

## Research

- [CVE-2026-5317](https://github.com/advisories/GHSA-8mhm-8wmq-8793) reports an out-of-bounds write in upstream `stb_vorbis.c` through 1.22; the advisory does not identify a patched npm version. [GitHub Security Lab](https://securitylab.github.com/advisories/GHSL-2023-145_GHSL-2023-151_stb_image_h/) also documents earlier memory-safety problems. These reports do not establish the cause of this machine's Trojan detection or prove that the npm package is malicious.
- [SpessaSynth](https://github.com/spessasus/spessasynth_core) uses Vorbis for compressed SF3 samples. Our fixed TimGM6mb SF2 bank contains uncompressed samples and needs no Vorbis decoding.
- [@wasm-audio-decoders/ogg-vorbis](https://github.com/eshaz/wasm-audio-decoders) is an alternative based on libvorbis and codec-parser, rather than stb_vorbis. It would require an adapter and separate validation for compressed SF3 support. Adding a decoder is unnecessary for the current fixed-bank editor.

## Implemented resolution

Keep SpessaSynth for synthesis and MIDI sequencing, pin both wrapper (4.3.14) and core (4.3.22), and replace its `stb-vorbis` import through a local npm dependency/override. `packages/sf2-only-decoder/index.js` contains only a readiness promise and a function that throws an explicit unsupported-SF3 error. It contains no upstream decoder, WASM, network access, or decoding implementation. The package name `stb-vorbis` still appears as an import/override key; it resolves to this local boundary, not the registry package.

The upstream prebuilt AudioWorklet also embeds the decoder, so replacing only the renderer dependency is insufficient. `build-audio.cjs` rebuilds the worklet from the ten original wrapper TypeScript files embedded in the pinned package's source map. It ignores embedded dependency sources, resolves the same pinned core and local adapter as the renderer, checks both build dependency graphs, and writes deterministic bundles only when changed. It never copies the upstream prebuilt processor into vendor. The source map is read as data, not executed. SpessaSynth's license is retained.

Run `npm ci` followed by `node tests/run.cjs`. The lockfile contains no upstream stb-vorbis tarball. SF2 playback remains available; compressed SF3 decoding is deliberately unsupported. Future audio dependency updates must keep both bundles decoder-free or introduce a separately reviewed replacement. Passing tests do not constitute a general security audit of Electron or other dependencies.

## Validation

Clean lockfile installation, incremental build, automated tests (including all 128 GM presets rendering non-silent PCM), and native Electron AudioWorklet smoke testing completed locally. The native test clicks real canvas keys for three GM presets, measures PCM, and checks transport alongside preview. Physical speaker output was not independently heard.

## Offline export — 2026-09-08

The new audio worker uses the same SF2-only rejection adapter, enforced by the build dependency graph check. The bundled FFmpeg executable encodes application-generated stereo PCM; it does not replace the synth sound-bank loader or enable SF3 decoding. Its original license/build provenance accompanies the Windows runtime. See AUDIO_EXPORT.md.
