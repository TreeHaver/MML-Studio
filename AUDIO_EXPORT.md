# Audio export

Choose **Export → Audio**, choose all instruments or the selected instrument, then choose the file type in the native Save dialog. Audio writes one mixed file for the current view. A Segment or Song exports its local projection only, including trailing rests and expanded loops. The section-sheet checkbox does not apply to audio.

The recording uses the same TimGM6mb SoundFont, SpessaSynth core and playback compiler as live playback. This includes drum mapping, extended pitch fallback, monophonic routes for overlapping note lifetimes, explicit/inherited velocities, global tempos and nested/tied loops. Playback speed, master volume, Mute and Solo are snapshotted at the start. Tempo instructions from excluded/muted instruments still control the global clock. Export does not alter the live playback engine or project.

## Formats and sound release

All output starts as stereo 44.1 kHz PCM. WAV is 16-bit PCM (RF64 automatically used if needed), MP3 is 192 kbps, OGG uses Vorbis quality 5, FLAC is lossless, M4A uses AAC at 192 kbps, and Opus uses 160 kbps. Opus encodes at its standard 48 kHz rate. The saved extension determines the codec; unsupported extensions are reported rather than receiving mislabeled bytes.

Notes end at their performance boundaries. Their release and reverb decay naturally; recording finishes after half a second below -100 dBFS. A still-audible tail is stopped after 30 seconds and reported. This affects only sound release after the performance, never the notes or timeline. Output peaks are clipped at full scale; the completion message reports clipping and suggests lowering playback volume. Playback compiler limitations and loop warnings are reported.

Rendering happens in a Node worker and streams bounded PCM chunks into an encoder process with backpressure. Cancel export and Escape cancel the job. Encoding uses a temporary file beside the destination; success replaces the destination, while cancellation/errors preserve the old file and remove temporary output. No whole-song PCM buffer is allocated.

## Modules and distribution

- `src/audio/render.ts`: DOM-free compilation, sample-accurate MIDI scheduling, synthesis and release detection.
- `src/audio/worker.ts`: streaming encoder, progress, cancellation and file completion.
- `audio-export.cjs`: main-window-owned IPC, native Save filters and worker lifetime.
- `src/export.ts`, `index.html`, `studio.css`, `preload.cjs`, `main.cjs`: UI and native bindings.
- `build-audio.cjs`: bundles `vendor/audio-worker.cjs`, enforcing the same local SF2-only decoder adapter as the existing synth bundles.
- `package-release.ps1`: includes worker, encoder and license files. No installed FFmpeg, npm modules or network are needed at runtime.

The locally validated Windows x64 encoder is the existing Gyan FFmpeg 4.4 full static build. SHA-256: `cf19f79b8ee6bc1c83438ea8f6d266496681f686cc87bf1d295126621700a1eb`. Its original license, version, build configuration and upstream source reference are in `vendor/FFmpeg-LICENSE.txt` and `vendor/FFmpeg-README.txt`. Incremental builds retain the encoder and write the worker only when generated contents change.

### Source checkout setup

`vendor/ffmpeg.exe` is ignored by Git. After a clone or pull, run `npm ci` as needed, then `npm start`. The npm `prestart` hook runs `check-ffmpeg.cjs`: a missing, empty or non-file encoder path prints a warning, the [Gyan Windows download page](https://www.gyan.dev/ffmpeg/builds/), and the exact local destination. Startup continues; editing and preview do not require FFmpeg. The hook does not download anything or open a browser automatically. It checks file presence, not encoder version or codec compatibility.

Download a Windows x64 static build (the release essentials ZIP is convenient), extract its `bin/ffmpeg.exe` into `vendor/ffmpeg.exe`, and retry audio export. When using a different build, replace `vendor/FFmpeg-LICENSE.txt` and `vendor/FFmpeg-README.txt` with that archive's LICENSE and README so packaged provenance matches the executable. Newer builds are not covered by the existing 4.4 validation above; run `tests/electron-audio-export.cjs` to check all six export formats before distributing one. Release packaging still requires and bundles the encoder; installed app users need no separate setup.

## Validation

Additional MIDI ports are initialized before rendering: create all channels, reset their controllers, assign melodic/drum roles from the owning Instruments, then apply mute and MIDI events. Otherwise the core's newly-created channels retain zeroed controllers and drum mode. Regression coverage includes a 37-route first instrument followed by a second instrument.

`node tests/run.cjs` includes `tests/audio-export.test.mjs`: loops/rests/speed, scoped boundaries and tempos, non-silent synthesis, master gain, mute, cancellation, and encoder-launch failure preserving the target.

`node node_modules/electron/cli.js tests/electron-audio-export.cjs` uses the actual UI, IPC, worker and encoder; only the OS file picker is substituted. Each format is decoded and repeated onsets/rests checked. Additional cases cover mute, Segment output, canceled Save and cancellation over an existing file. Set `MML_STUDIO_TEST_ROOT` to an absolute staged app directory to check packaged runtime files. Physical listening and manual operation of the native Save type dropdown are not claimed.
