# Project map

Source ownership checked **2026-09-08** against all current `src/**/*.ts` files, native entrypoints, build scripts and existing test entrypoints. Application version: **0.3.0**. Saved JSON: **version 2**.

Start with the row for the requested feature, then its related imports/tests. Read [PROGRESS.md](PROGRESS.md) for recent changes and actual validation; [DEVELOPMENT.md](DEVELOPMENT.md) supplies workflow/commands. Feature documents explain behavior without duplicating this ownership inventory.

## Runtime and state flow

Electron opens `index.html`, which loads generated `dist/renderer.js`. The source composition root installs UI owners once. UI edits pass through shared commands/history; model/music helpers do not depend on DOM or editor state. Rendering/playback/MML read the active `state.project`. Inside a Song/Segment this is a local projection; Save/history reconcile it through `fullProject()`.

| Concern | Owner and boundaries |
| --- | --- |
| Main window, sandboxed browser, dialogs, project file IO, sound-bank loading, title, close handshake, MML pop-out | [main.cjs](../main.cjs); fixed IPC bridge in [preload.cjs](../preload.cjs). Audio job IPC delegates to `audio-export.cjs`. |
| Startup wiring | [src/renderer.ts](../src/renderer.ts). Install new owners here only if needed; do not accumulate feature implementations. |
| Mutable session/project, selection, gestures, zoom, lane Mute/Solo/collapse, cache reset epoch | [src/state.ts](../src/state.ts). `state.project` can be scoped; `instrumentView` is session-only. |
| Element references and footer status | [src/dom.ts](../src/dom.ts). Real IDs must exist in `index.html`; missing controls can abort startup. |
| Shared refresh and note commits | [src/commands.ts](../src/commands.ts). Coordinates title/inspector/instruments/layout and scoped reconciliation. |
| Undo/redo snapshots and hold-to-repeat buttons | [src/history.ts](../src/history.ts). Uses full-project history adapters; lane-count changes reset session indexes. |
| Pure API compatibility exports | [src/core.ts](../src/core.ts). Re-export barrel only. |

## Project data, files and scoped views

Behavior: [MUSIC_MODEL](MUSIC_MODEL.md), [STRUCTURE_VIEWS](STRUCTURE_VIEWS.md).

| Feature | Primary code | Existing tests |
| --- | --- | --- |
| Project/note fields; fresh instruments, names/colors/defaults | [model/types.ts](../src/model/types.ts), [model/project.ts](../src/model/project.ts) | [core.test.ts](../tests/core.test.ts), [structure.test.mjs](../tests/structure.test.mjs) |
| JSON validation, optional version-2 metadata, legacy Instructions recognition | [model/serialization.ts](../src/model/serialization.ts), [model/validation.ts](../src/model/validation.ts), [model/instructions.ts](../src/model/instructions.ts) | [core](../tests/core.test.ts), [timeline](../tests/timeline.test.mjs), [instrument operations](../tests/instrument-operations.test.mjs), [structure](../tests/structure.test.mjs) |
| New/Open/Import/Save, project naming, dirty comparison, save race and renderer close decision | [files.ts](../src/files.ts); native handshake/dialogs in `main.cjs`/`preload.cjs` | [renderer](../tests/renderer.test.cjs), [electron-close](../tests/electron-close.cjs), [electron-dialog-focus](../tests/electron-dialog-focus.cjs) |
| Song/Segment bounds, local projection, baseline context and explicit-edit reconciliation | [model/segment-view.ts](../src/model/segment-view.ts) | [segment-view](../tests/segment-view.test.mjs), [volume](../tests/volume.test.mjs) |
| Full-project save/history, projection sync/reset, local bounds and scoped lane deletion | [segment-session.ts](../src/segment-session.ts) | [renderer](../tests/renderer.test.cjs), [electron-segment-view](../tests/electron-segment-view.cjs) |
| Section menu visibility, Open Song/Open Segment, return controls and view-end overlay | [segment-view.ts](../src/segment-view.ts), [index.html](../index.html), [studio.css](../studio.css) | [electron-segment-view](../tests/electron-segment-view.cjs) |
| Go to section options/seek and caption Time signature editing | [toolbar.ts](../src/toolbar.ts); pure placement in [music/structure.ts](../src/music/structure.ts) | [structure](../tests/structure.test.mjs), [renderer](../tests/renderer.test.cjs), [electron-structure](../tests/electron-structure.cjs), [electron-behavior](../tests/electron-behavior.cjs) |

The Section controls now live in the header menu, but Go to/signature handlers still belong to `toolbar.ts`. `segment-view.ts` owns scope actions/visibility. Do not confuse pure `model/segment-view.ts` with the UI file of the same name.

## Input, tools and instruments

Behavior: [EDITOR](EDITOR.md), [drums](PLAYBACK_AUDIO.md#drum-instruments).

| Feature | Primary code | Existing tests |
| --- | --- | --- |
| Draw both ways, Spray, select/move/resize, right-button erase, box/move edge scrolling, pointer cancellation, ruler seek and key glide | [pointer.ts](../src/pointer.ts); hit testing/selection coordinates in [geometry.ts](../src/geometry.ts) | [renderer](../tests/renderer.test.cjs), [electron-pitch-layout](../tests/electron-pitch-layout.cjs), [electron-smoke](../tests/electron-smoke.cjs) |
| Group movement/resizing math and snap/cell placement | [music/note-operations.ts](../src/music/note-operations.ts), [music/timing.ts](../src/music/timing.ts) | [core](../tests/core.test.ts), [renderer](../tests/renderer.test.cjs) |
| Keyboard shortcuts and native clipboard-event routing | [keyboard.ts](../src/keyboard.ts) | [renderer](../tests/renderer.test.cjs), clipboard integration in [electron-instrument-actions](../tests/electron-instrument-actions.cjs) |
| Internal group copy; paste after selected end/original copy position; external MML insertion and bounds/conflicts | [note-clipboard.ts](../src/note-clipboard.ts) | [renderer](../tests/renderer.test.cjs), [volume](../tests/volume.test.mjs) |
| Note fields, effective V, tempo/signature/section/loop fields and selection refresh | [inspector.ts](../src/inspector.ts), `index.html` | [renderer](../tests/renderer.test.cjs), [electron-volume](../tests/electron-volume.cjs), [electron-loops](../tests/electron-loops.cjs) |
| Instrument cards, add/select/collapse, Rename, preset switching, session Vanilla filter and Mute/Solo | [instruments.ts](../src/instruments.ts), `state.ts`; MS2 alias/allowlist catalog in [playback/vanilla-instruments.ts](../src/playback/vanilla-instruments.ts); filtered popup and warning styling in `appearance.ts` / `themes.css` | [renderer](../tests/renderer.test.cjs), [electron-instruments](../tests/electron-instruments.cjs), [electron-ui](../tests/electron-ui.cjs) |
| Permanent Advanced Instructions card, visibility/auto-enable and last-card display | [advanced-instructions.ts](../src/advanced-instructions.ts), mounted by `instruments.ts`; file replacement reset/counts in `files.ts`, always-active Mute/Solo policy in `state.ts`, reveal on caption selection in `pointer.ts` and MML paste in `note-clipboard.ts`, layout in `studio.css` / `index.html`. Pure event detection/legacy consolidation in [model/instructions.ts](../src/model/instructions.ts), called by `model/serialization.ts`. | [electron-advanced-instructions](../tests/electron-advanced-instructions.cjs), [renderer](../tests/renderer.test.cjs), [instrument-operations](../tests/instrument-operations.test.mjs), [electron-instrument-actions](../tests/electron-instrument-actions.cjs), [electron-segment-view](../tests/electron-segment-view.cjs) |
| Instrument delete/merge/split confirmations and session cleanup | [instrument-actions.ts](../src/instrument-actions.ts) | [renderer](../tests/renderer.test.cjs), [electron-instrument-actions](../tests/electron-instrument-actions.cjs) |
| Pure instrument removal/reindex, merge, exact-pitch split, drum split and volume materialization | [model/instrument-operations.ts](../src/model/instrument-operations.ts) | [instrument-operations](../tests/instrument-operations.test.mjs), [volume](../tests/volume.test.mjs) |
| Themed swatch popup, palette, HSV/hex/RGB controls and dismissal | [color-picker.ts](../src/color-picker.ts), `studio.css`; mounted by `instruments.ts` | [renderer](../tests/renderer.test.cjs), [electron-export-formats](../tests/electron-export-formats.cjs) |
| Tool buttons, grid, zoom controls, reset, Ctrl+wheel and clear-all | [toolbar.ts](../src/toolbar.ts) | [renderer](../tests/renderer.test.cjs), [electron-pitch-layout](../tests/electron-pitch-layout.cjs) |
| Tools menu commands on the active instrument | [tools.ts](../src/tools.ts); pure conversion in [music/simplify-timing.ts](../src/music/simplify-timing.ts), [music/remove-overlap.ts](../src/music/remove-overlap.ts) | [simplify-timing](../tests/simplify-timing.test.mjs), [remove-overlap](../tests/remove-overlap.test.mjs), [renderer](../tests/renderer.test.cjs) |

## Canvas, geometry and application chrome

| Feature | Primary code | Existing tests |
| --- | --- | --- |
| Draw order, canvas clipping and playhead | [painting.ts](../src/painting.ts). Orders grid → loops → instruction bands → density → notes, then ruler/keys/captions/scope/sheet/playhead overlays. | [renderer](../tests/renderer.test.cjs), [electron-ui](../tests/electron-ui.cjs) |
| Dimensions, canvas sizing/HiDPI, scroll extent | [constants.ts](../src/constants.ts), [viewport.ts](../src/viewport.ts) | [renderer](../tests/renderer.test.cjs), [electron-pitch-layout](../tests/electron-pitch-layout.cjs) |
| Uneven pitch rows and inverse mapping; vertically scaled UI adapter | [music/pitch-layout.ts](../src/music/pitch-layout.ts), [pitch-viewport.ts](../src/pitch-viewport.ts); geometry/viewport/renderers share it | [pitch-layout](../tests/pitch-layout.test.mjs), [electron-pitch-layout](../tests/electron-pitch-layout.cjs) |
| Grid bands, sharp backgrounds, C guides, beat/measure lines | [rendering/grid.ts](../src/rendering/grid.ts) | [renderer](../tests/renderer.test.cjs), [electron-structure](../tests/electron-structure.cjs) |
| Note fill/borders/labels/handles, selection outlines/box, offscreen culling | [rendering/notes.ts](../src/rendering/notes.ts), [music/note-visibility.ts](../src/music/note-visibility.ts) | [note-visibility](../tests/note-visibility.test.mjs), [renderer](../tests/renderer.test.cjs) |
| Fixed measure ruler; row-style/piano-style keys and preview highlighting | [rendering/ruler.ts](../src/rendering/ruler.ts), [rendering/keyboard.ts](../src/rendering/keyboard.ts) | [renderer](../tests/renderer.test.cjs), [electron-pitch-layout](../tests/electron-pitch-layout.cjs), [electron-smoke](../tests/electron-smoke.cjs) |
| Instruction bands, clickable stacked captions, loop shading and yellow tempo indicators | [rendering/instructions.ts](../src/rendering/instructions.ts); [rendering/tempo.ts](../src/rendering/tempo.ts) is a compatibility re-export | [renderer](../tests/renderer.test.cjs), [electron-timeline](../tests/electron-timeline.cjs), [electron-loops](../tests/electron-loops.cjs) |
| Active-instrument yellow density regions/ruler markers and persistent red overlap onset lines | [rendering/note-density.ts](../src/rendering/note-density.ts), pure overlap locations in [music/note-density.ts](../src/music/note-density.ts) | [note-density](../tests/note-density.test.mjs), [renderer](../tests/renderer.test.cjs), [electron-mml](../tests/electron-mml.cjs) |
| Red character-limit boundary and cached sheet plan | [rendering/sheet-limit.ts](../src/rendering/sheet-limit.ts) | [sheets](../tests/sheets.test.mjs), [electron-sheets](../tests/electron-sheets.cjs) |
| File/Tools/Section/theme/playback menu dismissal and modal confirm bridge | [chrome.ts](../src/chrome.ts) | [renderer](../tests/renderer.test.cjs), [electron-ui](../tests/electron-ui.cjs), [electron-segment-view](../tests/electron-segment-view.cjs) |
| Sky/Night palettes, custom selects, panel resizing/hiding, saved workspace, piano-key style | [appearance.ts](../src/appearance.ts), [themes.css](../themes.css) | [electron-ui](../tests/electron-ui.cjs), [electron-export-formats](../tests/electron-export-formats.cjs) |
| Main DOM and responsive layout | [index.html](../index.html), [studio.css](../studio.css); separate MML window uses [mml.html](../mml.html), [style.css](../style.css) | [renderer](../tests/renderer.test.cjs) checks real IDs; [electron-ui](../tests/electron-ui.cjs) checks layout |
| Header logo and native executable/window icons | [assets/logo.svg](../assets/logo.svg), [assets/logo.png](../assets/logo.png), [assets/logo.ico](../assets/logo.ico), `main.cjs`, `build-icon.cs` | [electron-ui](../tests/electron-ui.cjs), [release](../tests/release.test.cjs) |

## Shared music and structure

Behavior: [MUSIC_MODEL](MUSIC_MODEL.md), [STRUCTURE_VIEWS](STRUCTURE_VIEWS.md).

| Feature | Primary code | Existing tests |
| --- | --- | --- |
| GUI pitch labels, numeric pitches | [music/pitch.ts](../src/music/pitch.ts). MS2 output spelling belongs to `music/mml.ts`. | [core](../tests/core.test.ts), [mml](../tests/mml.test.mjs) |
| Explicit V and per-instrument inheritance | [music/volume.ts](../src/music/volume.ts): `resolveVolumes`, `volumeAt` | [volume](../tests/volume.test.mjs), [electron-volume](../tests/electron-volume.cjs) |
| Global tempo validation/map and tick/seconds conversion | [music/tempo.ts](../src/music/tempo.ts) | [playback](../tests/playback.test.mjs), [timeline](../tests/timeline.test.mjs), [midi-import](../tests/midi-import.test.mjs) |
| Shared minimum monophonic interval partition | [music/channels.ts](../src/music/channels.ts); consumed by MML and MIDI preview | [mml](../tests/mml.test.mjs), [playback](../tests/playback.test.mjs), [volume](../tests/volume.test.mjs) |
| Identical-onset/pitch/instrument warning and >10 sounding-note sweep | [music/note-density.ts](../src/music/note-density.ts); warning used by MML and MIDI import | [note-density](../tests/note-density.test.mjs), [midi-import](../tests/midi-import.test.mjs) |
| Signatures, section lists, measure placement/reset, export slicing | [music/structure.ts](../src/music/structure.ts) | [structure](../tests/structure.test.mjs), [segment-view](../tests/segment-view.test.mjs), [electron-structure](../tests/electron-structure.cjs) |
| Nested loop validation/pairing, expanded performance, repeat ties, source/performance time mapping | [music/loops.ts](../src/music/loops.ts) | [loops](../tests/loops.test.mjs), [volume](../tests/volume.test.mjs), [electron-loops](../tests/electron-loops.cjs) |

## Import, MML and file export

Behavior and known limitations: [IMPORT_EXPORT](IMPORT_EXPORT.md).

| Feature | Primary code | Existing tests |
| --- | --- | --- |
| MIDI binary parsing/validation and project conversion | [import/smf.ts](../src/import/smf.ts), [import/midi.ts](../src/import/midi.ts); UI in `files.ts`, native bytes in main/preload | [midi-import](../tests/midi-import.test.mjs), fixture builder [midi-fixtures.cjs](../tests/midi-fixtures.cjs), [electron-midi-import](../tests/electron-midi-import.cjs) |
| MML/MS2MML/MNE/3MLE parsing, real-sheet tokens and conversion notices | [import/mml.ts](../src/import/mml.ts) | [mml-import](../tests/mml-import.test.mjs), [renderer](../tests/renderer.test.cjs) |
| Musical channel generation, exact durations, shared tempo/V, target warnings | [music/mml.ts](../src/music/mml.ts), [music/mml-optimizer.ts](../src/music/mml-optimizer.ts) | [mml](../tests/mml.test.mjs), [volume](../tests/volume.test.mjs), [loops](../tests/loops.test.mjs) |
| Per-instrument MML cache, real-time/manual updates, warning triangle navigation, pop-out sync | [mml.ts](../src/mml.ts); mounted by `instruments.ts` / `instrument-actions.ts` | [renderer](../tests/renderer.test.cjs), [electron-mml](../tests/electron-mml.cjs) |
| Native channel tabs, counts and raw clipboard copy | [mml-window.ts](../src/mml-window.ts), `mml.html`, `style.css`; fixed IPC in main/preload | [electron-mml](../tests/electron-mml.cjs) |
| Character preference and synchronized verified sheet plans/XML wrapper | [sheet-settings.ts](../src/sheet-settings.ts), [music/sheets.ts](../src/music/sheets.ts) | [sheets](../tests/sheets.test.mjs), [electron-sheets](../tests/electron-sheets.cjs) |
| Export dialog, four formats, selected/all scope, section splitting, single/parts/cancel and audio progress | [export.ts](../src/export.ts), `index.html`, `studio.css`; MIDI compiler and audio worker below | [renderer](../tests/renderer.test.cjs), [electron-export-formats](../tests/electron-export-formats.cjs), [electron-sheets](../tests/electron-sheets.cjs), [electron-audio-export](../tests/electron-audio-export.cjs) |

`src/mml.ts` is UI/cache ownership; `src/music/mml.ts` is the pure compiler. Raw copying lives in the MML window. Export includes MIDI and audio now; file export is not deferred.

## Preview and recording

Behavior, setup and dependency boundaries: [PLAYBACK_AUDIO](PLAYBACK_AUDIO.md).

| Feature | Primary code | Existing tests |
| --- | --- | --- |
| GM display names, Standard Kit warning/names, fixed MS2 drums and split categories | [playback/gm-programs.ts](../src/playback/gm-programs.ts), [playback/drums.ts](../src/playback/drums.ts) | [playback](../tests/playback.test.mjs), [instrument-operations](../tests/instrument-operations.test.mjs), [midi-import](../tests/midi-import.test.mjs) |
| Playback snapshot → MIDI, tempo/ports/presets, isolated note lifetimes, seek-held routes | [playback/midi.ts](../src/playback/midi.ts) | [playback](../tests/playback.test.mjs), [volume](../tests/volume.test.mjs), [electron-behavior](../tests/electron-behavior.cjs) |
| Preset-specific audible samples and fixed tuning fallback | [playback/sample-pitch.ts](../src/playback/sample-pitch.ts); used by MIDI and preview engine | [playback](../tests/playback.test.mjs), [electron-behavior](../tests/electron-behavior.cjs), [electron-smoke](../tests/electron-smoke.cjs) |
| Lazy SoundFont/worklet synth, independent key-preview synth, shared master gain | [playback/engine.ts](../src/playback/engine.ts) | [playback](../tests/playback.test.mjs), [preview](../tests/preview.test.cjs), [electron-smoke](../tests/electron-smoke.cjs) |
| Key-preview lifecycle/retrigger/status | [playback/preview.ts](../src/playback/preview.ts), called from `pointer.ts` | [preview](../tests/preview.test.cjs), [electron-smoke](../tests/electron-smoke.cjs) |
| Transport, seek, live preset reload, Mute/Solo routes, speed/master/effective BPM | [playback/transport.ts](../src/playback/transport.ts) | [renderer](../tests/renderer.test.cjs), [electron-behavior](../tests/electron-behavior.cjs) |
| Export delivery: one save dialog, a folder of loose files, or a single archive | [zip.cjs](../zip.cjs), [main.cjs](../main.cjs), [export.ts](../src/export.ts) | [renderer](../tests/renderer.test.cjs), [electron-sheets](../tests/electron-sheets.cjs), [electron-structure](../tests/electron-structure.cjs) |
| Rehearsal loop: the repeated stretch, its grid snapping and edge grabbing; session only, never exported | [playback/loop-region.ts](../src/playback/loop-region.ts), [rendering/loop-region.ts](../src/rendering/loop-region.ts) | [loop-region](../tests/loop-region.test.mjs), [electron-loop-region](../tests/electron-loop-region.cjs) |
| Pure horizontal follow calculation | [playback/follow.ts](../src/playback/follow.ts) | [timeline](../tests/timeline.test.mjs), [electron-timeline](../tests/electron-timeline.cjs) |
| Offline plan, encoded-MIDI clock, sample scheduling, extra-channel reset, PCM/tail/clipping | [audio/render.ts](../src/audio/render.ts) | [audio-export](../tests/audio-export.test.mjs), [electron-audio-export](../tests/electron-audio-export.cjs) |
| Streaming encode, progress/cancel, temporary-file replacement and cleanup | [audio/worker.ts](../src/audio/worker.ts), main-owned job/filter lifecycle in [audio-export.cjs](../audio-export.cjs) | [audio-export](../tests/audio-export.test.mjs), [electron-audio-export](../tests/electron-audio-export.cjs) |

## Build, assets and test infrastructure

| Concern | Files and purpose |
| --- | --- |
| Manifest / locked runtime dependencies | [package.json](../package.json), [package-lock.json](../package-lock.json). `npm start` runs prestart → build → Electron. |
| Incremental TypeScript output | [build.cjs](../build.cjs), [transpile.cjs](../transpile.cjs). `src/` mirrors into `dist/`; unchanged bytes are not rewritten. No static type-check stage. |
| Three SF2-only audio bundles | [build-audio.cjs](../build-audio.cjs), local rejection adapter [index.js](../packages/sf2-only-decoder/index.js) and [package.json](../packages/sf2-only-decoder/package.json). Generates `vendor/synth.js`, `vendor/spessasynth_processor.min.js`, `vendor/audio-worker.cjs`. |
| Optional checkout encoder warning | [check-ffmpeg.cjs](../check-ffmpeg.cjs), npm prestart. Presence check only; encoder/provenance are Git-ignored. |
| Windows stage/release/ZIP and embedded EXE metadata | [build.bat](../build.bat), [package-release.ps1](../package-release.ps1), [build-icon.cs](../build-icon.cs). Examples copy beside the release EXE, outside `resources/app`. |
| Runtime bank, logos, attribution | [assets/](../assets/), [vendor/](../vendor/). Preserve license files and encoder provenance; development docs are excluded from runtime packaging. |
| Shipped example | [Example Project/Song of Storms.json](../Example%20Project/Song%20of%20Storms.json). Release tests compare source/example bytes. |
| Normal regression runner | [tests/run.cjs](../tests/run.cjs). Builds, compiles core tests, runs explicit pure/synthesis/simulated-renderer suite list; removes temporary core output. |
| Simulated startup/input integration | [tests/renderer.test.cjs](../tests/renderer.test.cjs). Uses DOM/canvas stubs and verifies requested IDs against actual HTML. |
| Native startup / packaged content | [electron-startup.cjs](../tests/electron-startup.cjs), [release.test.cjs](../tests/release.test.cjs), [electron-release.cjs](../tests/electron-release.cjs). Release checks require a packaged build. |
| Standalone historical audit | [behavior-audit.mjs](../tests/behavior-audit.mjs), [electron-behavior-audit.cjs](../tests/electron-behavior-audit.cjs). Not in normal runner; native audit retains pre-fix assertions. Use current regressions for acceptance. |
| Local generated output | `.validation/`, `staging/`, `release/`, `releases/`, `*.zip`, `node_modules/`; ignored by [.gitignore](../.gitignore). Do not treat their older docs/output as current source. |

For native harness invocation and honest validation reporting, use [DEVELOPMENT.md](DEVELOPMENT.md#native-electron-validation). Do not equate simulated DOM, native programmatic UI, physical listening and in-game testing.
