# Checkpoint — 0.3.0 General MIDI playback and note-attached tempo

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
