# Progress

Keep new entries at the top: behavior/outcome, changed files, actual validation, delivery and remaining work. Put current feature rules in their owner document and file ownership in [PROJECT_MAP.md](PROJECT_MAP.md), rather than appending competing specifications here.

The [original 2026-09-06–08 log](history/PROGRESS-2026-09-06-08.md) preserves prior entries and validation byte-for-byte, including working changes present at the start of this documentation task. Its ordering and old failures are historical. The recent checkpoints below are condensed references, not new test claims.

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
