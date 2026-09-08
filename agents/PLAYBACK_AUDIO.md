# Playback, drums and audio export

Preview and recording use the bundled **TimGM6mb.sf2** bank and pinned SpessaSynth core. The desktop loads local assets through main/preload IPC; no MIDI device or runtime network is needed. [PROJECT_MAP.md](PROJECT_MAP.md) links each audio owner and its tests.

## Live playback and key preview

Play/Pause/Resume uses a compiled snapshot of the active project or scoped view. Stop/Play picks up musical note/tempo edits. Leading rests, loop expansion, global tempos, explicit/inherited V and each original note lifetime are retained. Playback follows horizontally at 75% of the visible roll, preserves vertical scroll, suspends following on Pause and leaves the viewport in place on Stop.

Ruler seeking and Section > Go to set the playback start/seek position. Rewind/forward move five seconds. Loop elapsed time uses the expanded performance clock while the visible playhead maps to source time. Scoped playback receives an explicit end so it stops at the view boundary, including silence to that boundary.

Changing presets refreshes the snapshot's voices at the current position while preserving playing/paused state, including changes via Undo/Redo. Rapid requests are coalesced and Stop cancels pending loads. Held notes are restored on their assigned routes with original onset V and remaining duration. Voice refresh briefly pauses/re-attacks sustained notes; it is not seamless timbre morphing. Other musical edits retain Stop/Play behavior.

Keyboard click/glide previews last about 500 ms and highlight the requested key. Rapid changes replace/release the previous preview. A separate preview synth keeps keyboard auditioning independent from song playback; Instructions remain silent.

| Session setting | Behavior |
| --- | --- |
| Speed | 25–400%, default 100%; pointer dragging snaps near 50%/200%. Changes the sequencer rate, not stored T or timing. |
| Master volume | 0–100%, default 100%; applies to current/future song and preview synths. Does not change note V. |
| Mute/Solo | Applied to every derived route of each owning instrument; explicit mutes survive Solo on another instrument. Global tempos remain active. |

Speed/master controls are behind the playback-settings icon in the editing toolbar and survive Stop/Play and voice reloads within the session. The caption shows elapsed time/source BPM and, at non-100% speed, rounded effective BPM. Effective BPM outside 32–255 is highlighted without clamping playback. Audio export snapshots these settings; MIDI and MML files do not apply them.

## Voice routing and sample fallback

`src/playback/midi.ts` shares `src/music/channels.ts` with MML. Overlapping notes use distinct monophonic routes, including nested same-pitch voices, so a note-off cannot exchange their lifetimes. MIDI uses format 1 with 32 PPQ. Melodic routes avoid zero-based channel 9; drums use channel 9 on separate ports. All routes carry their owning instrument index for presets and Mute/Solo.

`src/playback/sample-pitch.ts` supplies preset-specific audible sample zones for the bundled bank. Missing low/interior/high melodic samples use an octave-equivalent sample in the same preset tuned to the requested pitch. Keyboard and song playback share this fallback. Source pitches and the sound bank remain unchanged.

Song routes have fixed tuning for their lifetime, including release tails and seek restoration. Pitch-wheel/RPN setup compensates for this bank/synth's tuning behavior. Extra tuning routes do not change MML channel counts or overlap warnings. The guaranteed project range is C0–B8 plus B-1/C9 (MIDI 11–120); V0 remains intentionally silent. Revalidate the zone table and tuning when replacing the bank or synth.

## Drum instruments

**Standard Drum Kit** maps note numbers to GM percussion instead of melodic pitch. It is supported for import/editing/preview with the requested warning: **Not a valid MS2 instrument. Available for editing and preview.** The instrument-card warning marker is informational. Channel-10 MIDI import selects Standard Kit; alternate kits reduce to Standard with a notice. Other GM2/GS/XG/SysEx drum routing is not detected.

Its preset text is always yellow. The [Vanilla instrument filter](EDITOR.md#instruments) hides it from new choices while retaining any existing kit unchanged. Fixed MS2 drums remain selectable with that filter on.

| MIDI key | Editor label | Standard Kit sound |
| --- | --- | --- |
| 36 | C2 | Bass Drum 1 |
| 38 | D2 | Acoustic Snare |
| 42 | F#2 | Closed Hi-Hat |
| 46 | A#2 | Open Hi-Hat |
| 49 | C#3 | Crash Cymbal 1 |
| 51 | D#3 | Ride Cymbal 1 |

The GM1 named map covers 35–81. Other keys remain editable and may be extensions or silence in the bank. Standard Kit uses program 0; each overlapping drum voice gets its own port/channel-9 route. Keyboard drums use the independent preview synth. Selecting a melodic preset changes the role without changing notes.

Fixed MS2 **Snare Drum**, **Bass Drum** and **Cymbals** use optional `ms2Drum` metadata. They preview keys **38, 35, 49** respectively, regardless of stored pitch, and export every note as **C4**. They do not show the Standard Kit incompatibility warning.

Split Notes moves an exact pitch to an existing musical instrument. Split Drumkit explicitly creates populated categories: bass 35/36; snare 38/40; cymbals 42/44/46/49/51/52/53/55/57/59. Other percussion stays in the source. IDs, pitches, duration and tempo survive; inherited V is materialized to preserve sound. Neither conversion runs automatically.

## Audio recording

Choose Export > Audio and selected/all-instrument scope. The native Save dialog chooses WAV, MP3, OGG Vorbis, FLAC, M4A/AAC or Opus. The **extension determines the codec**; unsupported extensions fail instead of receiving mislabeled bytes. All selected material produces one mixed file of the current view. Audio does not use section-sheet splitting.

Recording shares `compilePlayback`, expanded loops, global tempos, drum mapping, per-note lifetimes, V and sample fallback with preview. It snapshots speed, master volume and Mute/Solo at the start. For selected-instrument recording, other instruments are muted in the render plan, retaining all global tempo instructions. The live engine/project are untouched.

| Output | Encoding |
| --- | --- |
| WAV | Stereo 44.1 kHz, 16-bit PCM; RF64 automatically when needed. |
| MP3 | 192 kbps. |
| OGG | Vorbis quality 5. |
| FLAC | Lossless. |
| M4A | AAC, 192 kbps. |
| Opus | 160 kbps, standard 48 kHz encode rate. |

Synthesis begins as stereo 44.1 kHz PCM. After the musical end, natural release/reverb continues until half a second below -100 dBFS. A still-audible release tail stops after 30 seconds and is reported; musical time is not truncated by that tail limit. Output clips at full scale and reports clipping, suggesting lower master volume.

`src/audio/render.ts` compiles/validates a snapshot, schedules actual encoded MIDI at sample boundaries and streams bounded PCM chunks. Before rendering extra ports, it creates **all channels, resets controllers, assigns melodic/drum roles, then applies mutes and scheduled events**. Omitting that reset leaves new channels with zeroed controllers and drum mode; regression coverage includes a 37-route first instrument plus a second instrument.

`src/audio/worker.ts` feeds the encoder with backpressure, allowing progress/cancellation without a whole-song PCM buffer. `audio-export.cjs` owns main-window IPC, save filters and worker lifetime. Cancel/Escape stops the job. A temporary file beside the destination replaces it only after encoding succeeds; cancellation/failure preserves the prior destination and removes temporary output.

## Encoder setup

`vendor/ffmpeg.exe` and `vendor/FFmpeg-*` are ignored by Git. The npm `prestart` hook in `check-ffmpeg.cjs` checks for a nonempty regular encoder file and prints its absolute required destination if absent. Startup continues. The hook does not download, launch a browser or certify codec/version compatibility.

For a fresh Windows checkout, obtain a Windows x64 static build from the [Gyan download page](https://www.gyan.dev/ffmpeg/builds/) named by the hook. Extract `bin/ffmpeg.exe` to `vendor/ffmpeg.exe`. Keep that build's original LICENSE and README as `vendor/FFmpeg-LICENSE.txt` and `vendor/FFmpeg-README.txt` so release provenance matches the binary.

The locally validated encoder was Gyan **FFmpeg 4.4 full static**, SHA-256 `cf19f79b8ee6bc1c83438ea8f6d266496681f686cc87bf1d295126621700a1eb`. A newer/different build is not covered by that validation. Run `node node_modules/electron/cli.js tests/electron-audio-export.cjs` before distributing a replacement; it checks all six codecs through UI/IPC/worker encode/decode with the OS picker substituted. `MML_STUDIO_TEST_ROOT` can point to an absolute staged app directory for runtime validation.

`package-release.ps1` requires the encoder, worker and provenance files; installed portable releases need no separate FFmpeg or npm setup. Incremental builds regenerate the worker but retain the existing encoder.

## Dependencies and licenses

The pinned dependency versions are in [package.json](../package.json) and its lockfile: SpessaSynth wrapper 4.3.14/core 4.3.22, with the local `stb-vorbis` replacement in [packages/sf2-only-decoder/](../packages/sf2-only-decoder/). Electron/esbuild/TypeScript are development dependencies.

Windows previously blocked the upstream decoder entry point. The chosen resolution was to remove that decoder dependency from execution, without antivirus exclusions or protection changes. The fixed SF2 bank has uncompressed samples and needs no SF3/Vorbis decoder.

The local adapter provides readiness and throws an explicit unsupported-SF3 error; it contains no decoder or WASM. The package name remains an import/override key, resolving locally rather than to the upstream registry decoder. `build-audio.cjs` also rebuilds the AudioWorklet from original wrapper TypeScript embedded in the pinned package's source map, ignores embedded dependency sources, and verifies the dependency graph for **all three** bundles: renderer synth, worklet and offline worker. Never copy the upstream prebuilt processor back into `vendor/`.

| Asset | Provenance kept with runtime |
| --- | --- |
| TimGM6mb.sf2 by Tim Brechbill/David Bolton | `assets/TimGM6mb-LICENSE.txt`, `assets/GPL-2.txt`; bank distributed unchanged. |
| SpessaSynth wrapper/core | `vendor/SpessaSynth-LICENSE.txt`, `vendor/SpessaSynth-Core-LICENSE.txt`. |
| FFmpeg | Matching `vendor/FFmpeg-LICENSE.txt`, `vendor/FFmpeg-README.txt`. |
| Electron | Its distribution's license files, notices, DLLs and locales. |

SF3 decoding remains deliberately unsupported. FFmpeg only encodes application-generated PCM; it does not change sound-bank decoding. Audio dependency updates must keep the SF2 adapter in every bundle or introduce a separately reviewed replacement.

## Limits and revalidation

The MIDI compiler skips pitches outside 0–127; source notes remain stored. Its encoded tempo requires 1–0xFFFFFF microseconds/quarter, event deltas must fit MIDI variable-length timing, and derived routes must fit ports 0–127. These are preview/encoding limitations, not permission to clamp imported tempo or cap editable projects. Audio inherits this compiler path.

The bank's SHA-256 recorded for the sample-zone measurements is `c5378b62028c920cb11e4803327983fee2f2cdff5dc89c708e39da417e51c854`. Historical validation exercised 42,240 dry-synth cases (128 presets × MIDI11–120 × V1/V8/V15), frequency ratios, actual AudioWorklet PCM, multi-port routing and six-codec audio export. See PROGRESS/history for dated evidence; these figures are not a claim that every native/range test runs in `npm test`.

Current targeted regressions are mapped in PROJECT_MAP. PCM tests, codec decoding and programmatic native inputs do not establish physical listening, manual Save-type-dropdown operation or in-game MS2 playback. Revalidate range/tuning after bank or synth changes, and all codecs/cancellation/packaged runtime after encoder or worker changes.
