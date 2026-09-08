# Progress

Keep new entries at the top: behavior/outcome, changed files, actual validation, delivery and remaining work. Put current feature rules in their owner document and file ownership in [PROJECT_MAP.md](PROJECT_MAP.md), rather than appending competing specifications here.

The [original 2026-09-06–08 log](history/PROGRESS-2026-09-06-08.md) preserves prior entries and validation byte-for-byte, including working changes present at the start of this documentation task. Its ordering and old failures are historical. The recent checkpoints below are condensed references, not new test claims.

## Tick-zero Tempo on a Multiplier in Song/Segment views

**2026-09-09.** Reproduced inherited T120 on a Song boundary marker blocking a Tempo edit on a separate tick-zero Multiplier marker. The new Tempo was rejected as a conflict, retaining 120 × 2 = 240 BPM. Root-project compiler and isolated native startup checks with T90 × 2 already produced 180 BPM; the failure was automatic scoped context. Shared note commits now replace only an unchanged automatic boundary tempo when a new explicit boundary tempo is entered. Projection reconciliation ignores removal of that automatic context so no extra empty markers or inherited tempo edits leak into the parent. Genuine explicit conflicts remain rejected.

Changed: `src/model/segment-view.ts` (pure context replacement/reconciliation), `src/commands.ts` (commit integration), generated modules, `tests/segment-view.test.mjs`, `tests/electron-loops.cjs`, STRUCTURE_VIEWS and this log. Earlier Double Time/live-edit working changes and version-2 compatibility are preserved; ownership map remains accurate.

Validation: authorized `node tests/run.cjs` passed the incremental build and **151/151** model/CPU-audio/simulated-DOM tests. Added checks cover Song starts at absolute 0 and 96, existing versus synthetic boundary carriers, 180 BPM/MML T90, parent-note preservation without orphan context, reprojection and rejection of genuinely explicit conflicting T. Authorized `node node_modules/electron/cli.js tests/electron-loops.cjs` passed with fresh `.validation/electron-loops.json`: native programmatic Tempo input on the combined marker, preserved parent, Undo/Redo (240/180 BPM), actual AudioWorklet playback clock near 96 ticks/s for T90 × 2, and existing loop/speed checks. An earlier isolated root-project probe also passed without source changes. No physical listening, manual note-entry session or in-game testing. `git diff --check` passed. Working folder updated directly.

## Note edits refresh active playback

**2026-09-09.** Playback previously cloned notes only at initial Play, and the existing live reload refreshed presets alone; Pause/Resume retained the stale notes. The transport now captures the entire latest active project for each serialized load and detects both note-array replacements and in-place drawing appends. Adds, moves, resizes, deletions, volume/instruction edits and ordinary note Undo reach the current playing or paused sequence. Loads coalesce intervening edits, retain the musical position (and unchanged repeat occurrence), restore current held voices and respect Stop cancellation. Normal repainting does not reload the song. Reloads briefly pause/re-attack sustained voices; scoped/lane-count operations that already explicitly stop playback are preserved.

Changed: `src/playback/transport.ts` and generated output, existing simulated renderer and native behavior tests, PLAYBACK_AUDIO and the map. Earlier Double Time and unrelated working changes were preserved; version-2 storage and pure music owners are unchanged.

Validation: sandboxed `node build.cjs` transpiled modules then failed on the documented esbuild dependency access; authorized `node tests/run.cjs` built incrementally and passed **150/150** model, CPU audio and simulated DOM tests. The expanded renderer case checks append-in-place notes, moved onsets/pitches, deletion/Undo, paused edits/resume, held routes, coalesced edits, unchanged redraws and cancellation. A subsequent focused `node --experimental-vm-modules --test tests/renderer.test.cjs` passed with an additional live Double Time assertion (same tick, updated seconds and 240 BPM).

Authorized `node node_modules/electron/cli.js tests/electron-behavior.cjs` passed with fresh `.validation/electron-behavior.json`. It exercises the native Electron/AudioWorklet engine: programmatic renderer edits add a sounding note, move it into the future, silence existing notes and edit/resume a paused note, with measured PCM and retained position. Existing preset, section seek, speed/master and layout checks also passed. Initial new test iterations corrected MIDI channel assumptions/local test setup, kept a future note in the silent test interval, and allowed two seconds for audio effects to decay before asserting silence. This is native synthesized-output verification, not physical listening or manual note-drag testing. `git diff --check` passed. Working folder updated directly.

## Double Time: simulated speed zones

**2026-09-09.** Advanced Instructions now offers Multiplier Entry, a positive numeric multiplier (default 2×), and Multiplier Exit, with captions and zone shading. Playback uses multiplied BPM; MML retains base T and divides note/rest durations, tying held continuations across speed and tempo boundaries. Editable notes and version-2 timing remain untouched. Decimal multipliers, nested factors, open zones through the end, loop repeats, synchronized sheets and section cuts are supported. Missing-entry exits warn. Exact derived denominators beyond 128 warn about unverified target support instead of rounding. Scoped views carry nested boundary context without saving it; inherited Entry speed controls direct the user to the source Entry in Project, while local markers remain editable/undoable.

Owners: new `src/music/speed.ts`; model types/validation/instruction detection and segment projection; tempo, loop expansion, MML compiler and sheet/section slicing; inspector, instruction rendering, live MML cache and sheet-limit invalidation. Simplify Timing recognizes speed metadata. MIDI preview excludes carrier length from the musical end so a closing marker adds no extra tick. Changed owning generated modules and the audio worker bundle were rebuilt. Tests extend existing MML, loops, simulated renderer and native loop harnesses. Updated MUSIC_MODEL, STRUCTURE_VIEWS and PROJECT_MAP. No unrelated source behavior or project-version migration was introduced.

Actual validation: initial sandboxed `node build.cjs` transpiled modules but hit the documented esbuild directory-access error; authorized incremental reruns passed. Focused existing suites first passed 50/50. New projection test initially compared absent `name` with `name: undefined`; its persisted-JSON comparison was corrected. Final authorized `node tests/run.cjs` rebuilt incrementally and passed **150/150** pure/model, CPU audio and simulated DOM tests, including new exact multiplier timing, base T retention, nested/repeated clock, version-2 round-trip/validation, scoped parent preservation, sheet cuts, inspector edits, invalid input and Undo. These are not native UI or physical listening tests.

Final authorized `node node_modules/electron/cli.js tests/electron-loops.cjs` passed with fresh `.validation/electron-loops.json`. Native checks include existing loop selection/rendering, an actual mouse click on Multiplier Entry, 240 BPM display, programmatic value/Exit change events, Undo, restored 120 BPM at Exit, compiled duration/MML, and inherited-entry disabled controls. `.validation/electron-speed.png` was visually inspected. Electron emitted two GPU-state diagnostics on the final successful run; harness assertions and fresh result passed. No manual user-session testing, physical listening, in-game MS2 verification or release packaging. `git diff --check` and changed-document local-link checks passed. Working folder updated directly.

## Remove overlap resolves simultaneous duplicates

**2026-09-08.** Fixed the explicit Remove overlap command retaining same-start, same-pitch duplicates on the active instrument instance. Equal lengths keep the highest resolved V; longer notes win unless a shorter note is at least three V steps louder. Larger groups keep the longest note within two V steps of the loudest, with volume then lowest ID breaking ties. Selection uses original lengths before the existing next-onset trimming. Surviving inherited V (including V0), chords, other instrument instances and Instructions are preserved; deletion-only changes are undoable and the status reports deletions.

Changed: `src/music/remove-overlap.ts`, `src/tools.ts`, their generated modules, `tests/remove-overlap.test.mjs`, `tests/renderer.test.cjs`, `agents/EDITOR.md`, and this log. Ownership and version-2 format are unchanged; pre-existing generated working changes were preserved.

Actual validation: initial `node build.cjs` transpiled editor modules but failed on the documented sandbox esbuild directory access; elevated rerun passed. `node --experimental-vm-modules --test tests/remove-overlap.test.mjs tests/volume.test.mjs tests/segment-view.test.mjs tests/note-density.test.mjs tests/renderer.test.cjs` passed **24/24**. Coverage includes both requested V1/V4 and V2/V4 duration examples, equal lengths, threshold boundaries, source-order independence, multi-note groups, inherited V0, instrument/pitch isolation, existing scoped trimming, simulated command/status and Undo/no-op history. These are pure/model and simulated DOM checks; no native UI, packaged-release or listening test was run. Working folder updated directly; remaining work: none.

## Verified portable updates from public GitHub releases

**2026-09-08.** Version 0.3.5 is the bootstrap release for automatic updates. Packaged Windows builds wait four seconds after startup, query the public `TreeHaver/MML-Studio` latest release without credentials, compare its tag to `app.getVersion()`, and prompt before downloading. The expected Windows ZIP is streamed into the user profile with a 512 MiB ceiling, exact-size check and GitHub-provided SHA-256 verification. After the normal Save/Discard/Cancel close handshake, a hidden external PowerShell helper waits for Electron to exit, validates the extracted packaged payload, updates the portable folder and restarts the EXE. Development checkouts never perform the network check. Existing installations still need to install 0.3.5 manually once; later releases can update from inside the app.

The sidebar version is no longer hardcoded. The renderer asks authenticated main-process IPC for `app.getVersion()`, while packaging copies the same `package.json` version into the runtime manifest and EXE metadata. DEVELOPMENT requires the package, Git tag, release metadata and EXE version to agree before publishing. Anonymous Git and GitHub API probes confirmed the repository is public and the current `0.3.4.1` release exposes `MML.Music.Studio-win32-x64.zip` with a SHA-256 digest.

Owners changed: new `updater.cjs`; `main.cjs`, `package.json`, `package-lock.json`, `package-release.ps1`, `preload.cjs`, `src/chrome.ts`, `index.html`, `agents/README.md`, `agents/DEVELOPMENT.md`, `agents/PROJECT_MAP.md`, `tests/updater.test.cjs`, `tests/run.cjs`, `tests/electron-startup.cjs`, `tests/release.test.cjs` and generated `dist/chrome.js`.

Actual validation: updater suite 6/6; after rebasing the concurrent overlap fix, `node build.cjs` and `node tests/run.cjs` pass 151/151; `git diff --check`; native Electron startup confirms the displayed version equals `v` plus `app.getVersion()`. The public release API was queried anonymously, and a regression confirms development checkouts neither schedule nor fetch updates. A full portable build was not produced because this checkout lacks the ignored `vendor/ffmpeg.exe`; consequently the real self-replacement handoff has not yet been run against a packaged 0.3.5 folder. No visual judgment was performed.

## Volume for the whole piece, in one move

**2026-09-08.** The per-instrument row answered how to balance parts; it did not answer how to raise a finished piece without going instrument by instrument. Tools now carries a Volume item that moves every instrument by the same amount, which keeps both the differences between notes inside a part and the distances between the parts, since the arrangement is exactly those distances.

The room available belongs to the loudest instrument, because it reaches V15 first, and the reading names it: "V3 to V9 of 15, 6 left before Melody reaches the cap". Max asks for exactly that room, so it is never reported as a trimmed request; a typed amount that would reach past either end is trimmed and the status says which instrument stopped it. The silent Instructions lane is left out of both the reading and the move, so its V0 markers neither drag the reading down nor block a lowering.

Owners changed: src/model/instrument-operations.ts (projectVolumes, shiftProjectVolumes), src/tools.ts, index.html, studio.css and dist outputs.

Actual validation: node tests/run.cjs 143 passing, including a project whose parts sit nine apart, checked to be still nine apart after the move and back again, and a case proving the Instructions lane is excluded; a probe drove the tool through the interface and recorded the reading, +4 taking the piece from V3-V9 to V7-V13 with every gap intact, Max moving it by the two that were left rather than the fifteen requested, and two undos putting it back exactly.

## Instrument volume moved as a whole, and the out-of-bounds tempo warning shown again

**2026-09-08.** Asked for after a session where raising a part meant selecting all of its notes and editing them together, instrument by instrument, because instruments sit at different volumes and treating them as one would have left the chords far louder than the melody.

Instrument actions now carry a volume row: it reads the quietest and loudest the instrument actually sounds, inheritance included, an amount to move by which accepts negative numbers, and Max, which works the room out for itself. Every note moves by the same amount, so the differences between them survive; only explicitly set volumes are rewritten, since an inheriting note follows the one it inherits from, and an instrument that never had a volume set gets one written once on its first note. A step that would reach past V15 or below V0 is trimmed to what fits and the status line says so, because past the cap the difference is not raised, it is lost.

Separately, a report that the out-of-bounds warning for tempos outside 32 to 255 BPM had disappeared. It had: the effective-BPM label it lives in is hidden whenever the speed slider sits at 1x, so a song written at 300 BPM said nothing at normal speed. The line responsible came from 5ddf134, not from this work, and the label is now shown at 1x as well when the tempo is out of range, carrying the warning alone since the BPM figure is already beside it.

Owners changed: src/model/instrument-operations.ts (instrumentVolumes, shiftInstrumentVolumes), src/instrument-actions.ts, src/playback/transport.ts, studio.css and dist outputs.

Actual validation: node tests/run.cjs 141 passing, with new unit tests for the shift in both directions, for the instrument that had no volume of its own, for the clamp at both ends, and for the warning appearing at 1x and going away again; electron-instrument-actions drives the row in the interface and records notes at V4 and V9 moving to V8 and V13, a step of nine trimmed to five with the difference kept, a negative amount lowering them, Max reaching the cap, and one undo putting it all back; electron-behavior passing.


## Overlap navigation and persistent active-instrument markers

**2026-09-08.** The instrument warning triangle now selects and scrolls to its first overlapping notes. Red vertical lines continuously mark all overlap onsets for the active instrument, including during scrolling/scrubbing and with automatic MML generation paused; clicking is not required to reveal markers. Other instruments do not contribute lines. The existing identical-onset/pitch warning definition, scoped clipping and loop-restart warnings are preserved. Expanded positions map back to editable source notes. Navigation does not edit project data or history/dirty state; stale/non-overlap warnings check current notes and report when there is no destination.

Changed: `src/music/note-density.ts` (pure location lookup), `src/mml.ts` (button/navigation), `src/rendering/note-density.ts` and `src/painting.ts` (cached markers), `studio.css`, corresponding generated modules, `tests/note-density.test.mjs`, `tests/renderer.test.cjs`, `tests/electron-mml.cjs`, `agents/IMPORT_EXPORT.md`, `agents/PROJECT_MAP.md`, and this log. Earlier MIDI fixes and unrelated working changes remain intact; version-2 storage is unchanged.

Actual validation: authorized incremental `node build.cjs` passed. `node --experimental-vm-modules --test tests/note-density.test.mjs tests/renderer.test.cjs tests/mml.test.mjs tests/loops.test.mjs tests/segment-view.test.mjs` passed **31/31** after the initial simulated click exposed and prompted a fix for a local `refresh` name collision. Pure/simulated coverage includes chronological locations, lane separation, Instructions exclusion, scope/loop mapping, active-only lines before clicking and selection/navigation without project/history changes. Authorized `node node_modules/electron/cli.js tests/electron-mml.cjs` passed, including a real native mouse click on the triangle, canvas line calls before clicking, both scroll axes, unchanged project/history/dirty state, and removal of markers after edits while MML updates are paused. Fresh `.validation/electron-mml.json` passed; `.validation/electron-overlap.png` was visually inspected. Existing pop-out/copy/manual-update checks also passed. No manual user-session, physical listening, in-game or packaged-release validation. `git diff --check` passed with line-ending notices only. Working folder updated directly; remaining work: none.

## Broader malformed MIDI instruction recovery

**2026-09-08.** Extended recovery to malformed tempo/signature/port metadata and channel instructions. Invalid controllers/programs retain prior settings; invalid aftertouch, pitch bends and invalid-pitch note events are skipped. Invalid release velocity is ignored while retaining the note-off tick. Unexpected end-of-track payloads are ignored while honoring the marker. Counted import notices describe each recovery. Source buffers, supported note timing, valid musical values, version-2 format and unrelated working changes are preserved. Structural truncation, invalid VLQs/running status, unknown system-event boundaries and unsupported file formats remain errors; no supported events remaining still fails import.

Changed: `src/import/smf.ts`, generated `dist/import/smf.js` and `vendor/audio-worker.cjs`, `tests/midi-import.test.mjs`, `tests/electron-midi-import.cjs`, `agents/IMPORT_EXPORT.md`, and this log. Ownership is unchanged.

Actual validation: authorized `node build.cjs` passed. `node --experimental-vm-modules --test tests/midi-import.test.mjs tests/renderer.test.cjs tests/volume.test.mjs tests/playback.test.mjs tests/audio-export.test.mjs` passed **43/43** pure/model, CPU audio and simulated DOM tests. New checks cover previous program/sustain/port/tempo/signature retention, release timing, counted metadata notices, end-of-track recovery, source-buffer equality, version-2 round-trip and continued rejection of truncated payloads. Authorized `node node_modules/electron/cli.js tests/electron-midi-import.cjs` with both supplied absolute paths passed; fresh `.validation/electron-midi-import.json` confirms both real files, expanded malformed-instruction fixture, warning display, unsaved state, version-2 round-trip, and existing cancellation/large-file/playback-start-stop checks. Native file choices were substituted; no manual UI, listening, in-game or release rebuild was performed. `git diff --check` passed with line-ending notices only. Working folder updated directly; remaining work: none.

## MIDI exporter overflow recovery

**2026-09-08.** Reproduced both supplied files failing with `Invalid MIDI channel data`: Rush E contains 20 note-on velocities of 129/135; Memory Reboot contains six pitch-bend events with an invalid second byte. The SMF reader now recovers only these second-byte cases: above-127 note-on velocities become 127 (V15), and unsupported invalid pitch bends are skipped. Import notices report counts. Other malformed data and chunk/timing validation remain enforced; source bytes, all note-on counts, confirmed music rules and version-2 storage remain intact. No ownership changes; unrelated generated working changes were preserved.

Changed: `src/import/smf.ts`, generated `dist/import/smf.js` and `vendor/audio-worker.cjs`, `tests/midi-import.test.mjs`, `tests/electron-midi-import.cjs`, `agents/IMPORT_EXPORT.md`, and this log. The native harness accepts optional MIDI paths after its script argument, alongside its generated regression fixtures; user music was not copied into the repository.

Actual validation: initial `node build.cjs` transpiled modules but failed on the documented sandbox esbuild directory access; authorized rerun passed. `node --experimental-vm-modules --test tests/midi-import.test.mjs tests/renderer.test.cjs tests/volume.test.mjs tests/playback.test.mjs` passed **37/37** pure/model/CPU synthesis/simulated DOM tests. Because the reader also belongs to the audio worker bundle, `node --test tests/audio-export.test.mjs` passed **5/5**. Direct imports from `H:/Downloads` retained **19,850 Rush E musical notes** and **10,031 Memory Reboot musical notes**, matching all positive-velocity note-on events; both passed version-2 JSON round-trip and source-buffer equality assertions.

Authorized `node node_modules/electron/cli.js tests/electron-midi-import.cjs` with both supplied absolute MIDI paths passed with fresh `.validation/electron-midi-import.json`. Native checks cover real file IPC, renderer replacement, success/warning dialogs, unsaved state and version-2 round-trip for both files and the overflow fixture; each supplied project additionally has one silent Instructions record. Existing cancel/malformed/declined-replacement checks, 17 MiB fixture import, and 130,000-note render/playback start-stop checks also passed. OS file selections were substituted; no manual file-picker testing, physical listening, in-game validation or packaged-release rebuild was performed. `git diff --check` passed with line-ending notices only. Working folder updated directly; no ZIP/release requested. Remaining work: none.

## The note loop measured, and two costs taken out of it

**2026-09-08.** A claim to check: that the note drawing does far more than it needs to. Measured rather than argued. The loop already culls through a spatial index, so only visible notes are touched at all, but per note it was doing more than the rectangles: a fill, a shade for sharps, an inset border, a selection stroke, and for any note wider than 8px a save, a clip, a font assignment, a fillText and a restore.

Before: 0.35ms for 75 visible notes, 1.99ms for 225, 4.7ms for 675, against 0.05, 0.09 and 0.78ms for the same notes drawn as two plain rectangles each - roughly six times the floor. The frame as a whole stayed between 0.8 and 5.3ms, which is why the reported lag was the instrument panel and not this.

Two changes, neither of which alters what is drawn: the font and baseline are set once a frame instead of once a note, and the clip around a label is applied only when the text can actually overflow its note, estimated from its length. After: 0.22ms for 75, 0.62ms for 225 and 1.37ms for 300 - a third of what it was where notes are wide enough to read.

At the lowest zoom the labels genuinely overflow, so the clip stays and 675 notes still cost 4.47ms. Raising the threshold at which a label is drawn at all, from 8px to 24px, would take that to 1.61ms, but a 14px note would stop showing its first character or two - a visible change, and therefore the user's to make, not mine.

Owners changed: src/rendering/notes.ts and its dist output.

Actual validation: node tests/run.cjs 134 passing; electron-behavior passing after its preset change opened the list first, as the interface does; electron-timeline still red, and verified twice against a tree without these changes: its instrument-selector check was stale after the Instructions lane became its own card - fixed here - and the remaining canvas pixel mismatch, 207,203,148 where 244,211,94 is expected, reproduces identically without any of this work.

## Fixed: the instrument panel crawled once a project passed eighty instruments

**2026-09-08.** Reported: past about eighty instruments the editor lags badly. Measured before touching anything, and the roll was not the cause - drawing stayed at 1 to 3ms whatever the count. The panel was: 19ms at ten instruments, 212ms at eighty, 335ms at a hundred and twenty, and the panel is rebuilt whenever anything changes, drawing a note included.

The cost was in select options. Every card carried a full preset list (152 options) and two destination lists naming every other instrument, so eighty instruments meant 23,360 option elements built from scratch on each rebuild. All three lists are now described rather than built, and filled the first time the list is opened or focused; until then a select holds only its current value.

Measured after: 37.6ms at eighty instruments and 60.7ms at a hundred and twenty, with 240 option elements instead of 23,360 and 4,003 nodes instead of 27,123. No cap on the number of instruments was added: with the lists deferred the panel is comfortable at counts far past anything MapleStory 2 could use.

Owners changed: src/instruments.ts, src/instrument-actions.ts, src/appearance.ts and dist outputs.

Actual validation: node tests/run.cjs 134 passing, with renderer asserting the contract directly - one option before the list is asked for, the full 132 after - and the simulated DOM taught to honour replaceChildren arguments, which it had been ignoring; electron-instruments and electron-instrument-actions passing, the latter filling the merge list the way the interface does before choosing from it; electron-export-formats passing.

## A set of files arrives as a folder or an archive, and Options fold away

**2026-09-08.** Exporting several files asked for a filename once per file, so a project with thirteen instruments and three sections meant dozens of save dialogs in a row. The destination is now chosen once. Which shape it takes is the user's decision, offered as one checkbox in the export dialog and remembered between sessions: unticked, the export asks for a place and writes a folder named after the project, ready to be loaded in game; ticked, it writes a single .zip, which is what you want when the set is going to somebody else. A single file still goes through the ordinary save dialog.

The archive is written by a new zip.cjs - local headers, central directory, end record, deflate from Node's own zlib - rather than by adding a dependency. Entries that compress larger than they started are stored uncompressed.

Every file dialog also passes an absolute defaultPath again: the folder the last file went to, remembered in the profile, and the system Downloads folder on a fresh install. Windows otherwise falls back to whatever folder its shell used last, which on this machine is OneDrive.

The dialog's Options were reworked at the same time. They are folded behind a summary button, since most exports are run without touching them, and the scope is now a single checkbox - Only <instrument> - rather than two radio buttons, so the section holds checkboxes alone instead of mixing round radios with square boxes.

Owners changed: new zip.cjs; main.cjs (export-folder, export-zip, the remembered folder), preload.cjs, src/export.ts, index.html, studio.css and dist outputs.

Actual validation: the archive was checked against an independent unzipper - Python's zipfile - which read it as valid and returned the file contents byte for byte, 432 bytes deflated to 37. node tests/run.cjs 134 passing, with the simulated export driving all three routes and asserting that a split sheet is delivered once as a folder and once as an archive. electron-sheets records the parts landing in one folder and then as a single PK-signed Sheet test.zip; electron-structure records two section files in one folder; electron-export-formats and electron-segment-view pass with the scope checkbox. electron-audio-export fails in this checkout because vendor/ffmpeg.exe is not installed here; it is git-ignored and unrelated to this change.

## The magnet is gone; G puts the loop on the grid

**2026-09-08.** The magnet button governed one thing only - where a loop end may land - because notes have always snapped to the grid on their own. It was removed at the user's decision, and with it the Ctrl modifier during a drag and the remembered preference. A loop is drawn exactly where the pointer goes, and G puts an existing loop onto the current grid afterwards: an action asked for once, not a mode to remember being in.

Measured while deciding whether the magnet should govern notes as well, since that would have earned it a second purpose: the same 64-note part costs 96 characters quantised and 454 to 887 characters with human timing, five to nine times as much. Off-grid notes are an editing convenience, never an export one, so nothing about note placement changed.

Owners changed: src/playback/loop-region.ts (alignLoopToGrid replaces loopSnap), src/keyboard.ts, src/pointer.ts, src/appearance.ts, index.html and dist outputs.

Actual validation: node tests/run.cjs 134 passing; electron-loop-region records a free drag landing on ticks 70 and 138, G moving those ends to 64 and 128, the same for a different project grid, G doing nothing with no loop marked, and the button being absent; electron-ui 19 of 19.

## Fixed: a loop past the end of the music froze, and the instrument panel now scales

**2026-09-08.** Reported: after one turn the loop stuck with the last notes crackling. Reproduced with a probe and measured: the clock read 0 for 93 consecutive samples. The cause was a loop whose end lies past the end of the music. The sequencer reaches the end of the song and is finished for good; putting its clock back to the loop start is not enough, so the position froze at the start while the synth held its last notes.

Two changes. The performance is now compiled to at least the end of the loop, so a loop drawn past the music has something to play; and every path that takes the loop back goes through one rewindLoop, which tells a finished sequencer to play again and restores the held notes. The same probe now records two clean turns and no stall at all.

The instrument panel was reworked for imported projects, where a dozen tracks all carry the same song title and the part that tells them apart is cut off at the end. A search field filters the list by name, matching the whole stored name rather than the shortened label; one switch collapses or expands every card; and a card shows the tail of an imported name (Ch 9 - Saxophone) with the whole name kept in the tooltip and in the search. The preset filter moved out of the panel heading to sit with the Advanced Instructions switch as a pair, and reads Show only MS2 instruments.

Owners changed: src/playback/transport.ts, src/instruments.ts (shortName, search, collapse switch), src/state.ts, index.html, studio.css and dist outputs.

Actual validation: node tests/run.cjs 134 passing; electron-loop-region gained the reported case - a loop reaching past the music - and records the position turning back and continuing to move rather than freezing; electron-instruments gained the shortened labels, the search including a term only present in the hidden part of the name, the empty-result note, the collapse switch in both directions and the two switches sitting together.

## A magnet beside Grid decides where loop ends land

**2026-09-08.** The grid is now a standing choice rather than a key held during a drag. A magnet button sits beside the Grid selector in the toolbar, since that is where the grid it snaps to is chosen; it starts off, so ends are free by default, and Ctrl held during a drag asks for the opposite of whatever the magnet says - free while it is on, gridded while it is off. B and N follow the same setting.

It is a view preference like the key style: nothing about the project changes, and it is remembered between sessions with the panel widths and the theme.

Owners changed: src/playback/loop-region.ts (loopSnap, and the mark functions take the setting), src/pointer.ts, src/appearance.ts, index.html and dist outputs.

Actual validation: node tests/run.cjs 134 passing; electron-loop-region drives the button and records a shift-drag landing on 64 and 128 with the magnet on, the same drag with Ctrl landing on 70 and 138, and the button switching back off; electron-ui 19 of 19 with the new toolbar button in place.

## The loop is placed freely, with the grid on request

**2026-09-08.** The loop used to round both ends onto the current grid. It now lands on the exact tick it is drawn at, the finest position the editor has, so a stretch can start and end anywhere inside a bar. Holding Ctrl while dragging pulls both ends back onto the grid for a loop that should sit on the bar; B and N mark exactly where the playhead is, with no rounding at all.

A one-tick loop is allowed, since the freedom is the point; both ends on the same tick still clears the loop, which is what a shift-click with no drag does.

Owners changed: src/playback/loop-region.ts (freeTick beside snapTick, setLoopRegion takes a grid flag), src/pointer.ts and dist outputs.

Actual validation: node tests/run.cjs 134 passing, the unit tests rewritten for free placement and a separate case for the grid modifier at two different project grids; electron-loop-region records a shift-drag landing on ticks 70 and 138 rather than on cells, and the same drag with Ctrl landing on 64 and 128. One test failure during this work was the test itself: its second drag began on an end of the loop already marked, so it took hold of that end instead of drawing a new loop; a probe confirmed the modifier path was correct and the test now clears the loop first.

## Fixed: the loop was lost when the editor left the foreground

**2026-09-08.** Reported: the loop repeats correctly, but switching to another application starts the whole song playing. It was a real defect and not a sound-engine problem. The loop was brought round inside the animation frame, and Chromium stops painting a window that sits behind another application, so the frame callback stopped with it while the audio thread played straight on past the end of the loop.

The wrap now lives in a 40ms timer that reads the sequencer clock rather than the drawn position, so it does not care whether anything is being painted, and the main window sets backgroundThrottling:false so that timer is not slowed while the editor is in the background. The frame check stays as well: it reacts within one frame while the window is on screen.

Owners changed: src/playback/transport.ts, main.cjs, tests/renderer.test.cjs (the simulated window had no setInterval), tests/electron-loop-region.cjs and dist output.

Actual validation: node tests/run.cjs 133 passing; electron-behavior passing; electron-loop-region gained a check that removes requestAnimationFrame outright during playback and then samples the sequencer clock - it stayed between 1.01s and 1.96s across eighteen samples, turning back three times, where the loop covers 1.0s to 2.0s at 120 BPM. Before the fix that clock ran past 2.0s and kept going.

## The loop is worked by keys and handles, not by a button

**2026-09-08.** The transport's Loop button is gone at the user's request, and the loop follows the conventions of a video editor's work area instead. B trims its start at the playhead, N its end, L switches it off and on, Shift+L clears it. Both ends are now drawn as the playhead's own shape with the flag turned inwards, so they read as handles rather than as lines, and they are still dragged with the pointer. Shift-dragging the bar numbers still draws a loop from scratch.

Trimming never leaves an empty loop, which is what a work area does: with no loop marked yet, B takes the end of the music as its far end and N reaches back one measure, floored at the start of the piece. The two keys are listed on the inspector shortcut card next to Copy, Undo and Select all, since that card is where the other shortcuts are learned.

Owners changed: src/playback/loop-region.ts (markLoopStart, markLoopEnd), src/rendering/loop-region.ts, src/keyboard.ts, src/playback/transport.ts, index.html, themes.css and dist outputs.

Actual validation: incremental build; node tests/run.cjs 133 passing, with new unit tests for the trimming arithmetic in both directions and for the two empty cases; electron-loop-region drives real key events and records the loop marked at 96-224 by B and N, switched off by L with its marks kept, alongside the earlier drag and wrap checks; electron-ui 19 of 19 with the transport back to six icons.

## The header wordmark removed

**2026-09-08.** The logo, name and tagline are gone from the header. Measured before deciding: the header is a fixed 76px in CSS, so the block cost no height at all - the roll stayed at 611px with the block hidden - and what it did cost was 177px of width inside a left group 494px wide, which only bites in a narrow window. Removed at the user's decision; the application is still named by the window title and the taskbar icon. Its rules left studio.css and themes.css with it, including the two shared selector lists it appeared in, so no dead selectors remain.

Owners changed: index.html, studio.css, themes.css, tests/electron-ui.cjs.

Actual validation: node tests/run.cjs 132 passing; electron-ui 19 of 19 after two expectations were corrected. The transport now holds seven icons rather than six, because of the Loop button. The MML block count is four rather than five, because the Instructions lane - rebuilt as its own card in the pulled work - is silent and generates no MML; that second failure was already standing before this change, not caused by it.

## Rehearsal loop, and a preset label that stretched its panel

**2026-09-08.** Playback can now repeat a chosen stretch of the roll while you work, the way a work area does in a video editor. Shift-dragging across the bar numbers marks it; afterwards either end can be dragged without a modifier, and a plain ruler drag still moves the playhead as before. A shift-click with no drag clears it. The marked stretch is tinted in the roll and barred on the ruler, faded while switched off, and the transport's Loop button switches it without losing the marks. Play from outside the stretch starts inside it, because otherwise it would run on and never come round.

The loop is session state and never touches the project: it is not written to a file and not exported. The musical loops that the game plays are still the Loop Entry/Exit markers in Instructions, which are a different thing with a similar name.

Edges snap to the current grid, and the wrap is checked in source ticks - the ones the playhead and ruler show - rather than in the compiled performance, so a loop set over a Segment view or over expanded loops stays where it was drawn.

Separately, the Standard Drum Kit preset read `Standard Drum Kit (not valid in MS2)`, the longest line in the preset list, and the custom select panel sizes itself to its widest option, so that one label stretched the whole panel to the scroll bar. The label is now the kit's name; the warning moved into the option's tooltip, which the panel copies onto its own rows. The orange marking that flags a preset MapleStory 2 cannot play is unchanged.

Owners changed: new [playback/loop-region.ts](../src/playback/loop-region.ts) and [rendering/loop-region.ts](../src/rendering/loop-region.ts), plus `src/pointer.ts`, `src/playback/transport.ts`, `src/painting.ts`, `src/appearance.ts` (palette and select panel), `src/instruments.ts`, `index.html`, `themes.css` and their dist outputs.

Actual validation: incremental build; `node tests/run.cjs` 132 passing, including the new [loop-region](../tests/loop-region.test.mjs) unit tests for snapping, direction, clearing, the off switch and edge grabbing; new [electron-loop-region](../tests/electron-loop-region.cjs) drives the real ruler with input events and records the sampled playhead turning back at the end of the loop twice, staying inside it, and running past it once switched off; electron-behavior and electron-instruments passing. No visual judgement is claimed - screenshots are for the user.


## Simplify Timing competing notes

**2026-09-08.** Two sequential notes competing within a timing window now compare their original coverage inside that window. Ratios from 40/60 through 60/40 inclusive receive equal half windows; otherwise the larger share takes the window. Held portions outside it remain; losing notes with no remaining duration are removed. This also takes precedence over roll condensation for two-note windows. Existing polyphony, attached instructions, scoped ends, surviving V0/inherited volumes and version-2 fields remain protected. No ownership changes or unrelated working changes were introduced.

Changed: `src/music/simplify-timing.ts`, generated `dist/music/simplify-timing.js`, `tests/simplify-timing.test.mjs`, the Simplify Timing assertions in `tests/renderer.test.cjs`, the tooltip in `index.html`, `agents/EDITOR.md`, and this log.

Actual validation: authorized `node build.cjs` passed. `node --experimental-vm-modules --test tests/simplify-timing.test.mjs tests/remove-overlap.test.mjs tests/renderer.test.cjs tests/volume.test.mjs tests/segment-view.test.mjs` passed **31/31** after updating two superseded expectations exposed by the first run. Coverage includes inclusive 40/60 in both directions, 50/50, larger-share deletion in both directions, held portions, all grids including one-unit half windows at L64, two-note roll windows, V0 inheritance, idempotence and simulated Apply/Undo. No native Electron UI, manual UI, listening, in-game or release testing was performed. Working folder updated directly; no ZIP/release requested. Remaining work: none.

## Simplify Timing coverage and ornaments

**2026-09-08.** Simplify Timing now includes an edge window only above 40% note coverage, so isolated notes and slightly offset chords can round inward instead of always expanding. Existing new-overlap prevention and unfit-note retention remain. Detects rising/falling/turning short rolls and retains the first note per condensed window; removes an L32-or-shorter hammer-on lead-in only when the following different-pitch note is more than six times longer. Detection uses consecutive, non-simultaneous onsets with at most a one-unit gap; rolls require at least three short notes. Instruction-bearing notes are protected from removal, and surviving inherited velocities (including V0) are materialized where removed carriers would change them. Version-2 fields and source ownership are unchanged. Unrelated working changes were retained.

Changed: `src/music/simplify-timing.ts`, generated `dist/music/simplify-timing.js`, `tests/simplify-timing.test.mjs`, the Simplify Timing block in `tests/renderer.test.cjs`, the tool tooltip in `index.html`, `agents/EDITOR.md`, and this log.

Actual validation: initial `node build.cjs` transpiled modules but encountered the documented sandbox esbuild directory-access failure. Authorized incremental reruns passed, including the final implementation. `node --experimental-vm-modules --test tests/simplify-timing.test.mjs tests/remove-overlap.test.mjs tests/renderer.test.cjs tests/volume.test.mjs tests/segment-view.test.mjs` passed **28/28** tests. Coverage includes offset chords without extra tails, every offered grid, short-note retention, roll directions/windows, strict hammer-on duration threshold, chord/gap/instruction protections, view ends, V0 inheritance and simulated Apply/Undo restoring deleted ornaments. These are pure/model and simulated DOM/canvas tests; no native Electron UI, manual UI, physical listening, in-game or release validation was performed. Working folder and generated module updated directly; no release or ZIP requested. Remaining work: none.

Final whitespace validation: `git diff --check` passed (Git emitted only existing line-ending normalization notices).

## Dedicated Advanced Instructions lane

**2026-09-08.** Instructions is now a permanent, initially hidden card controlled by **Enable Advanced Instructions**, always displayed below musical instruments. Opening/importing instruction events, the first instruction edit, instruction-caption selection and instruction-bearing MML paste reveal it. Hiding the card never disables events. It has neutral text in Vanilla mode, no sound preset, Rename/Delete, Mute/Solo or Instrument Actions, and is excluded from sidebar/import totals. Instructions remains editable during musical Solo; merges involving it are rejected. Deleting the last musical lane preserves Instructions and resets only that musical lane to Piano. Older version-2 files with multiple Instructions lanes consolidate their event routing without dropping events. An unused card is virtual until selected/needed, so toggling visibility alone does not alter project JSON.

Changed: new `src/advanced-instructions.ts`; `src/instruments.ts`, `src/state.ts`, `src/files.ts`, `src/renderer.ts`, `src/pointer.ts`, `src/note-clipboard.ts`, `src/instrument-actions.ts`, `src/model/instructions.ts`, `src/model/serialization.ts`, `src/model/instrument-operations.ts`; corresponding generated `dist/` modules and `vendor/audio-worker.cjs`; `index.html`, `studio.css`, `themes.css`; new `tests/electron-advanced-instructions.cjs`, updated `tests/renderer.test.cjs`, `tests/instrument-operations.test.mjs`, `tests/electron-instrument-actions.cjs`; `agents/EDITOR.md`, `MUSIC_MODEL.md`, `STRUCTURE_VIEWS.md`, `IMPORT_EXPORT.md`, `PLAYBACK_AUDIO.md`, `PROJECT_MAP.md`, and this log. Prior Vanilla changes and unrelated generated working changes remain.

Actual validation: authorized incremental `node build.cjs` and final `node tests/run.cjs` passed, **119/119** pure/model/import/CPU audio/simulated renderer tests. Old assertions allowing Instructions preset conversion/merges were updated to the requested behavior. Authorized native `node node_modules/electron/cli.js` runs passed for `tests/electron-advanced-instructions.cjs`, `tests/electron-instruments.cjs`, `tests/electron-instrument-actions.cjs`, and `tests/electron-segment-view.cjs`, with fresh success reports under `.validation/`. New native coverage checks hidden defaults, unchanged JSON/history on visibility toggle, no preset/actions/warning tint, counts, visual ordering after adding instruments, retained tempo during Solo/hidden state, actual mouse creation + Undo of a marker during Solo, save/reopen, unbound MIDI/MML file imports and MML paste auto-reveal even after manual hiding. OS file choices were substituted; file IPC/import/renderer ran natively. The generated native screenshot was visually inspected. `git diff --check` and affected-document local-link checks passed. No manual user-session testing, physical listening, in-game or release validation. Remaining work: none for this task.

## Preset numbering and Night toggle contrast

**2026-09-08.** Restored original 1–128 GM numbering before MS2 display aliases in both filtered and full lists (for example, `30. Electric Guitar`). The enabled Vanilla toggle now has an orange background tint, border and text in Night; Sky retains blue. Fixed drums retain their existing unnumbered labels.

Changed: `src/instruments.ts`, generated `dist/instruments.js`, `themes.css`, `tests/electron-instruments.cjs`, `agents/EDITOR.md`, and this log. Ownership remains as mapped in PROJECT_MAP.

Actual validation: authorized `node build.cjs` passed; `node --experimental-vm-modules --test tests/renderer.test.cjs` passed (one simulated integration test); authorized `node node_modules/electron/cli.js tests/electron-instruments.cjs` passed with fresh success JSON, including native computed colors for Night/Sky, numbered aliases, 40 filtered choices, preserved selections, yellow warnings and type-ahead. `git diff --check` passed. No manual UI, in-game, listening or release testing. Remaining work: none.

## Vanilla catalog completed

**2026-09-08.** Applied confirmed mappings: Electric Guitar → Overdriven Guitar (29), Bass → Electric Bass (finger) (33), Organ → Church Organ (19), Saxophone → Alto Sax (65), Tom-Tom → Melodic Tom (117), all zero-based. Pick Bass Guitar remains Electric Bass (pick) (34). The filter now offers all 40 requested Vanilla presets (37 melodic and three fixed drums), with no changes to stored programs or musical behavior.

Changed: `src/playback/vanilla-instruments.ts`, generated `dist/playback/vanilla-instruments.js`, `tests/electron-instruments.cjs`, `agents/EDITOR.md`, and this log. Ownership is unchanged from the preceding PROJECT_MAP update.

Actual validation: authorized `node build.cjs` passed; `node --experimental-vm-modules --test tests/renderer.test.cjs tests/playback.test.mjs tests/instrument-operations.test.mjs` passed **21/21** pure/CPU synthesis/simulated renderer tests. Authorized `node node_modules/electron/cli.js tests/electron-instruments.cjs` passed, including exactly 40 visible choices, all six clarified bass/voice aliases, preserved project/history/selections, yellow warnings and filtered keyboard selection; fresh `.validation/electron-instruments.json` reports success. `git diff --check` passed. No manual UI, physical listening, in-game or release testing. Remaining work: none for this task; no release/ZIP requested.

## Vanilla preset filter — initial partial catalog

**2026-09-08.** Added the session-only **Show only MapleStory 2 Instruments** toggle beside Instruments/count, default off. MS2 aliases replace MIDI labels for confirmed Vanilla voices. Filtering retains selected excluded values in yellow without project/history/selection changes; excluded values are absent from the popup. Standard Drum Kit is always yellow, selectable only with the filter off; fixed MS2 drums remain available. Instructions is retained when selected but hidden from new filtered choices. Dropdown keyboard/type-ahead uses visible options.

Changed: `src/instruments.ts`, `src/state.ts`, `src/playback/vanilla-instruments.ts`, `src/appearance.ts`, their generated `dist/` outputs, `index.html`, `studio.css`, `themes.css`, `tests/electron-instruments.cjs`, `agents/EDITOR.md`, `agents/PLAYBACK_AUDIO.md`, `agents/PROJECT_MAP.md`, and this log. Unrelated existing generated working changes remain.

Actual validation: `node build.cjs` passed on authorized outside-sandbox reruns after the known esbuild directory-access failure. `node --experimental-vm-modules --test tests/renderer.test.cjs` passed (1 simulated integration test); `node --test tests/playback.test.mjs tests/instrument-operations.test.mjs` passed (20 pure/CPU synthesis tests, including version-2 drum round trips). `node node_modules/electron/cli.js tests/electron-instruments.cjs` passed with fresh `.validation/electron-instruments.json`: existing collapse/Mute/Solo/playback checks plus retained selection/project/history, filtered popup, rendered yellow text and filtered keyboard selection. The sandboxed Electron launch failed GPU startup; an initial authorized run exposed an overly broad test selector, corrected to target playback presets before successful reruns. `git diff --check` passed. No manual UI, physical listening, in-game or release validation performed.

Remaining at this checkpoint: user confirmation of Electric Guitar, Bass, Saxophone, Organ and Tomtam MIDI mappings; those five were not guessed or included in the partial catalog (32 confirmed melodic aliases plus three fixed drums). Resolved by the newer completion entry above. No release/ZIP requested or built.

## Documentation consolidation

**2026-09-08.** Reorganized the active documentation into `agents/`, checked the source map against current modules and test entrypoints, and replaced accumulated patch notes with a small set of topic guides. The root `AGENTS.md` remains a short discovery pointer applying the development/music rules repository-wide. Runtime code and behavior were not changed by this task.

Corrected stale claims about unavailable playback/import/file export, old toolbar section buttons, obsolete ruler geometry, double-click rename, prior copy/paste placement, fixed tempo restrictions, missing MML optimization and unresolved audit findings. Documented previously scattered details: native HTML-ID startup checking, color-picker ownership, piano/vertical zoom adapters, intentional cleanup tools, all four exports, audio extra-channel reset, visible release examples and FFmpeg checkout setup.

Code inspection also identified limitations to retain for future work: selected-instrument MIDI omits tempos on other musical instruments, scoped MIDI does not receive the explicit view end, MIDI output is preview-oriented and omits visual metadata, and blank-line multi-channel text export is not the importer's comma-separated interchange syntax. See [IMPORT_EXPORT.md](IMPORT_EXPORT.md#known-export-limitations). No fix or user approval of those limitations is implied.

Changed: root `AGENTS.md`; new `agents/README.md`, `DEVELOPMENT.md`, `PROJECT_MAP.md`, `MUSIC_MODEL.md`, `EDITOR.md`, `STRUCTURE_VIEWS.md`, `IMPORT_EXPORT.md`, `PLAYBACK_AUDIO.md`, this `PROGRESS.md`, and `history/PROGRESS-2026-09-06-08.md`. Superseded root Markdown files are removed according to the table below. Existing source/test/generated working changes and user projects/archives are retained.

Actual validation: `node build.cjs` transpiled editor modules but hit the known sandbox esbuild directory-access failure. Authorized `node tests/run.cjs` outside the sandbox completed the incremental build and **117/117 tests passed**, including simulated renderer integration and CPU synthesis. Documentation checks resolved **321 local links/anchors** and mapped **all 73 source TypeScript modules**. SHA-256 comparisons confirmed the historical progress archive matches the original working file and all pre-existing source/test/generated/build/UI files remain unchanged. `git diff --check` passed; new Markdown also passed the whitespace/link check. No native Electron, manual UI, physical listening, in-game or release rebuild was performed for this documentation-only task.

Delivery: `documentation-reorganization.zip` contains the complete new `agents/` documentation and root discovery pointer. For applying it to another checkout, the table below lists superseded root files to remove; ZIP extraction alone cannot delete them. No outstanding documentation work. The code limitations above remain documented follow-up candidates outside this task's scope.

### Where the old files went

All names in the left column refer to the **former repository-root documents**. Read the linked replacements; do not copy these old files back from a previous patch ZIP.

| Retired/replaced document | Current home |
| --- | --- |
| `AGENTS.md` body | Root pointer retained; instructions in [DEVELOPMENT](DEVELOPMENT.md) and [MUSIC_MODEL](MUSIC_MODEL.md). |
| `README.md` | [README](README.md), [EDITOR](EDITOR.md), [DEVELOPMENT](DEVELOPMENT.md). |
| `PROJECT_MAP.md` | Rebuilt [PROJECT_MAP](PROJECT_MAP.md), grouped by feature with source/test links. |
| `PROGRESS.md` | This short current log; complete original in [history](history/PROGRESS-2026-09-06-08.md). |
| `BUILD_FIX.md` | [DEVELOPMENT](DEVELOPMENT.md): current Node/build setup; obsolete v0.2 patch-install instructions removed. |
| `BEHAVIOR_AUDIT.md` | [Settled audit table](DEVELOPMENT.md#settled-behavior-audit), [MUSIC_MODEL](MUSIC_MODEL.md), original fix evidence in history. |
| `MIDI_IMPORT.md`, `MML_IMPORT.md` | [IMPORT_EXPORT](IMPORT_EXPORT.md); shared timing rules in MUSIC_MODEL. |
| `MML_GENERATION.md`, `SHEET_LIMITS.md` | [IMPORT_EXPORT](IMPORT_EXPORT.md); notation/invariants in MUSIC_MODEL. |
| `PROJECT_STRUCTURE.md`, `SEGMENT_VIEW.md`, `LOOPS.md`, `TIMELINE_UPDATE.md` | [STRUCTURE_VIEWS](STRUCTURE_VIEWS.md); playback following in PLAYBACK_AUDIO. |
| `PLAYBACK_UPDATE.md`, `DRUM_KIT.md`, `AUDIO_EXPORT.md`, `AUDIO_SECURITY.md` | [PLAYBACK_AUDIO](PLAYBACK_AUDIO.md); required instrument behavior in MUSIC_MODEL. |

Licenses, asset provenance, example music and existing delivery ZIPs stay in their original locations. The archived log retains historical bare filenames/test counts; it is excluded from current guidance checks except archive preservation and actual Markdown-link integrity.

## Edge scrolling and selection-based paste

**2026-09-08, preceding implementation checkpoint.** Moving selected notes scrolls horizontally near both roll edges, including with a stationary pointer; release/cancel ends the animation and one gesture produces one Undo step. Box selection retains two-axis scrolling. Internal paste starts after the greatest selected end in the active instrument, or at the original copy position without such a selection. Repeated pastes append; external MML insertion remains separate.

Owners changed then: `src/pointer.ts`, `src/note-clipboard.ts`, their generated outputs, `tests/renderer.test.cjs`, `tests/electron-pitch-layout.cjs`. Recorded validation: incremental build, all 117 regression tests and expanded native pitch-layout edge-dragging checks passed after environment-restricted attempts were rerun outside the sandbox. Delivery: `note-drag-paste-patch.zip`. No outstanding work was recorded for that implementation.

## Startup repair and visible release example

**2026-09-08, preceding implementation checkpoints.** Restored `index.html` controls required by current renderer modules after an older HTML file caused startup to fail. Renderer tests now reject requested IDs absent from real HTML. Packaging places `Example Project/Song of Storms.json` beside `MML Music Studio.exe`, outside staging/runtime internals.

Owners changed then: `index.html`, `tests/renderer.test.cjs`, `package-release.ps1`, `tests/release.test.cjs`. Recorded validation: incremental build/renderer, npm prestart, native UI (19 checks), MIDI import, all-six-format audio export/cancellation, packaged startup and release content/icon tests passed. Prior broken packaged startup reproduced before repair. Deliveries included rebuilt release ZIP and `startup-html-fix-patch.zip` / `example-project-visible-patch.zip`.

## Section menu, compact bars and zoom

**2026-09-08, preceding implementation checkpoints.** Section navigation/Open Segment/Open Song moved into the header Section menu beside Tools. The ruler is 24px; both keyboard styles clip below it. H/V zoom sit side by side with separate hit areas and reset/Ctrl+wheel support. Segment return stays under Time signature. Responsive caption/header layouts support 900px windows.

Owners changed then included `src/toolbar.ts`, `src/pitch-viewport.ts`, `src/segment-view.ts`, `src/chrome.ts`, geometry/rendering owners, `index.html`, `studio.css`, and renderer/native layout tests. Recorded validation: incremental builds, simulated integration, native pitch-layout, UI (19 checks), export-format geometry and scoped-view checks passed; screenshots inspected. A timing-sensitive Undo-hold failure was recorded before a successful rerun. Deliveries included vertical zoom, compact bar and `section-menu-patch.zip` updates.

## Audio export and extra-port initialization

**2026-09-08, preceding implementation checkpoints.** Added streamed offline mixed recording with six codecs, local view/loops/global tempo, session speed/master/Mute/Solo, natural release and cancellation preserving old targets. Fixed extra synth channels by resetting after allocation and assigning melodic/drum roles before scheduled events. The FFmpeg prestart check warns without blocking editor startup or downloading anything.

Owners changed then: `src/audio/render.ts`, `src/audio/worker.ts`, `audio-export.cjs`, `src/export.ts`, native bindings/UI, audio build/release assets, `check-ffmpeg.cjs`, manifest and audio tests. Recorded validation: 117 regressions after the route fix; native six-codec/loop/rest/mute/scope/cancellation checks, staged runtime checks, a full 3123.09-second FLAC performance and per-minute second-instrument signal checks. Source user JSON remained byte-for-byte unchanged. No physical listening was claimed. Deliveries included `mml-studio-audio-export-source.zip`, `audio-channel-fix-patch.zip`, `ffmpeg-startup-check-patch.zip`.

## Earlier feature and audit work

**2026-09-06–08.** MIDI/MML import, Instructions, MML counts/optimization, multipart export, named structure, editable views, loops, fixed MS2 drums, instrument operations, appearance and playback were added across several iterations. A1/A3–A7 were fixed and A2 confirmed intentional on 2026-09-08; no original audit decision remains pending. See the [settled audit](DEVELOPMENT.md#settled-behavior-audit) for current regressions, and history for detailed changed files, fixtures, test scope and artifacts.
