# Project map — MML Music Studio 0.3.0

Read this file first when continuing development. This is the Electron/TypeScript editor; the earlier web and Avalonia prototypes are not the active codebase.

## Locate a change

| Concern | Primary files |
| --- | --- |
| Note and project objects | `src/model/types.ts` |
| New project, instrument defaults/colors | `src/model/project.ts` |
| Mutable editor state (selection, active instrument, viewport, gesture) | `src/state.ts` |
| Timing units and snapping | `src/music/timing.ts` |
| Tools menu, timing simplification and same-pitch overlap removal | `src/tools.ts`, `src/music/simplify-timing.ts`, `src/music/remove-overlap.ts` |
| Note names and sharp pitches | `src/music/pitch.ts` |
| Collision validation | `src/model/validation.ts` |
| Group movement and resizing math | `src/music/note-operations.ts` |
| V inheritance | `src/music/volume.ts` |
| Project JSON validation | `src/model/serialization.ts` |
| Mouse hit testing, coordinates, selection anchor | `src/geometry.ts` |
| Pointer gestures: draw, box select, move, resize, cancel | `src/pointer.ts` |
| Keyboard shortcuts and deletion | `src/keyboard.ts` |
| Internal note-group copy/paste and insertion position | `src/note-clipboard.ts`, `src/pointer.ts` |
| Gray bands, pitch rows, measure/beat grid lines | `src/rendering/grid.ts` |
| Note bodies, tint, labels, handles, selection outlines/box | `src/rendering/notes.ts` |
| Measure labels | `src/rendering/ruler.ts` |
| Piano keys and labels | `src/rendering/keyboard.ts` |
| Painting order and clipping | `src/painting.ts` |
| Canvas sizing, scrolling extent, pixel scaling | `src/viewport.ts` |
| Instruments UI, rename, color, add | `src/instruments.ts` |
| Delete/merge instrument UI, confirmation and session cleanup | `src/instrument-actions.ts` |
| Pure deletion, index remapping, merging and inherited volumes | `src/model/instrument-operations.ts` |
| Note properties panel | `src/inspector.ts` |
| Draw/select tool, grid and zoom controls | `src/toolbar.ts` |
| Undo/redo snapshots | `src/history.ts` |
| Shared edit commit and UI refresh | `src/commands.ts` |
| Save/open/new and unsaved changes prompts | `src/files.ts` |
| MS2MML export and overlap warnings | `src/export.ts`, `src/music/mml.ts`, `src/import/midi.ts` |
| Automatic MML L/V compaction, shared by views, counts and exports | `src/music/mml-optimizer.ts`, `src/music/mml.ts` |
| MIDI binary reader and pure project conversion | `src/import/smf.ts`, `src/import/midi.ts` |
| MIDI import workflow, limitations and MS2 duration rule | `MIDI_IMPORT.md` |
| DOM references, status text | `src/dom.ts` |
| Keyboard/header/row dimensions, drag threshold | `src/constants.ts` |
| Startup wiring only | `src/renderer.ts` |
| Windows runtime-only staging and portable releases | `build.bat`, `package-release.ps1`; checks: `tests/release.test.cjs`, `tests/electron-release.cjs` |
| Native Electron window and file-dialog IPC | `main.cjs`, `preload.cjs` |
| Main editor structure and styles | `index.html`, `studio.css` |
| File/Export menu dismissal | `src/chrome.ts` |
| Sky/Night palettes, resizable/collapsible panels, saved workspace | `src/appearance.ts`, `themes.css` |
| Header logo and native window icon | `assets/logo.svg`, `assets/logo.png`, `main.cjs` |
| MML pop-out styles | `style.css` |

`src/core.ts` is a compatibility export barrel for the pure model/music API, not a place to add implementations. Model/music modules do not import DOM or editor state. UI modules share the `state` object; importing modules alone does not install event handlers. The renderer entrypoint installs handlers once. Cross-module function calls are deliberate; the module-loading integration test checks that startup works.

## Small-change workflow

1. Read this map and the primary module for the requested change.
2. Read related imports only when needed; keep unrelated code untouched.
3. Edit source `.ts` files, never manually edit `dist`.
4. Run `node build.cjs`. It visits all source files, but writes only changed outputs.
5. For model edits run `npm test`.
6. For interaction/module wiring edits run `node --experimental-vm-modules --test tests/renderer.test.cjs`.
7. Save a checkpoint in `PROGRESS.md`, naming changed files, verification and the next task.
8. Deliver a ZIP. For a small update, a patch ZIP can contain only changed source/generated files with their relative paths preserved. Include all changed dependencies; include a full ZIP after structural changes.

No need to rewrite the whole app or read every module for each change. Tests simulate renderer input with a DOM/canvas stub; they do not replace a native Electron visual check.

## Stable constraints

- One instrument owns its notes and color; generated MML channels are derived, not editable model lanes. Raw MML generation/counts and a native tabbed pop-out are implemented; file export is deferred. General MIDI preview playback and format-0/1 MIDI import are implemented.
- Import has no application-imposed file-size, note, event, track or instrument count caps. Export-limit warnings belong to future export planning. Tempo instructions are positive integer BPM. MIDI import rounds fractional BPM with a conversion notice, without export-range clamping.
- Whole note = 128 integer timing units. L128 is 1; L64. is 3; L128. is invalid.
- MapleStory 2 MML lengths need not be powers of two. Keep arbitrary positive integer note lengths (e.g. 5, 7, 11 units); grid choices are editing aids, not the set of legal durations. MIDI finer than the version-2 resolution is rounded with an import warning. See MIDI_IMPORT.md before implementing MML export or changing timing.
- Grid default L4; dropdown through L128. Grid and zoom never change existing duration.
- Chords and same-pitch overlaps are allowed; MML generation reports overlap warnings without removing notes.
- Draw tool click/drag creates notes; Select tool or Shift-drag box-selects.
- Body movement requires prior selection and a four-pixel threshold. First selected note anchors group snapping. Group edits preserve relative offsets and pitches.
- Edge resizing snaps duration. Delete/Backspace and right-click delete notes.
- V instructions follow their notes, inheriting across an instrument until changed.
- JSON format `mml-studio`, version 2; unchanged by modularization.

## Known limitations / next work

Native desktop rendering and AudioWorklet PCM output were verified locally on 2026-09-06 using tests/electron-smoke.cjs; physical speaker output and native file dialogs remain unverified. TypeScript transpile-only builds are not static TypeScript checks. Gesture state currently retains a permissive type from the original rebuild; a discriminated gesture union is a separate future typing improvement.

Build compatibility: Node 22.12+; `transpile.cjs` owns the TypeScript transpiler used by both `build.cjs` and tests. `tests/run.cjs` compiles core tests before running them. No Node built-in TypeScript stripping is required.

## Playback and tempo modules (0.3.0)

| Concern | File |
| --- | --- |
| GM 1–128 display names | `src/playback/gm-programs.ts` |
| Standard Drum Kit name, GM percussion names, MS2 warning | `src/playback/drums.ts`, `DRUM_KIT.md` |
| Note-attached T constraints and global clock | `src/music/tempo.ts` |
| Compile snapshot to internal MIDI; ports, programs, note on/off | `src/playback/midi.ts` |
| Lazy SoundFont engine / AudioWorklet / sequencer | `src/playback/engine.ts` |
| Piano-key one-shot preview and status | `src/playback/preview.ts` (called by `src/pointer.ts`) |
| Decoder-free synth/worklet build | `build-audio.cjs`, `packages/sf2-only-decoder/`, `AUDIO_SECURITY.md` |
| Play / Pause / Resume / Stop, playhead | `src/playback/transport.ts` |
| Bundled GM sound bank / license | `assets/` |
| Generated browser synth / matching processor | `vendor/` (generated by build) |
| Playback timing and actual PCM synthesis tests | `tests/playback.test.mjs` |
| Preview lifecycle and native Electron smoke test | `tests/preview.test.cjs`, `tests/electron-smoke.cjs` |

Drum instruments use optional `instrument.isDrum: true` in version-2 JSON (missing/false means melodic). The preset selector offers Standard Drum Kit after the 128 melodic programs and shows the requested non-blocking MS2 incompatibility warning. Channel-10 MIDI import sets this flag; playback and key previews route drums to zero-based channel 9 with Standard Kit program 0. Each drum lane gets its own MIDI port for note isolation. Other channels remain melodic. Alternate kits/GM2 or SysEx drum routing are not implemented.

Native sound-bank loading is a fixed-path IPC in main.cjs/preload.cjs. The desktop needs no MIDI device or runtime network connection. Build bundles pinned SpessaSynth with esbuild. JSON remains version 2 with optional note.tempo and instrument.midiProgram; old files default to inherited tempo/GM Piano. Default tempo is 120; tempo accepts positive integer BPM, including values outside export ranges. T is global; simultaneous differing instructions are rejected. Playback snapshots notes, but preset changes (including undo/redo) refresh voices at the same position while preserving playing/paused state. Other musical edits are heard on Stop then Play. Playback speed/master volume and effective BPM display belong to transport.ts; shared preview/song master gain belongs to engine.ts. Native regression: tests/electron-behavior.cjs.

Timeline following, Instructions lanes and yellow tempo indicators: see TIMELINE_UPDATE.md. Primary modules: src/model/instructions.ts, src/playback/follow.ts, src/rendering/tempo.ts; tests/timeline.test.mjs and tests/electron-timeline.cjs.

## MML generation and channel text

Pure compiler: `src/music/mml.ts`. Session cache and instrument controls: `src/mml.ts`, mounted by `src/instruments.ts`, refreshed by `src/inspector.ts`. Native pop-out: `mml.html`, `src/mml-window.ts`, fixed IPC in `main.cjs` / `preload.cjs`. Session reset epoch: `src/state.ts`. Tests: `tests/mml.test.mjs`, `tests/renderer.test.cjs`, `tests/electron-mml.cjs`. See MML_GENERATION.md for byte counts, channel allocation, unsupported-data warnings and validation scope.

## Instrument deletion and merging

Expanded panels expose Delete and a Merge into destination selector. Delete confirms owned notes/events and tempo removal; deleting the final instrument leaves an empty Piano because version-2 projects require an instrument. Merge retains destination settings and transfers all source notes/events, then removes the source. Silent Instructions can merge only with other Instructions; musical lanes can merge with other musical lanes, adopting the destination preset. Timing, IDs, pitches and tempo values are retained. Original inherited volumes are materialized before merging; differing volumes at the same position produce an explicit confirmation warning because the current model has one V value per instrument/position.

Both actions stop playback, checkpoint once, clear selection/gestures and invalidate MML caches/pop-out. Surviving mute/collapse indexes are remapped and the Solo indicator is cleared. Undo/redo restores project data; instrument-count changes stop playback and reset session-only lane preferences so they cannot attach to the wrong lane. Tests: `tests/instrument-operations.test.mjs`, `tests/renderer.test.cjs`, `tests/electron-instrument-actions.cjs`.

## Desktop visual refresh

Main editor uses studio.css; style.css remains for the MML pop-out. File and Export are native details menus with outside-click/action/Escape dismissal in chrome.ts. Note fields live in the right inspector and become visible when info() sets has-selection. Instrument details are visible only on the selected lane; other lanes retain name/color and Mute/Solo, while explicit collapse hides their controls. Merge/Delete are under Instrument actions. Selection toggles row classes without rebuilding the name button. Renaming uses the dedicated Rename button. Native layout/menu/selection checks and SVG-to-PNG icon rendering: tests/electron-ui.cjs. No musical data format changes.

## MS2 drums and splitting

Fixed-sound MS2 presets and GM category mapping: src/playback/drums.ts. Optional instrument.ms2Drum metadata preserves version 2; playback/pointer map sound keys and music/mml.ts maps export to C4. Exact-note and automatic Drumkit splitting live in model/instrument-operations.ts with UI in instrument-actions.ts. See DRUM_KIT.md for category boundaries and persistence. Tests: instrument-operations.test.mjs and renderer.test.cjs.

## MML import and text paste

Pure parser and container readers: src/import/mml.ts. Existing file import IPC/filter and UI: main.cjs, src/files.ts, index.html. Native copy/paste event ownership: src/keyboard.ts; note insertion and validation: src/note-clipboard.ts. Supported syntax, conversion notices and remaining dialect/encoding limitations: MML_IMPORT.md. Tests: tests/mml-import.test.mjs and tests/renderer.test.cjs.

## Sheet limits and multipart export

Saved character-limit preference: src/sheet-settings.ts. DOM-free synchronized slicing and verified part planning: src/music/sheets.ts; compiler padding/controller support: src/music/mml.ts. Active-instrument red boundary marker: src/rendering/sheet-limit.ts via src/painting.ts. Export setting and three-choice dialog: src/export.ts, index.html, studio.css. See SHEET_LIMITS.md for counting rules, clean-cut behavior, continuation and validation scope. Tests: tests/sheets.test.mjs, tests/renderer.test.cjs, tests/electron-sheets.cjs.

## Overlap warnings and channel-density regions

src/music/note-density.ts owns identical-onset/pitch/instrument warnings and the sweep of sounding note intervals. Used by src/music/mml.ts and src/import/midi.ts. src/rendering/note-density.ts paints yellow boxes behind notes for active-instrument intervals with strictly more than ten simultaneous notes, wired in src/painting.ts. Tests: tests/note-density.test.mjs and existing MIDI/renderer tests. Sustained notes with different start times do not cause overlap warnings.

## Project names and visual song structure

Project naming: src/files.ts, src/model/project.ts, main.cjs. Optional version-2 fields: name on Project; timeSignature, section and resetMeasures on Instructions events. Pure measure/section math and export slicing: src/music/structure.ts. Inspector editing: src/inspector.ts; toolbar navigation: src/toolbar.ts; rendering: src/rendering/grid.ts and src/rendering/ruler.ts; section export: src/export.ts. See PROJECT_STRUCTURE.md for exact-start signature changes, measure reset semantics, opening segments and inherited tempo/volume. Tests: tests/structure.test.mjs, tests/renderer.test.cjs, tests/electron-structure.cjs.

## Temporary Song / Segment views

Pure bounds/projection/reconciliation: src/model/segment-view.ts. State session/save/history helpers: src/segment-session.ts, src/state.ts. View buttons, return and end boundary: src/segment-view.ts (wired by renderer.ts). The active state.project is the local editable projection; fullProject() returns the parent with explicit edits applied. Save and history must use fullProject/historySnapshot, and replacement workflows must resetSegment. Automatic clips/inherited context must never be serialized into the parent merely because a view was opened. MML, playback, exports and sheet limits read the local project; exports disable the extra section-splitting option while scoped. See SEGMENT_VIEW.md. Tests: tests/segment-view.test.mjs, tests/renderer.test.cjs, tests/electron-segment-view.cjs.
