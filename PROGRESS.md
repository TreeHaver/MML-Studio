# Checkpoint — 0.3.0 General MIDI playback and note-attached tempo

## Neutral closed theme selector — 2026-09-07

The theme selector now uses the neutral surface while closed and switches to the selected/accent treatment only while its dropdown is open. Changed themes.css and this log. Technical validation confirms both state rules, a successful build and all 45 functional tests. Per user direction, no visual judgment was performed. Local only, no push.

## Automatic note-label contrast — 2026-09-07

Note labels now compare WCAG-style relative luminance contrast between the existing dark text and a light alternative, selecting the more readable color for each instrument swatch. Dark blues and blacks receive light labels; bright colors retain dark labels. Instructions use the same calculation against their fixed yellow. Changed src/rendering/notes.ts, dist/rendering/notes.js, tests/renderer.test.cjs and this log. Technical validation: successful build and all 45 tests, including dark-blue/light-label and orange/dark-label assertions. Per user direction, no visual judgment was performed. Local only, no push.

## Stable panel columns when hidden — 2026-09-07

Assigned Instruments, both resize hit areas, the editor and Note properties to explicit grid columns. Hiding one panel no longer causes the remaining grid children to shift into earlier columns and collapse the useful editor area. Changed themes.css, tests/electron-ui.cjs and this log. Technical validation: successful build, all 45 functional tests, and DOM geometry confirms the editor remains over 400 px wide while Note properties remains over 180 px after hiding Instruments. Per user direction, no visual judgment was performed. Local only, no push.

## Single-gesture select and move — 2026-09-07

Dragging an unselected note in Select mode now selects and moves it in the same gesture. Dragging an already-selected note continues to move the current group; dragging from empty space retains multi-note box selection, and Ctrl-click retains additive toggling. Changed src/pointer.ts, dist/pointer.js, tests/renderer.test.cjs and this log. Technical validation: successful build and all 45 tests, including immediate unselected-note movement. Per user direction, no visual judgment was performed. Local only, no push.

## Select menu edge spacing — 2026-09-07

Added four pixels of separation before the first select option and after the last, with six-pixel option padding and additional edge padding so the first row does not visually merge with the trigger border. Changed themes.css and this log. Technical validation confirms the rule, successful build and all 45 functional tests. Per user direction, no visual judgment was performed. Local only, no push.

## Visible history buttons and panel icons — 2026-09-07

Undo, Redo and Trash now use 36 px bordered control backgrounds with 19 px neutral Lucide icons. Removed the accent-colored bottom focus stripe from every control. Replaced the ambiguous mirrored text glyphs with Lucide PanelLeft and PanelRight: the first toggles Instruments and the second toggles Note properties. Changed index.html, themes.css, tests/electron-ui.cjs and this log. Technical validation confirms all required Lucide classes, absence of the focus stripe, successful build and all 45 functional tests. Per user direction, no visual judgment was performed. Local only, no push.

## Lucide history actions — 2026-09-07

Replaced the custom Undo, Redo and Trash drawings with the official Lucide Undo2, Redo2 and Trash2 SVG geometry and standard `currentColor` stroke attributes. Removed the forced red color from Trash so all three controls inherit the same neutral theme color. Changed index.html, themes.css, tests/electron-ui.cjs and this log. Technical validation confirms all three Lucide classes, neutral Trash styling, a successful build and all 45 functional tests. Per user direction, no visual judgment was performed. Local only, no push.

## Clear-all action and fixed-center chevrons — 2026-09-07

Added a disabled-when-empty trash button beside Undo/Redo. It shows the English confirmation “Delete all N notes and instructions from this project? You can undo this action.”, stops playback, clears every note/event as one undoable history step, and retains instruments/settings. Rebuilt dropdown indicators as symmetric chevrons inside fixed boxes so their centers do not move when rotating between closed/down and open/up states. Changed index.html, src/toolbar.ts, src/playback/transport.ts, themes.css, matching dist modules, tests/electron-ui.cjs and this log. Build and all 45 functional tests pass. Native Electron verifies confirmation text, empty-state disabling, Undo restoration, and identical arrow center coordinates before/after opening. Local only, no push.

## Refined transport icon geometry — 2026-09-07

Replaced font glyphs with consistent inline SVG transport icons. Pause now uses two rounded bars with a wider gap; Stop uses a larger rounded square; Play uses a curved triangle without sharp corners. Changed index.html, themes.css, tests/electron-ui.cjs and this log. All 45 functional tests pass, native Electron verifies six SVG controls, and the refreshed Night screenshot was inspected. Local only, no push.

## Unified animated select chevrons — 2026-09-07

Replaced generic/native dropdown arrows with a single visible CSS chevron for File, Export, Instrument actions and every main-window select. Each has a consistent 7 px stroke form, 14 px right inset and rotates upward while its control is open. Select wrappers preserve all existing change handlers and dynamically cover newly rendered instrument controls. Changed index.html, src/appearance.ts, dist/appearance.js, themes.css, tests/electron-ui.cjs and this log. Build and all 45 functional tests pass. Native Electron verifies menu chevrons, select open/close state and preserved controls; the refreshed Night screenshot was inspected. Local only, no push.

## Icon transport and empty-project guard — 2026-09-07

Replaced textual playback controls with compact Start, Rewind, Play, Pause, Stop and Forward icons. Start/Rewind/Forward seek the loaded playhead; Play is disabled when there are no audible musical notes and becomes available immediately after adding one. Changed index.html, src/playback/transport.ts, src/painting.ts, themes.css, matching dist modules, tests/renderer.test.cjs, tests/electron-ui.cjs and this log. Build and all 45 functional tests pass. Native Electron verifies the empty-project disabled state, icon labels and re-enabled Play after fixture notes are added; the refreshed Night screenshot was inspected. Local only, no push.

## Wider piano-roll scrollbar — 2026-09-07

Increased the piano-roll vertical and horizontal scrollbar tracks to 18 px and reduced the thumb border so their usable hit area is substantially larger. Changed themes.css, tests/electron-ui.cjs and this log. Native Electron confirms the view scrollbar is 18 px wide. Local only, no push.

## Consistent menu chevrons — 2026-09-07

File, Export and Instrument actions now use down chevrons while closed and rotate them upward while open. Replaced Export's unrelated diagonal-arrow icon. Changed index.html, themes.css, tests/electron-ui.cjs and this log. Native Electron verifies File and Export open states and their chevron elements. Local only, no push.

## Divider handle removal — 2026-09-07

Removed all visible divider treatment: both the decorative accent handle and the divider columns themselves are transparent. The hit areas remain draggable and keyboard-resizable but no longer show blue or light strips beneath the header controls. Changed themes.css, tests/electron-ui.cjs and this log. Native Electron confirms the pseudo-element has no content and the divider background is transparent. Local only, no push.

## Preview-key label contrast — 2026-09-07

The highlighted piano key now keeps its pitch label in dark, high-contrast text rather than inheriting the white label used by black keys. Changed src/rendering/keyboard.ts and dist/rendering/keyboard.js. Build and all 45 functional tests pass. Local only, no push.

## Root-window background coverage — 2026-09-07

Explicitly sized and colored the document root and body so no system-colored strip can show through at the window edge. The main editor root follows the active theme; the MML pop-out root uses its graphite background. Changed themes.css, style.css, tests/electron-ui.cjs and this log. All 45 functional tests pass. Native Electron verifies the Night document root is #0d0d0d and the full visual/layout test passes. Local only, no push.

## Keyboard glide, visual feedback and smooth retrigger — 2026-09-07

Holding the mouse on the piano keyboard and dragging across keys now previews each crossed pitch; the most recently previewed key lights up for the 500 ms preview duration. Preview retriggering now releases the prior sound rather than force-stopping it, removing the abrupt discontinuity that produced a click on rapid low-note repeats. Changed src/pointer.ts, src/rendering/keyboard.ts, src/state.ts, src/playback/engine.ts, matching dist modules, tests/renderer.test.cjs, tests/preview.test.cjs, tests/electron-smoke.cjs and this log. Build and all 45 functional tests pass. Native Electron verifies C#8 audio plus a C4→E4 keyboard glide in the real canvas/AudioWorklet. Local only, no push.

## High-key keyboard preview — 2026-09-07

The bundled SoundFont becomes nearly silent above C8 (MIDI 108), causing C#8 through G9 keyboard previews to appear broken. Melodic previews now trigger C8 as the source sample and apply a proportional pitch wheel, preserving the requested high pitch. Drum previews are unchanged. Changed src/playback/engine.ts, dist/playback/engine.js, tests/preview.test.cjs, tests/playback.test.mjs, tests/electron-smoke.cjs and this log. Build and all 45 functional tests pass. Native Electron clicks C#8 in the piano keyboard and measured non-silent audio (peak 0.0152). Local only, no push.

## Draw-mode paint gesture — 2026-09-07

Dragging from an empty cell in Draw mode now paints one grid-length note into every cell crossed, including cells skipped by a fast pointer movement; painted notes remain selected as one group. Click still creates one note, moving an existing selected note still moves it, and dragging its right edge still resizes it. Instructions remain one-unit silent markers. Changed src/pointer.ts, dist/pointer.js, tests/renderer.test.cjs, tests/electron-ui.cjs and this log. Build and all 44 functional tests pass. Native Electron drag across four cells verifies notes at all four cell starts. Local only, no push.

## Grid-cell click alignment — 2026-09-07

Drawing a note or setting an empty Select-mode paste location now resolves to the left edge of the rendered grid cell. Previously nearest-grid rounding sent clicks in the right half of a cell to the next cell. Movement and edge-resize retain nearest-grid snapping. Changed src/music/timing.ts, src/pointer.ts, dist/music/timing.js, dist/pointer.js, tests/core.test.ts, tests/renderer.test.cjs, tests/electron-ui.cjs and this log. Build and all 44 functional tests pass. Native Electron sends a real click into the right half of an empty cell and verifies it creates at that cell's left edge. Local only, no push.

## Hold-to-repeat history controls — 2026-09-07

Undo and Redo now apply once immediately on press, then repeat every 85 ms after a 420 ms hold. Releasing, cancelling or losing pointer capture stops the repeat; keyboard activation remains a single action. Changed src/history.ts and generated dist/history.js. Build, functional tests and native Electron history interaction check pass. Local only, no push.

## Theme selector focus refinement — 2026-09-07

Removed the oversized outer accent ring from header controls and inputs. Keyboard focus now uses a slim inset accent line instead of a second blue perimeter, while active controls keep their regular active state. Changed themes.css. Native Electron visual check passes. Local only, no push.

## Minimal M logo — 2026-09-07

Simplified the application mark to a transparent cyan musical M with its two note heads. Removed the cloud, sparkle, background tile and piano-roll bars; regenerated the native PNG window icon from the SVG. The Night palette and all workspace behavior remain unchanged. Validation: build, 43 functional tests and native Electron visual check pass. Local only, no push.

## Neutral Night theme — 2026-09-07

Added Night alongside Sky/Midnight: near-black surfaces, neutral gray controls, grid, keyboard and ruler, with grayscale UI accents. Instrument/note colors, warning semantics and the blue logo remain intact. Selection persists using the existing workspace preference key. Changed index.html, themes.css, src/appearance.ts, dist/appearance.js, tests/electron-ui.cjs and this log. Build and all 43 functional tests pass. Native Electron verifies neutral panel/canvas colors and Night restoration after reload; ui-night.png captured and inspected. Local only, no push.

## Sky/Midnight, movable dividers and sky logo — 2026-09-07

Added Sky (default light azure) and Midnight (deep blue) themes, covering main-window controls and canvas grid/ruler/keyboard/playhead. The new original SVG mark combines a musical M, note heads, a cloud and a sparkle on a clear-blue gradient; generated the native PNG from that vector. Instrument colors and project version-2 data remain unchanged.

Added draggable left/right dividers, header buttons to hide/show either panel, keyboard arrow adjustments and double-click default widths. Widths are constrained to preserve the editor, adapt when the window shrinks and restore preferred sizes when space returns. Theme, widths and panel visibility persist under mml-studio-workspace-v1 in localStorage; unavailable/malformed storage falls back safely. Scrollbars remain only where content overflows. The MML pop-out retains its separate stylesheet.

Changed: index.html, themes.css, src/appearance.ts, src/renderer.ts, src/painting.ts, src/rendering/grid.ts, src/rendering/ruler.ts, src/rendering/keyboard.ts and matching dist modules; assets/logo.svg, assets/logo.png; tests/electron-ui.cjs, PROJECT_MAP.md, PROGRESS.md. Validation: build and all 43 functional tests pass; native Electron test with software rendering verifies mouse drag with button held, hide/show, keyboard resize, default reset, theme selection and preference restoration after reload, menus/inspector, and layout at 900/1320px. Sky/Midnight screenshots were inspected. Initial synthetic drag needed a held-button modifier and capture needed completed frames; corrected test passes. Next: user trials of palette and workspace proportions. No commit/push performed.

## Desktop visual refresh and logo — 2026-09-07

Replaced the crowded main header with a compact MML Studio identity, File menu, central transport and Export menu. Introduced a graphite/mint theme and an original vector M logo with piano-roll bars; derived a 256px PNG for the native Electron window icon. Moved selected-note properties into a right-hand inspector with a contextual empty state and shortcut reference. The left list shows full sound/MML controls only for the selected instrument; remaining instruments keep name/color/Mute/Solo. Merge/Delete are collected in a collapsible Instrument actions section. Main editor styles are isolated in studio.css; the MML pop-out keeps style.css. Reduced grid contrast and added octave separators while preserving hit testing, timing and yellow tempo markers.

Changed: index.html, studio.css, assets/logo.svg, assets/logo.png, main.cjs, src/chrome.ts, src/renderer.ts, src/instruments.ts, src/instrument-actions.ts, src/inspector.ts, src/rendering/grid.ts, src/rendering/ruler.ts and corresponding dist modules; tests/electron-ui.cjs, PROJECT_MAP.md, PROGRESS.md. Validation: incremental build and all 43 existing functional tests pass. Dedicated native Electron check passes logo load, File/Export menus, outside/Escape dismissal, selected-instrument detail switching, empty/selected inspector states, action disclosure, and absence of panel/header/toolbar overflow at 900px and 1320px. Captured and visually inspected .validation/ui-900.png and ui-1320.png; result .validation/electron-ui.json. Test uses an isolated profile and software rendering; screenshot notes are an unsaved test fixture. No physical audio or in-game test performed. Local changes only, no commit/push. Next: user feedback on panel proportions, typography and logo.

## Selected-group copy/paste — 2026-09-06

Added Ctrl/Cmd+C and Ctrl/Cmd+V for selected notes/events, using a window-local snapshot clipboard. Paste defaults to the copied group's end, advances by its span for repeated pastes, and targets the active instrument. A click on empty roll space in Select mode sets a grid-aligned paste position. Group offsets, arbitrary integer durations, pitches and attached tempo are retained; original inherited volumes are materialized to avoid destination inheritance changing the copied dynamics. Pasted notes get new IDs, remain selected and form one undo checkpoint. Muted lanes, incompatible silent/musical roles and conflicting global tempo instructions reject paste without mutation. Editing input/select/textarea/contenteditable elements keeps native shortcuts; copying or pasting during a pointer gesture is ignored.

Changed: src/note-clipboard.ts, src/keyboard.ts, src/pointer.ts and corresponding dist modules; tests/renderer.test.cjs, tests/electron-instrument-actions.cjs, README.md, PROJECT_MAP.md, PROGRESS.md. Validation: incremental build and all 43 tests pass, with renderer assertions for group data, fresh IDs, inherited volume, cross-instrument paste, undo/redo, text-field behavior, muted/silent destinations and atomic tempo-conflict rejection. Native Electron verification passes keyboard-event copy/paste and undo in the actual DOM, alongside the instrument-action regressions. Native events in this test are dispatched programmatically; no physical keyboard/audio/in-game testing. Clipboard does not cross app windows or use the system clipboard. Changes remain local, with no push.

## Delete/merge instruments and organized panels — 2026-09-06

Added Delete and Merge into controls to expanded instrument panels. Delete confirms note/event and global-tempo removal; deleting the last instrument leaves an empty Piano. Merge transfers every source note/event into the destination, retaining destination name/color/preset and source timing, IDs, pitch and tempo. Original inherited volumes are resolved before combining lanes; simultaneous conflicting volumes show a confirmation warning because the model has one V per instrument/position. Silent Instructions merge only with silent Instructions. Musical merges adopt the destination sound, including its melodic/drum role, as stated in confirmation.

Both operations checkpoint once and support project undo/redo, stop playback, clear selections/gestures, remap surviving mute/collapse preferences and invalidate stale MML output. Instrument-count changes during undo/redo reset session preferences. Panels now have a consistent border/title area, separate sound/MML/action sections, a wider sidebar and keyboard focus indicators. Collapsing hides all details/actions.

Changed: src/model/instrument-operations.ts, src/instrument-actions.ts, src/instruments.ts, src/history.ts, corresponding dist modules, style.css, tests/instrument-operations.test.mjs, tests/renderer.test.cjs, tests/core.test.ts, tests/run.cjs, tests/electron-instrument-actions.cjs, PROJECT_MAP.md, PROGRESS.md. Existing renderer label expectation and two old overlap-rejection tests were updated to match the already-implemented behavior documented in earlier checkpoints; overlap validation behavior was not changed.

Validation: node tests/run.cjs passes all 43 tests and the incremental build. Regression coverage includes cancellation, deletion of the final lane, index remapping, merge in both index directions, volume inheritance/conflicts, tempo preservation, silent role protection, playback stop and exact project undo/redo. Native Electron test passes real DOM controls, collapse layout, cancel/confirm action paths (confirmation response stubbed), merge/delete/undo/redo and sidebar overflow at 1100px. Evidence: .validation/electron-instrument-actions.json and .png; screenshot visually inspected. No native confirmation-dialog clicking, physical-speaker listening or in-game MS2 validation was performed. Work is local; no GitHub push. Next: user trials of the updated instrument workflow.

## Repository setup — 2026-09-06

Initialized a local Git repository for the project. Added `.gitignore` rules for installed dependencies, local validation output, release bundles, archives/logs, and the Windows spell-check cache; source, tests, generated runtime files, bundled assets, package metadata, and documentation remain versionable.

Validation: repository initialized and initial commit created after reviewing the staged file list. No remote was configured because no repository URL was provided.

Next: add a remote with `git remote add origin <url>` and push when the destination is chosen.

Added playback/ modules (GM names, MIDI compiler, SoundFont engine, transport), music/tempo.ts, bundled TimGM6mb bank and license. Extended optional data fields, inspector, preset UI, transport buttons/playhead, native asset IPC, build bundling and tests. Version-2 JSON remains readable; older files default to Acoustic Grand Piano and 120 BPM.

Verification: build and all 12 tests pass. Tests cover tempo bounds/conflicts/moving/deleting, clock conversions, initial rests and MIDI programs/velocity, backward JSON compatibility, multiple MIDI ports, all 128 bank presets and non-silent PCM rendering for all 128. Renderer regression test exercises GM dropdown/T inspector as well. Native Electron audio device output remains unverified.

Deliverable: mml-studio-v0.3.0-gm-playback-tempo-patch.zip. Apply to modular v0.2.2, run npm install then npm start. New audio modules are isolated for future focused edits. See PLAYBACK_UPDATE.md and PROJECT_MAP.md.

## Local validation — 2026-09-06 (Windows, Node 22.12.0)

Read AGENTS.md, PROJECT_MAP.md, PROGRESS.md and PLAYBACK_UPDATE.md. No application source or project format changes.

- Standard npm launcher fails because it resolves a missing AppData/Roaming/npm/node_modules/npm/bin/npm-cli.js. Used the installed CLI at C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js.
- Ran npm install and then npm ci from the existing lockfile to restore dependencies. Full test runner invokes the incremental build; source transpilation succeeds, but synth bundling fails. Windows reports node_modules/stb-vorbis/dist/index.js contains a virus or potentially unwanted software. Security protection was not changed. Subsequent imports report the entry point missing.
- Six existing core tests pass when compiled with transpile.cjs and run separately; temporary compiled test removed. Existing simulated DOM renderer test passes (one test). These are not native UI tests.
- Existing playback suite fails during module loading because the blocked stb-vorbis entry point is unavailable; its five tests could not execute. Full build/test success is not established locally.
- Launched installed Electron against this folder. Processes started and reported responding, but no main-window title was observed. This establishes process startup only, not successful native rendering. Native interaction and physical audio output remain unverified; native-control runtime was unavailable.

Changed tracked project documentation: PROGRESS.md. Dependency installation restored node_modules; incremental build may refresh generated dist outputs, but vendor bundling did not complete. No source fixes or feature changes were made.

Next: investigate the Windows security detection and obtain a verified usable synth dependency through an approved resolution, then rerun node tests/run.cjs and native window/playback checks. Do not treat this checkpoint as a passing desktop release.

## Piano previews and decoder removal — 2026-09-06

Implemented left-keyboard clicks as 500 ms previews using the active instrument's GM preset. Preview has a separate lazy synthesizer, releases its note automatically, replaces rapid clicks, ignores stale initialization, reports failures, and leaves notes/selection/history untouched. Right-click and header clicks do not preview. Version-2 JSON and existing editor module ownership are preserved.

Removed the upstream stb-vorbis runtime dependency through a local SF2-only rejection adapter; pinned SpessaSynth core 4.3.22 alongside wrapper 4.3.14. Rebuild both renderer synth and AudioWorklet with that adapter because the upstream prebuilt worklet embeds the decoder. Compressed SF3 decoding is explicitly unavailable; the fixed SF2 bank needs none. See AUDIO_SECURITY.md for research sources, alternatives, and scope. Security protections were not changed. Corrected main.cjs to load index.html relative to its own directory, discovered when running Electron with the smoke-test entrypoint.

Changed source/config/build files: src/pointer.ts, src/playback/engine.ts, new src/playback/preview.ts, main.cjs, package.json, package-lock.json, build.cjs, new build-audio.cjs, new packages/sf2-only-decoder/package.json and index.js. Generated outputs: dist/pointer.js, dist/playback/engine.js, dist/playback/preview.js, vendor/synth.js, vendor/spessasynth_processor.min.js. Tests: tests/run.cjs, tests/renderer.test.cjs, tests/playback.test.mjs, new tests/preview.test.cjs and tests/electron-smoke.cjs. Documentation: PROGRESS.md, PROJECT_MAP.md, PLAYBACK_UPDATE.md, new AUDIO_SECURITY.md.

Actual validation: clean npm ci succeeds with no upstream decoder tarball in the lockfile. node tests/run.cjs passes all 15 tests, including non-silent PCM for all 128 bank presets, preview lifecycle/error/race checks, and simulated DOM piano hit/preset/no-edit checks. Repeated incremental build preserves generated-file timestamps. Native Electron smoke test passes after clean installation: real canvas mouse events for Piano/Violin/Flute produce nonzero AudioWorklet PCM; Play/Pause/Resume/Stop and preview during song playback work; piano clicks create no notes. Native screenshot inspected. Evidence in .validation/electron-smoke.json and .validation/electron-smoke.png. This is native renderer/audio-graph verification, not a listening test of physical speakers or a native file-dialog test.

Deliverable: mml-studio-keyboard-preview-sf2-patch.zip, with relative paths preserved. Local installation and generated files are already updated. For another copy, close the editor, extract over this v0.3.0 folder, run npm ci and npm start. This machine's standard npm launcher still points at a missing roaming CLI; validation used node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" ci and node tests/run.cjs.

Next: user listening check of preview sound/output level and desired preview duration. No further feature change was requested.

## MIDI import and permanent MS2 duration rule — 2026-09-06

Added Import MIDI with native byte-file IPC, format-0/1 PPQ parsing, pure conversion into the unchanged version-2 project, a report of approximations, unsaved-replacement confirmation, and view positioning. Cancel/invalid input/declined replacement leave the project untouched. Successful import stops song playback, resets selection/history, and marks the imported project unsaved. No new npm dependencies or audio-decoder changes.

Preserves note pitches, leading rests, arbitrary integer durations, GM programs, tracks/ports/channels, sustain-expanded durations, and same-pitch overlaps through additional instrument lanes. MIDI velocities and tempos are mapped to current V/T bounds with a report. Silent V0 tempo markers preserve clock changes in rests/held notes. Import does not grid-snap or power-of-two-quantize note lengths. Finer MIDI timing rounds to 1/128-whole-note units. Unsupported controls/percussion preview/time signatures are reported; format 2, SMPTE and non-SMF wrappers are rejected. See MIDI_IMPORT.md for exact behavior and bounds.

Recorded the user-supplied MapleStory 2 non-power-of-two duration requirement in AGENTS.md, PROJECT_MAP.md and MIDI_IMPORT.md, explicitly distinguishing integer model lengths from MML denominators and documenting the current resolution limit for future export work.

Changed files: new src/import/smf.ts and src/import/midi.ts; src/files.ts; main.cjs; preload.cjs; index.html; style.css; tests/run.cjs; new tests/midi-fixtures.cjs, tests/midi-import.test.mjs and tests/electron-midi-import.cjs; AGENTS.md; PROJECT_MAP.md; PROGRESS.md; new MIDI_IMPORT.md. Generated files: dist/files.js, dist/import/smf.js, dist/import/midi.js.

Actual validation: incremental build and all 23 automated tests pass. New regressions cover 7/11-unit durations and internal MIDI/JSON round trips, finer-time rounding, format-1 track/port/program mapping, running status, sustain/overlaps, tempos and silent markers, unsupported-event reporting, dangling notes and malformed/truncated files. Native Electron import checks pass for cancel, malformed data, declined dirty-state confirmation, successful byte IPC/conversion/report, unchanged lengths after changing grid, and starting/stopping playback. Native report/editor screenshots inspected, including the 900 px minimum window width with no page overflow. File-dialog selection was stubbed; actual native OS picker interaction and physical speaker listening were not tested. Evidence: .validation/electron-midi-import.json, midi-import-report.png and midi-import-editor.png. Final copy-only pluralization fix rebuilt after those checks.

Working folder and build outputs are already updated. Restart the editor and choose Import MIDI; no extraction or dependency installation is needed here. Optional transfer/backup ZIP: mml-studio-midi-import-patch.zip (apply only to another copy with the preceding preview/SF2 update).

Next: user trials with representative MIDI files; exact fractional timing and percussion playback remain separate future improvements, not silently promised import fidelity.

## Remove import/export-limit coupling — 2026-09-06

User correction: limits belong to future export planning, not MIDI import or editing. Removed the 16 MiB file cap in both native IPC and the reader, the 256-track / 250,000-event caps, all 10,000-note/marker checks, and the 512-instrument cap. Removed source-name truncation. Structural MIDI validation still rejects malformed files and unsupported formats; it does not apply target export rules.

MIDI BPM now preserves the exact microseconds-derived value without T32–T255 clamping or integer rounding. Positive finite decimal BPM values are accepted by the model, JSON loading and inspector. JSON remains version 2 with the same fields; older builds with narrow tempo validation may reject these broader values. The existing preview backend reports an unrepresentable manually entered MIDI tempo rather than silently wrapping its bytes; this does not prevent importing or saving the project. Imported SMF tempos round-trip exactly through the MIDI preview encoding.

Supporting large projects required removing argument-spread extrema in viewport/new-note IDs/playback, replacing quadratic collision checking with grouped interval sorting, indexing tempo attachment by start position, and compiling V inheritance once per timestamp group rather than rescanning the entire song for every note. Existing same-start V tie-breaking and overlap rules are preserved. No new export-warning UI is implemented yet; AGENTS.md, PROJECT_MAP.md and MIDI_IMPORT.md explicitly place that work in future export planning. Existing timing-resolution/velocity conversions and unsupported-event reports remain documented.

Changed source: src/import/smf.ts, src/import/midi.ts, src/music/tempo.ts, src/inspector.ts, src/model/validation.ts, src/viewport.ts, src/pointer.ts, src/playback/midi.ts, main.cjs, index.html. Generated: corresponding eight dist JavaScript modules. Tests: tests/midi-fixtures.cjs, tests/midi-import.test.mjs, tests/playback.test.mjs, tests/renderer.test.cjs, tests/electron-midi-import.cjs. Documentation: AGENTS.md, PROJECT_MAP.md, MIDI_IMPORT.md, PLAYBACK_UPDATE.md, PROGRESS.md.

Actual validation: incremental build and all 26 automated tests pass. New tests import/save/compile 130,000 notes (>250,000 events), accept >16 MiB and 513-track/instrument files, and round-trip slow, fast, fractional and boundary SMF tempos exactly. Native Electron test also passes: real file IPC handles >16 MiB; a 130,000-note project renders and starts/stops playback without argument-count exceptions. Cancel, malformed-file handling and dirty-state protection still pass. OS file selection is stubbed and physical speaker output is not a listening test. Evidence: .validation/electron-midi-import.json.

The working folder is already updated; restart the editor. Optional backup/transfer artifact: mml-studio-import-without-caps-patch.zip. Future export planning should assess destination constraints and present warnings/choices without altering the imported source project.

## Integer tempo instructions — 2026-09-06

User clarified that tempo instructions must specifically be integers. Positive integer BPM is now enforced by shared model/JSON validation and the inspector; the number input uses min=1 and step=1. Fractional MIDI-derived BPM is rounded to the nearest whole BPM with a conversion notice. No T32–T255 clamp or import size/count cap is restored. This supersedes the preceding checkpoint's fractional-tempo allowance. Existing JSON with fractional instructions is rejected rather than silently modified.

Changed: src/music/tempo.ts, src/import/midi.ts, src/inspector.ts, index.html; generated dist/music/tempo.js, dist/import/midi.js, dist/inspector.js; tests/playback.test.mjs, tests/midi-import.test.mjs, tests/renderer.test.cjs; AGENTS.md, PROJECT_MAP.md, MIDI_IMPORT.md, PLAYBACK_UPDATE.md and PROGRESS.md.

Validation: incremental build and all 26 automated tests pass, including decimal rejection in model/JSON/simulated inspector, integer MIDI rounding with notices, acceptance of 20/300 BPM, and the prior large-import regressions. Native UI testing was not repeated for this small validation/input change. Folder and generated files already updated; optional backup/transfer ZIP: mml-studio-integer-tempo-patch.zip.

## General MIDI Standard Drum Kit — 2026-09-06

Confirmed GM1's standardized channel-10 percussion map (47 keys, 35–81), separate from melodic programs. Added Standard Drum Kit as the 129th selector option, with the requested persistent non-blocking warning: Not a valid MS2 instrument. Available for editing and preview. MIDI channel-10 parts import automatically as drum instruments, with alternate kit programs mapped to Standard Kit and reported. Optional boolean isDrum is saved in version-2 JSON; existing missing/false flags remain melodic. No new dependency or bank is needed.

Song playback allocates channel 10 on distinct ports for drum lanes; melodic lanes avoid that channel. Keyboard previews use the independent synth's drum channel and report the GM percussion name. Switching to a melodic preset removes the warning and retains notes. Drum map and future export handling are documented in DRUM_KIT.md and AGENTS.md; no export restriction blocks import/edit/save.

Changed source: src/model/types.ts, src/model/serialization.ts, src/instruments.ts, src/playback/midi.ts, src/playback/engine.ts, src/playback/preview.ts, new src/playback/drums.ts, src/pointer.ts, src/import/midi.ts, style.css. Generated corresponding dist modules. Tests: tests/playback.test.mjs, tests/midi-import.test.mjs, tests/preview.test.cjs, tests/renderer.test.cjs, tests/electron-smoke.cjs. Docs: AGENTS.md, PROJECT_MAP.md, MIDI_IMPORT.md, PLAYBACK_UPDATE.md, new DRUM_KIT.md, PROGRESS.md.

Validation: incremental build and all 29 automated tests pass, including all 47 standard percussion keys producing non-silent PCM. Native Electron smoke test passes warning display, real kick key-click preview (measured peak about 0.0093), sequenced kick/snare output (about 0.00067), and prior melodic/transport checks. Native screenshot inspected; physical speakers were not independently heard. Evidence: .validation/electron-smoke.json and electron-smoke.png.

Working folder already updated; restart the editor and select Standard Drum Kit. Optional backup/transfer patch: mml-studio-standard-drum-kit-patch.zip.

## Timeline follow, Instructions and tempo indicators — 2026-09-06

Implemented horizontal playback following at 75% of the viewport while preserving vertical position and pause/resume behavior. Added selectable silent Instructions instruments, automatic routing of unbound MIDI tempos, tempo-only MIDI support and recognition of legacy silent tempo lanes. Instructions have editable integer tempo and horizontal movement; they cannot sound or consume an instrument channel. Yellow full-height roll lines and T labels mark actual global tempo changes on either notes or Instructions. JSON stays version 2 with optional isInstructions metadata. See TIMELINE_UPDATE.md.

Changed source: src/model/types.ts, src/model/instructions.ts, src/model/serialization.ts, src/import/midi.ts, src/playback/midi.ts, src/playback/follow.ts, src/playback/transport.ts, src/viewport.ts, src/music/tempo.ts, src/rendering/tempo.ts, src/rendering/notes.ts, src/painting.ts, src/instruments.ts, src/pointer.ts, src/geometry.ts, src/inspector.ts, src/files.ts; corresponding generated dist modules; index.html and style.css. Tests: tests/timeline.test.mjs, tests/renderer.test.cjs, tests/run.cjs, tests/electron-timeline.cjs. Docs: AGENTS.md, PROJECT_MAP.md, MIDI_IMPORT.md, PLAYBACK_UPDATE.md, TIMELINE_UPDATE.md, PROGRESS.md.

Actual validation: incremental build and all 34 automated tests pass. Native Electron timeline test passes Instructions selector, exact yellow canvas pixels, real sequencer playback following, preserved vertical position and pause/resume. Screenshot inspected. Evidence: .validation/electron-timeline.json and .validation/electron-timeline.png. This is native app integration, not physical speaker listening. No unrelated files were rebuilt from scratch.

Working folder and generated outputs are updated directly. Restart the editor; no patch extraction is required here. Optional transfer/backup: mml-studio-timeline-patch.zip.

## Mute, Solo and collapsible instruments — 2026-09-06

Added per-instrument Mute and exclusive Solo preview controls. Solo silences every other instrument; choosing another Solo transfers isolation; toggling the active Solo off unmutes all instruments (clears previous manual mutes). Manual Mute toggles that instrument's explicit mute; Solo isolation still takes precedence for other instruments. Changes apply to running/paused playback through the synth's channel mute API, with melodic/drum MIDI port mappings retained by the playback compiler. Muting stops held voices; unmuting lets subsequent notes sound without retriggering held notes. Piano-key previews also respect mute.

Muted notes and their yellow tempo indicators are hidden and cannot be hit, box-selected or drawn into while muted. Selection clears when mute/solo changes. Tempo instructions remain in the global playback clock even when their owner is hidden, preserving synchronization. Collapse hides preset, color, helper text and Mute/Solo controls, retaining a compact selectable name and expand arrow. Session preferences stay outside version-2 JSON and undo snapshots and reset on New/Open/successful MIDI import.

Changed source: src/state.ts, src/instruments.ts, src/geometry.ts, src/pointer.ts, src/rendering/notes.ts, src/rendering/tempo.ts, src/files.ts, src/playback/midi.ts, src/playback/engine.ts, src/playback/transport.ts, style.css; corresponding ten dist modules. Tests: tests/renderer.test.cjs and new tests/electron-instruments.cjs. Documentation: PROGRESS.md.

Actual validation: node tests/run.cjs passes all 34 tests including expanded simulated-DOM regressions for independent mute, solo transfer/off, hidden notes/hit testing/edit protection, collapse toggles, unchanged saved data/history, reset and live engine mute calls. Incremental build passes (initial sandbox dependency traversal failed; rerun outside sandbox succeeded). Native Electron integration passes actual computed collapse layout and starting/muting/solo switching/pausing/resuming playback with 17 instruments spanning melodic ports and drums. Evidence: .validation/electron-instruments.json. No PCM measurements or physical speaker listening performed for this change. Final selection-handler adjustment preserves double-click renaming and was followed by a passing full build/test run.

Working folder and generated files are updated. Optional transfer patch: mml-studio-mute-solo-collapse-patch.zip. Next: user listening/layout trials; no project-format migration is needed.

## Solo as a quick mute toggle — 2026-09-06

User correction supersedes the preceding exclusive-isolation behavior. Solo now writes ordinary mute flags for all other instruments. Clicking any Mute control clears the Solo indicator and toggles only that instrument, retaining all other mute flags. Solo A then unmute B plays/shows A and B while C and remaining instruments stay muted. Clicking an active Solo again still unmutes everything; selecting a different Solo still mutes every other instrument. New instruments follow their normal unmuted default.

Changed: src/state.ts, src/instruments.ts, generated dist/state.js and dist/instruments.js, tests/renderer.test.cjs, PROGRESS.md. Validation: node tests/run.cjs passes all 34 tests and the incremental build. Added three-instrument simulated-DOM coverage for releasing a second lane, preserving the third lane's mute, clearing Solo, live playback mute updates, restored timeline drawing, and subsequent mute/solo switching/off. Native UI/audio testing was not repeated for this correction. Folder is updated; transfer patch: mml-studio-solo-quick-toggle-patch.zip. Next: user trials of the corrected toggle behavior.

## MML generation, byte counts and native channel window — 2026-09-06

Added a DOM-free MML compiler with exact integer-duration decomposition, ties, rests, sharps/octaves, inherited volume and synchronized global tempo in every musical channel. Heap-based interval partitioning retains every note in the minimum number of non-overlapping channels. More than 10 Channels shows a non-blocking warning. Instructions contribute tempo without becoming sounding channels. Drum/unsupported tempo/pitch warnings preserve source data for later export decisions; version-2 JSON and editing/import limits are unchanged.

Instrument panels now show exact raw-string UTF-8 byte totals and channel counts, per-instrument Real time updating, manual Update MML and Open MML. Paused snapshots are marked Out of date, remain paused through undo/redo, and generate no strings until requested. Counts update during pointer edits and inspector changes. The separate native pop-out provides channel tabs, per-channel bytes, read-only raw text and Copy to clipboard for exactly the selected string. New/Open/import clear the old window contents. See MML_GENERATION.md for scope and dialect reference.

Changed source: new src/music/mml.ts, src/mml.ts and src/mml-window.ts; src/instruments.ts, src/inspector.ts, src/state.ts; main.cjs, preload.cjs, new mml.html, style.css. Generated: dist/music/mml.js, dist/mml.js, dist/mml-window.js, dist/instruments.js, dist/inspector.js, dist/state.js. Tests: new tests/mml.test.mjs and tests/electron-mml.cjs, tests/renderer.test.cjs, tests/run.cjs. Docs: PROJECT_MAP.md, MML_GENERATION.md, PROGRESS.md.

Actual validation: node tests/run.cjs passes all 38 tests and the incremental-output build. New pure tests independently decode every duration 1–400, initial rests, sharps, byte totals, volume inheritance, >10 voices, global tempo within held notes/rests, Instructions silence and compatibility warnings. Expanded simulated-DOM tests check edit counts, pause/manual refresh and pause surviving undo. Native Electron test passes real separate window creation, 11 tabs/warning, tab switching, selected-channel clipboard equality, frozen stale text, manual refresh, re-enabling updates, tab removal and clearing after New. Evidence: .validation/electron-mml.json and .validation/electron-mml.png; screenshot inspected. Sandbox dependency traversal and GPU startup failed initially; approved runs outside the sandbox passed. No in-game MS2 playback or file export was tested or added.

Working folder and generated outputs are updated. Optional transfer: mml-studio-mml-generation-patch.zip. Next: in-game compatibility trials and a separate MS2MML file-export planner; no truncation or silent export-limit clamping is applied here.

## Tempo before tied continuation — 2026-09-06

Confirmed note-bound tempo already uses the project-wide tempo map and reaches every generated musical channel through its final note, including other instruments. Corrected held-note boundary ordering from c4&t150c4 to c4t150&c4: & immediately prefixes the continuation after the tempo command. Notes remain split exactly at tempo changes; separate adjacent notes remain separate.

Changed: src/music/mml.ts, generated dist/music/mml.js, tests/mml.test.mjs, AGENTS.md, MML_GENERATION.md, PROGRESS.md. The independent test reader now rejects commands between & and its note. Added exact-string and decoded-clock regressions for two note-bound tempo changes across overlapping channels and a second instrument. node tests/run.cjs passes all 39 tests and the incremental build (approved outside sandbox for dependency traversal). Native UI and in-game playback were not repeated for this pure serializer correction. Working folder updated; transfer patch: mml-studio-tempo-tie-order-patch.zip.
## Overlap warnings and MS2MML export — 2026-09-06

Same-pitch overlapping notes now remain in one instrument during MIDI import and editing; validation no longer rejects them. Import and generated MML show non-blocking warnings because MS2 may behave unexpectedly. Added Export Selected instrument to MS2 and Export Project controls. They write the documented XML `<ms2>` format with one melody and only non-empty numbered chords. Exports over 10,000 bytes require the requested confirmation; project export checks every instrument before opening save dialogs.

Changed: src/model/validation.ts, src/import/midi.ts, src/music/mml.ts, new src/export.ts, src/renderer.ts, main.cjs, preload.cjs, generated dist modules, PROJECT_MAP.md, PROGRESS.md. Incremental build was attempted but sandbox dependency traversal remains blocked by the known esbuild/spessasynth access issue. Full tests should be rerun outside the sandbox when usage allows.
## File action placement and project labels — 2026-09-06

Moved Export Selected instrument to MS2 and Export Project into the header beside New/Open/Import/Save. Renamed the end-user labels Open JSON and Save JSON to Open Project and Save Project; JSON remains the underlying storage format.

Changed: index.html, src/export.ts, generated dist/export.js and dist/renderer.js, PROGRESS.md. Focused source transpilation completed; no behavior changes to export or project serialization.
## Explicit per-instrument character count — 2026-09-06

Clarified the instrument row and MML pop-out labels as “Instrument character count”. The value is generated from that instrument’s channels only; no notes or channels from other instruments are included. Added a focused regression for instrument-local byte totals.

Changed: src/mml.ts, src/mml-window.ts, generated dist/mml.js and dist/mml-window.js, tests/mml.test.mjs, PROGRESS.md. Build/test follow-up remains subject to the known sandbox esbuild dependency access restriction.
## Closable MML pop-out — 2026-09-06

Made the native MML window explicitly closable and cleared its retained payload on close. The main editor is also explicitly closable; closing all windows can now terminate Electron normally instead of leaving a child window or terminal process alive.

Changed: main.cjs, PROGRESS.md. Native close-button verification remains to be rerun when the Electron test runner is available.
## Main window close after MIDI import — 2026-09-06

Removed the renderer `beforeunload` cancellation that could block Electron’s native main-window close after an import marked the project dirty. The native X now closes the editor consistently; project save/open/import prompts remain owned by their explicit actions.

Changed: src/files.ts, generated dist/files.js, PROGRESS.md. Focused source transpilation completed; native close-button verification remains pending.
## MS2 drum presets and note splitting — 2026-09-07

Added Snare Drum, Bass Drum and Cymbals presets. Every stored pitch on these lanes previews/plays the Standard Kit key D2 (38), B1 (35), or C#3 (49), respectively; generated MML and MS2MML export use only C4. Original note pitches remain editable and save unchanged. Version-2 JSON adds optional ms2Drum: snare/bass/cymbals; invalid values or conflicting drum-kit/Instructions flags are rejected. Standard Drum Kit retains its non-blocking MS2 warning.

Instrument actions now offers Split Notes with a note-name input and existing musical destination selector. It moves all exact-pitch matches without deleting the source instrument. Standard Drum Kit alone also offers Split Drumkit, creating only populated MS2 categories: bass keys 35/36, snare keys 38/40, cymbal keys 42/44/46/49/51/52/53/55/57/59 (including hi-hats and ride bell). Side stick, clap, toms and other percussion remain in the source. Automatic splitting creates new category instruments even when similarly named lanes already exist; use Split Notes to target an existing lane. Both actions preserve IDs, timing, original pitches, tempo and resolved inherited volumes, stop playback, and checkpoint once. Exact splitting warns before combining differing simultaneous destination volumes. No-match splits leave history/data unchanged.

Changed source: src/playback/drums.ts, src/playback/midi.ts, src/pointer.ts, src/model/types.ts, src/model/serialization.ts, src/model/instrument-operations.ts, src/music/mml.ts, src/instruments.ts, src/instrument-actions.ts; corresponding eight generated dist modules; studio.css. Tests: tests/instrument-operations.test.mjs and tests/renderer.test.cjs. Documentation: DRUM_KIT.md, PROJECT_MAP.md, PROGRESS.md. Rename input detection was scoped to the rename field so the new split textbox does not block renaming.

Actual validation: node tests/run.cjs passes all 48 tests and the incremental-output build, including existing SoundFont PCM checks. The initial sandbox build failed at known esbuild dependency traversal; approved execution outside the sandbox passed. New tests cover persistence/rejection, decoded MIDI percussion keys, C4 MML, exact split inheritance and conflict detection, category coverage/empty-category omission, simulated-DOM fixed previews, real handler wiring, and undo. Updated stale renderer harness assumptions to the current folder's existing UI (microtask scheduling, inline rename/icon labels, separate Spray tool, combined Play/Pause, and current Solo isolation); no unrelated product behavior was changed. No native UI, physical-speaker listening or in-game MS2 test was performed.

Working folder and generated files are updated. Transfer artifact: mml-studio-ms2-drums-patch.zip. Next: native UI/listening and in-game export trials.

## MML import and grid text paste — 2026-09-07

Implemented common MML parsing, MS2MML XML, 3MLE Channel sections and the supplied MNE multi-part format. File > Import MIDI / MML uses the existing import workflow, reports conversion notices, preserves version-2 JSON and applies no export caps. MNE names and GM instruments are retained. Unsupported ancillary settings, volume-model limitations and fractional timing rounding are reported. Unknown musical commands fail atomically. See MML_IMPORT.md for supported syntax and remaining dialect/encoding limitations.

Grid paste now receives native clipboard text, verifies/parses it, and inserts notes in the active instrument with selection, fresh IDs and undo. Internal copy/paste uses a custom clipboard marker; text inputs retain ordinary editing. Unbound tempos become silent Instructions events; conflicting tempo pastes leave the project unchanged. Fixed an existing import scroll assumption for an empty first instrument.

Changed: src/import/mml.ts (new), src/files.ts, src/note-clipboard.ts, src/keyboard.ts; corresponding four dist modules; main.cjs, index.html; tests/mml-import.test.mjs (new), tests/renderer.test.cjs, tests/run.cjs; MML_IMPORT.md, PROJECT_MAP.md, PROGRESS.md.

Actual validation: node tests/run.cjs completed the incremental-output build and all 54 automated tests passed. Build initially hit the known sandbox dependency traversal issue; approved execution outside the sandbox passed. Regressions cover containers, malformed strings, arbitrary denominators, tied tempo changes, volume/persistence, >20,000 notes and >10 channels, simulated clipboard insertion and invalid-text preservation. Directly parsed H:/Downloads/gas_station_third_sanctuary.mne: 10,730 musical notes across all 10 instruments. Native Electron file dialogs/clipboard, physical audio and in-game playback were not tested. Next: native clipboard/dialog trials and additional real-world dialect/encoding fixtures. Transfer artifact: mml-studio-mml-import-patch.zip.

## Rename button only — 2026-09-07

Removed the instrument-name double-click rename handler. The dedicated Rename button retains the existing inline rename behavior. Updated the existing renderer rename regression to use that button and corrected the project map.

Changed: src/instruments.ts, generated dist/instruments.js, tests/renderer.test.cjs, PROJECT_MAP.md, PROGRESS.md. Actual validation: incremental build and node --experimental-vm-modules --test tests/renderer.test.cjs passed (simulated DOM, including button-driven rename). Native UI testing was not repeated. Transfer patch: mml-studio-rename-button-only-patch.zip.

## Configurable sheet limit, red timeline boundary and multipart export — 2026-09-07

Added Export > Character limit, a persistent positive-integer application setting defaulting to 10,000 combined raw MML characters per instrument. The active instrument shows its first planned sheet boundary in red and recalculates from current musical data, including edits and global tempo changes, independently of paused MML snapshots. No import/edit/project-save limits or JSON migration were introduced.

Oversized exports ask “Do you still wish to export?” with the requested single file / parts / No choices. Parts cut all channels at a common time, favor clean boundaries within a quarter note, clip held notes and continue their remaining duration in the next file, restore tempo/volume/octave and pad channel endings for synchronization. Every generated part respects the selected limit including controllers/rests; impossible tiny limits report an error. Source notes are unchanged. All-instrument export uses the same per-instrument choice. Fixed XML chord numbering to index attributes. See SHEET_LIMITS.md for conservative search and separate-file continuation behavior.

Changed source: src/music/mml.ts, new src/music/sheets.ts, new src/sheet-settings.ts, new src/rendering/sheet-limit.ts, src/painting.ts, src/export.ts; six corresponding dist modules; index.html, studio.css; new tests/sheets.test.mjs and tests/electron-sheets.cjs, tests/renderer.test.cjs, tests/run.cjs; SHEET_LIMITS.md, MML_GENERATION.md, PROJECT_MAP.md, PROGRESS.md. Compiler overlap detection now uses sorted pitch end times rather than a quadratic scan, supporting interactive planning on large imports.

Actual validation: incremental-output build and all 59 automated tests pass via node tests/run.cjs (approved outside sandbox for dependency access). Independent decoded-output tests cover polyphony, inherited volume, global tempo, arbitrary durations, clean/forced cuts, rest-only portions, equal-limit files and tiny-limit rejection; simulated renderer tests cover live marker changes and export choices. Native Electron integration passes exact red canvas pixels, marker changes, saved setting, all dialog choices and actual IPC file writes; OS save picker was stubbed. Screenshot inspected. Evidence: .validation/electron-sheets.json and .validation/electron-sheets.png. No in-game MS2 or physical audio check was performed.

Supplied MNE first instrument: 14,739 raw characters; at default 10,000, planner produced intervals [0,17122) and [17122,22192), with 9,993 and 3,745 characters respectively (about 20 ms measured locally for planning). Working folder and generated outputs updated. Full source/application bundle: mml-studio-sheet-limits-full.zip (excludes node_modules, prior archives, release bundles and validation scratch files). Next: in-game sheet playback trials.

## Exact-onset overlap warnings and yellow crowded regions — 2026-09-07

Corrected MML and MIDI import warnings to the user definition: same start time, same pitch, same instrument. Same-pitch sustained notes starting at different times no longer warn. Detection uses source pitches before fixed MS2 drum mapping. Removed stale validation messages implying overlap is an editing error. Musical data and version-2 JSON are unchanged.

Added yellow outlined/shaded timeline boxes behind notes for the selected musical instrument's regions with strictly more than ten simultaneous notes. The interval sweep handles touching endpoints without phantom extra voices and merges contiguous crowded spans. Regions update after edits, additions/deletions and instrument changes; scroll/zoom position them correctly. Instructions events are excluded.

Changed: new src/music/note-density.ts and src/rendering/note-density.ts; src/music/mml.ts, src/import/midi.ts, src/painting.ts, src/commands.ts, src/model/serialization.ts and their seven generated dist modules; new tests/note-density.test.mjs, tests/midi-import.test.mjs, tests/renderer.test.cjs, tests/run.cjs; AGENTS.md, PROJECT_MAP.md, MML_GENERATION.md, PROGRESS.md.

Actual validation: incremental build and all 61 tests pass via node tests/run.cjs (approved outside sandbox for dependency access). Tests cover warning semantics, source drum pitches, exact >10 regions and endpoint handling, and simulated-DOM yellow-box geometry, editing and instrument switching. Directly checked H:/Downloads/Song of Storms.json: 69 notes, five generated channels, 328 characters, no warnings and no crowded regions. Native Electron visual checks were not repeated for this change. Transfer patch: mml-studio-overlap-density-patch.zip.
## Project names, time signatures, sections and measure resets — 2026-09-07

Implemented the Project name field with undo, persistence and NAME.json as the native save suggestion. New and legacy unnamed projects display Untitled; imports adopt their source filename. Suggested filenames sanitize filesystem-invalid characters and reserved Windows names without changing project metadata.

Instructions now expose optional Time signature, Section and Reset measure count fields. Signatures take effect at the marker's exact start: a marker at an existing measure boundary changes that same measure. Off-boundary changes open a measure there. Named sections appear on the ruler and in toolbar navigation; blank names do not create sections. Reset off keeps existing numbering/alignment; reset on makes the named marker measure 1 and realigns the grid there, using the current signature. Visual metadata stays in version-2 JSON and does not affect generated MML or playback. New silent markers start without explicit tempo; users can still add tempo instructions. See PROJECT_STRUCTURE.md for persistence and boundary details.

Export has a sections-as-separate-song-sheets toggle for selected/all instruments. Named sections become ordered separate files; pre-section music remains as Opening. Held notes crossing boundaries retain their remaining durations, and tempo/volume inheritance is restored in each segment. Existing character-limit choices work within each section. Empty musical instruments and Instructions are silently skipped in each exported segment. Source project data remains unchanged.

Changed source: src/model/types.ts, src/model/project.ts, src/model/serialization.ts, src/model/validation.ts, new src/music/structure.ts, src/files.ts, src/commands.ts, src/inspector.ts, src/toolbar.ts, src/export.ts, src/instruments.ts, src/pointer.ts, src/rendering/grid.ts, src/rendering/ruler.ts, src/rendering/notes.ts; corresponding incremental dist outputs; main.cjs, index.html, studio.css. Tests: new tests/structure.test.mjs and tests/electron-structure.cjs, tests/renderer.test.cjs, tests/run.cjs. Docs: new PROJECT_STRUCTURE.md, PROJECT_MAP.md, PROGRESS.md. Pre-existing unrelated workspace modifications were retained.

Actual validation: node tests/run.cjs passes all 64 tests and the incremental-output build. Initial sandbox esbuild traversal failed; approved execution outside the sandbox passed. Added regressions cover persistence/malformed data, exact-start 3/4 and 6/8 changes, off-boundary reset, blank/non-reset sections, scrolled measure numbering, unchanged musical MML, held-note/tempo/volume slicing, empty-lane omission, naming/undo/save, inspector edits and toolbar navigation. Native Electron tests/electron-structure.cjs passes actual field handlers, scroll navigation, 1320/900px header bounds, named JSON save and section MS2MML writes. Native save picker was stubbed; actual saved files were checked. Final screenshot inspected after separating section labels from measure numbers. Evidence: .validation/electron-structure.json and .validation/electron-structure.png. No physical audio or in-game MS2 playback test was performed.

Working folder and generated outputs updated. Full application/source transfer archive: mml-studio-project-structure-full.zip (excludes installed dependencies, previous release bundles, Git data and validation scratch files). Next: user trials of multi-song projects and in-game section playback.

## Text-field focus after import and modal dialogs — 2026-09-07

User reported that all text fields could stop accepting clicks/typing after imports until Alt-Tab restored focus. Replaced the desktop's Chromium window.confirm implementation with a parented native Electron confirmation through a fixed preload IPC. Existing synchronous confirm/cancel semantics and unsaved-change protection remain intact; Cancel is the default. All native open/import/save/export dialogs now explicitly return focus to the main window and its web contents in a finally block, including cancellation. This addresses the suspected Windows modal-dialog focus handoff without changing text-field behavior or project data.

Changed: main.cjs, preload.cjs, src/chrome.ts, generated dist/chrome.js, new tests/electron-dialog-focus.cjs, PROGRESS.md. Actual validation: incremental build and all 64 existing automated tests pass via node tests/run.cjs (approved dependency access), and node --check main.cjs passes. New native Electron regression passes real mouse clicks and keyboard character input in Project name, Character limit, Time signature and Section after canceled/accepted import, declined/accepted unsaved-change confirmation, report closure and canceled save. OS dialogs are stubbed and deliberately blur the window to test focus restoration; real file IPC, MML import, renderer controls and typing are exercised. The original intermittent behavior was not reproduced with an actual OS picker. Evidence: .validation/electron-dialog-focus.json. Initial test harness used an unsupported webContents.blur API; corrected to BrowserWindow.blur before the passing run. The test also caught and fixed premature synchronous IPC reply delivery before acceptance was known.

Working folder updated. Fully exit and restart the editor because main/preload changes do not apply to an already running window. Transfer patch: mml-studio-dialog-focus-patch.zip. Next: user confirmation that imports no longer require Alt-Tab.

## Section playback, live voices, MIDI signatures and playback controls — 2026-09-07

Section selection now seeks active/paused playback or parks the start position for Play; Stop then Play returns to the selected section. The former static time-signature caption is an editable current-signature field, defaulting to 4/4. It follows the playhead or left visible timeline position. Editing captures that position on focus, updates/creates silent Instructions metadata, validates input, supports undo/save, and leaves version-2 JSON unchanged.

MIDI FF 58 signatures now import as silent Instructions markers, including explicit 4/4 and signature-only files. Musical notes never carry imported signatures; coincident unbound tempo markers are reused. Position rounding, last-event-wins conflicts, unsupported denominators finer than 1/128 and nonstandard notated scaling are reported. Malformed signature payloads and zero numerators fail validation. No import/export-limit caps were added.

Tempo, signature, section and reset captions now share floating bordered text boxes below the measure bar. Nearby captions stack, long labels are ellipsized to the viewport, and full text remains in the inspector. The measure bar contains only measure numbers/lines; yellow global tempo indicators still extend down the timeline.

Changing an instrument preset refreshes playback at its current position without requiring the user to Stop/Play. Musical/drum/Instructions routing, rapid changes, paused updates, Stop during loading and voice undo/redo are handled. Held notes are restored with original onset volume and remaining duration; earlier music remains available when rewinding. Refreshing voices briefly reloads the sequence and re-attacks held notes, rather than promising seamless timbre morphing. Other musical edits retain existing snapshot behavior.

Added Playback speed (25–400%, default 100%) and Playback Volume (0–100%, default 100%) sliders. Pointer speed changes snap within three percentage points of 50%/200%; keyboard stepping can leave those values. Speed multiplies the sequencer clock and leaves source tempo, notes and exports unchanged. At non-100% speed, smaller raised Effective BPM follows the true BPM and shows Out of bounds! below 32 or above 255; it warns without clamping. Volume is a shared master gain for both song playback and key previews, including already sounding audio and later synth initialization. These playback preferences are session-only.

Changed source: src/toolbar.ts, src/painting.ts, src/music/structure.ts, src/instruments.ts, src/history.ts, src/playback/transport.ts, src/playback/engine.ts, src/playback/midi.ts, src/import/midi.ts, src/import/smf.ts, src/rendering/ruler.ts, src/rendering/tempo.ts; corresponding 12 incremental dist outputs; index.html, studio.css. Tests: tests/renderer.test.cjs, tests/midi-import.test.mjs, tests/playback.test.mjs, tests/preview.test.cjs, new tests/electron-behavior.cjs. Docs: PROJECT_MAP.md, PROJECT_STRUCTURE.md, MIDI_IMPORT.md, PLAYBACK_UPDATE.md, PROGRESS.md. Pre-existing unrelated workspace changes were retained.

Actual validation: final node tests/run.cjs passes the incremental-output build and all 67 automated tests, including existing SoundFont PCM checks. New coverage includes silent MIDI signatures/persistence/malformed events, held-note routing/velocity/boundaries, real renderer handler wiring, live and paused preset changes, coalescing/cancellation/undo, section seek/restart, signature editing, floating-label geometry, speed limits/snaps/effective BPM and shared master gain. Initial sandbox esbuild dependency traversal failed; approved dependency access passed. Native tests/electron-behavior.cjs passes section position, live/paused held-note AudioWorklet PCM, rewind, 400% speed clock advancement, 0% master silence/50% restored PCM, and responsive control bounds at 900px. Screenshot inspected. Evidence: .validation/electron-behavior.json and .validation/electron-behavior.png. Native GPU helper startup required approved execution outside the sandbox; an initial test-script variable redeclaration was corrected. No physical-speaker listening, OS file-dialog or in-game MS2 playback check was performed for this patch.

Working folder and generated files updated. Transfer patch: mml-studio-playback-behavior-patch.zip. Restart the editor to load the updated renderer. Next: user listening trials, especially voice-change transitions and dense instruction captions.

## Temporary Song and Segment views — 2026-09-07

Added Open Song / Open Segment buttons for the named section under the playhead. Song boundaries use named reset-to-1 markers and ignore intervening Segments; Segment boundaries stop at the next named marker of either kind. The final view ends at the last note/instruction end. Entering stops playback and rebases the local timeline/playhead to zero. A view badge sits beside Project name with Return to Project. Songs containing Segments retain section skipping; other scoped views hide the dropdown. Returning translates the playhead into full-project time and clears stale navigation/paste positions.

The view is an editable temporary project projection with inherited tempo, time signature and initial lane volumes. MML generation runs again on this projection: channels are allocated afresh, character counts are accurate for the local notes, and the red limit line is recalculated. Playback honors the fixed view end, including silence before the next boundary. Scoped exports treat the view as the entire project, use only in-range events plus inherited starting context, prefix filenames with the view name, and ignore/disable the separate-sections checkbox while scoped. Existing single/parts limit choices still apply.

User clarified that edits/deletions of crossing notes must affect only the portion inside the view. Automatic clipping/context is compared against an unedited baseline; simply entering, exporting, saving or leaving does not cut the parent notes. Explicit edits create the necessary parent fragments, retaining outside timing/pitch/onset volume. Committed edits rebuild the projection so inheritance remains correct after instruction/note deletion. Save always writes the full parent project. Full-project undo/redo works inside views and after returning; scope changes themselves do not add undo entries. View boundaries remain fixed while open; use Return to Project for edits extending across them or to recalculate bounds after changing markers. Version-2 JSON is unchanged.

Shared instrument settings remain shared. Clearing a lane in a view removes only its local notes/events; scoped merges/splits preserve outside notes and source lanes. New/Open/Import clear the temporary view only after successful replacement. No import/export-limit restrictions were added. Details and architecture are documented in SEGMENT_VIEW.md.

Changed source: new src/model/segment-view.ts, src/segment-session.ts, src/segment-view.ts; src/state.ts, src/commands.ts, src/history.ts, src/pointer.ts, src/files.ts, src/instrument-actions.ts, src/note-clipboard.ts, src/export.ts, src/toolbar.ts, src/viewport.ts, src/painting.ts, src/renderer.ts, src/playback/midi.ts, src/playback/transport.ts; corresponding 17 generated dist modules; index.html and studio.css. Tests: new tests/segment-view.test.mjs and tests/electron-segment-view.cjs, tests/renderer.test.cjs, tests/run.cjs, tests/electron-behavior.cjs. Docs: new SEGMENT_VIEW.md, PROJECT_MAP.md, PROJECT_STRUCTURE.md, PROGRESS.md. Pre-existing unrelated workspace changes were preserved.

Actual validation: final node tests/run.cjs passes the incremental-output build and all 72 automated tests (approved dependency access for the known esbuild sandbox restriction). Added regressions cover Song/Segment bounds, inherited context, unchanged parent round trips, partial-note edits/deletion, unique IDs, lane routing, nested navigation, history across views, pointer creation, boundary rejection, instruction deletion/reinheritance, save/export scope, freshly optimized channels and local limit geometry. Native tests/electron-segment-view.cjs passes actual renderer handlers and JSON/MS2MML IPC file writes (OS picker stubbed), exact red canvas pixels, parent preservation/partial edits/undo, next-to-name badge and a 900px header. Native fixture: album >10 channels, scoped Solo 2 channels and 27 raw MML characters; exported text exactly equals view-generated MML. The first native run exposed the gray end boundary covering the red limit at the same position; painting order was fixed. Screenshot inspected; evidence: .validation/electron-segment-view.json and .validation/electron-segment-view.png.

Existing native tests/electron-behavior.cjs also passes live/paused voices, held-note PCM, rewind, playback speed, master gain and responsive controls after integration. Its timing assertion initially sampled before asynchronous Worklet seek acknowledgement; the harness now settles first and measures actual elapsed time rather than assuming timer punctuality. No physical-speaker listening or in-game MS2 check was performed.

Working folder and generated outputs are updated. Restart the editor to load Segment View. Full source/application transfer bundle: mml-studio-segment-view-full.zip (excludes installed node_modules, previous ZIPs/release bundles, Git data and validation scratch files). Next: user trials with real album projects and in-game scoped exports.

## Automatic MML length and volume compaction — 2026-09-07

Added pure optimizeInstructions() in src/music/mml-optimizer.ts, called for every generated channel by generateMml(). A backwards dynamic program chooses the cheapest default-length changes for the compiler's existing exact duration tokens. It omits matching length suffixes, uses implicit L4 initially, retains dots on notes/rests rather than L commands, and places any L change before the tied continuation's &. This optimizes default-length selection; it does not claim globally minimal duration decomposition or channel assignment.

Generated V commands now omit redundant values, including the implicit initial V8. Actual changes, V0 silence and returns to earlier volumes remain intact. Per the user's clarification, optimization touches only generated MML strings: explicit instrument/note volume settings, repeated volume instructions and all project data remain stored unchanged. Version-2 JSON and playback dynamics are unchanged.

Existing live edit refresh, manual Update MML, Song/Segment entry, export and sheet-limit planning all share this compiler pass; character counts therefore use compact output. The existing user-controlled Real time updating pause remains respected. Example: sixteen consecutive eighth-unit notes at V11 now produce t120o4v11l16 followed by sixteen c characters: 27 characters instead of 57. Views independently choose their own length defaults and inherit starting volume as before.

Changed: src/music/mml-optimizer.ts (new), src/music/mml.ts, corresponding dist/music modules, tests/mml.test.mjs, tests/sheets.test.mjs, tests/segment-view.test.mjs, PROJECT_MAP.md and PROGRESS.md. Independent test readers now understand L and omitted lengths while enforcing tie syntax. The leading-silence split fixture was lengthened because optimized rests now fit in fewer characters.

Actual validation: node tests/run.cjs passed the incremental-output build and all 76 tests, including simulated renderer refresh/view/export/limit checks and existing audio tests. Initial sandbox esbuild traversal failed; approved dependency access passed. Added exhaustive minimum-cost checks over 729 mixed-length phrases, timing checks for every integer duration 1–400, volume/dynamics preservation, view recompilation after edits and matching sheet counts. After the user's clarification, added explicit assertions retaining repeated project volumes; node --test tests/mml.test.mjs passed all 9 tests. No native UI or in-game playback test was performed for this pure compiler patch.

Working folder and generated files updated. Transfer patch: mml-studio-mml-optimizer-patch.zip; apply over the current Segment View version and restart the editor. Next: user trials with dense imported projects and MS2 exports.

## Tools menu: Simplify Timing — 2026-09-07

Added a Tools dropdown in the editor toolbar with Simplify Timing, L4/L8/L16/L32/L64 choices (initial L64), and Apply to selected instrument. This is an explicit project edit on all notes of the active musical instrument, independent of note selection and the drawing grid. Starts round down and ends round up to multiples of 128/L model units, simplifying implicit rests too. Durations can remain multiple grid cells; this does not force every note to exactly one cell.

When expansion would overlap a previously non-overlapping later note, including a different pitch, the first end rounds down instead. Existing chords and overlaps are retained. User clarified that a note which would become zero length must retain its original timing and be reported as skipped. Following notes are also preserved/reported when rounding their starts would collide with such a retained note. No notes are deleted. In scoped views, ends round down if expansion would cross the view boundary; existing projection/merge behavior preserves outside portions. Silent Instructions markers remain untouched. Note IDs, pitches, explicit volume settings and metadata remain stored. Conflicting instructions abort the operation through validation.

The operation uses the standard commit/history/refresh path: one undo step, refreshed MML/counts and limits, and no history entry for no-op conversions. The current playback snapshot follows the existing musical-edit behavior (Stop/Play to reload musical edits). This tool is never run implicitly on imports or as part of MML text optimization. Version-2 JSON remains unchanged.

Changed: new src/tools.ts and src/music/simplify-timing.ts; src/chrome.ts, src/renderer.ts and corresponding four generated dist files; index.html, studio.css; new tests/simplify-timing.test.mjs, tests/renderer.test.cjs, tests/run.cjs; PROJECT_MAP.md and PROGRESS.md. Existing changes retained.

Actual validation: node tests/run.cjs passed the incremental-output build and all 80 tests using approved installed dependency access. New tests cover all offered grids, rounding/collision fallback across pitches, existing polyphony, preserving/reporting zero-length cases and their neighbors, Instructions isolation, scope-end bounds, volume/data preservation, idempotence, actual simulated menu handlers, refreshed MML counts and undo. No native UI or in-game check was performed for this patch.

Working folder and generated outputs updated. Transfer patch: mml-studio-simplify-timing-patch.zip. Apply over the current optimizer version and restart the editor. Next: user trials with imported timing and dense short-note passages.

## Tools: Remove overlap — 2026-09-07

Added Remove overlap as the second Tools action. For all notes of the selected musical instrument, each held note ends at the next later onset of the exact same pitch when that onset precedes its original end. Nested/chained overlaps are handled independently by pitch, with exact integer timing and no grid snapping. Different octaves, pitches and instruments are independent. Touching endpoints and gaps stay unchanged. Simultaneous same-pitch duplicates are kept and reported because cutting at their shared start would create zero-length notes; each can still be shortened at the next distinct onset. Silent Instructions are untouched.

The standard commit path provides one undo step and refreshes MML, counts and limits. No-op runs create no history entry. Volume values, tempo metadata, IDs and starts remain unchanged. In Song/Segment views only the viewed portion changes; parent note fragments outside both boundaries survive. Playback retains the existing musical-edit snapshot behavior until Stop/Play. Version-2 JSON unchanged.

Changed: new src/music/remove-overlap.ts and dist/music/remove-overlap.js; src/tools.ts and dist/tools.js; index.html; new tests/remove-overlap.test.mjs, tests/renderer.test.cjs, tests/run.cjs; PROJECT_MAP.md and PROGRESS.md. Existing workspace changes preserved.

Actual validation: node tests/run.cjs passed the incremental-output build and all 83 tests with approved installed dependency access. New coverage checks nested/chained overlaps, exact non-grid cuts, pitch/octave/instrument isolation, touching/gapped notes, duplicate onsets, immutability/volume retention, scoped outside-fragment preservation, simulated menu handlers, count refresh, no-op history and Undo. No native UI or in-game check performed.

Working folder and generated outputs updated. Transfer patch: mml-studio-remove-overlap-patch.zip. Apply over the Simplify Timing version and restart the editor.

## Header time-signature edits align to measures — 2026-09-07

The top Time Signature field now writes at timeline tick zero when the current project/view has no signature instructions. Otherwise it writes at the start of the measure containing the position captured when the field gained focus. The pure signatureChangeTick helper follows the same signature and named Song-reset anchors as the ruler; ordinary Segment markers do not reset measures. Future signature markers also count as existing instructions, so preceding default 4/4 measures are respected. Existing Instructions at the target are updated rather than creating an exact-playhead marker. The existing inspector still supports exact-position instruction edits.

Undo, validation and scoped-view behavior remain on their existing paths. No source note timing, volumes or version-2 format changes. Updated the field tooltip to explain placement.

Changed: src/music/structure.ts, src/toolbar.ts and their two incremental dist outputs; index.html; tests/structure.test.mjs and tests/renderer.test.cjs; PROGRESS.md. Existing workspace changes retained.

Actual validation: node tests/run.cjs passed the incremental-output build and all 84 tests using approved installed dependency access. Added coverage for no-signature initialization away from zero, future signatures, changed meters, Song resets, non-reset Segments, exact measure edges, ruler agreement, simulated header edits at measure start, stable focus position while the playhead moves, replacement of the initial signature and Undo. No native UI check performed.

Working folder updated. Transfer patch: mml-studio-signature-measure-patch.zip. Apply over the current Remove overlap version and restart the editor.

## Clean Windows staging and portable release build — 2026-09-07

Replaced the broad electron-packager batch command with build.bat plus package-release.ps1. The batch anchors to its own directory, checks installed prerequisites, runs the incremental-output compiler, stops on errors, and calls the packaging helper. No new npm dependency/download is needed: the helper verifies and copies the installed Electron 37.0.0 Windows x64 runtime and renames its executable to MML Music Studio.exe.

Staging uses explicit runtime file/asset/vendor lists and derives compiled module paths from current source to avoid shipping stale dist files. It writes a minimal runtime package.json without npm dependencies or build scripts. Output: staging/app and releases/MML Music Studio-win32-x64/resources/app. The portable release retains Electron DLLs/locales/notices and app/audio/SoundFont licenses. Source files, tests, project documentation, scripts, node_modules, packages, archives and validation scratch data do not ship. The installer/signing/executable metadata customization are outside this portable-copy workflow.

Rebuilds clean only the two exact generated directories after absolute-path and reparse-point checks. Sources are copied, never moved. Other releases and the existing release directory are retained. Optional -StageOnly supports payload inspection. Added staging/ and releases/ to .gitignore, retained release/, and removed the old build.bat ignore rule so build scripts are trackable.

Changed: build.bat, new package-release.ps1, .gitignore, README.md, PROJECT_MAP.md, PROGRESS.md; new tests/release.test.cjs and tests/electron-release.cjs. No application source changed.

Actual validation: ran build.bat end to end with approved compiler dependency access; incremental build passed and produced an 81-file app payload. Injected stale documentation into both output app folders, rebuilt via the helper, and verified those stale files disappeared. node --test tests/release.test.cjs passes exact staging/release file and byte equality, excluded development content, minimal manifest, assets/vendor/license coverage and Electron runtime presence. git check-ignore confirms generated folders ignored and scripts not ignored (the latter correctly returns status 1). Native tests/electron-release.cjs passes using the installed identical Electron runtime to load the packaged main/preload/renderer, SoundFont IPC and actual AudioWorklet/synth initialization; evidence .validation/electron-release.json. This checks packaged assets, not installer behavior or physical-speaker output. No unrelated musical regression rerun was needed for these packaging-only changes.

Release generated locally at releases/MML Music Studio-win32-x64. Build-script transfer patch: mml-studio-clean-build-patch.zip. Run build.bat after npm ci to regenerate the portable release.

## Automatic release ZIP — 2026-09-07

Full package-release.ps1 runs now create releases/MML Music Studio-win32-x64.zip with the enclosing application folder and all Electron runtime files. Compression writes to a temporary archive first, then replaces the previous ZIP only after success; the temporary file is cleaned on failure. Existing output archive directories/links are rejected. StageOnly remains staging-only. build.bat prints the ZIP path, README explains distribution/extraction, and existing releases/ plus *.zip ignore rules already cover the output.

Changed: package-release.ps1, build.bat, README.md, PROGRESS.md. Validation: build.bat completed the incremental build, portable packaging and ZIP creation. All 153 archived files matched their release files by SHA256, with correct enclosing folder and matching file count. Existing node --test tests/release.test.cjs passed. No native UI rerun was needed for archive-only packaging changes.

Generated release archive: releases/MML Music Studio-win32-x64.zip. Script transfer patch: mml-studio-auto-zip-patch.zip.
