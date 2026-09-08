# Progress

Keep new entries at the top: behavior/outcome, changed files, actual validation, delivery and remaining work. Put current feature rules in their owner document and file ownership in [PROJECT_MAP.md](PROJECT_MAP.md), rather than appending competing specifications here.

The [original 2026-09-06–08 log](history/PROGRESS-2026-09-06-08.md) preserves prior entries and validation byte-for-byte, including working changes present at the start of this documentation task. Its ordering and old failures are historical. The recent checkpoints below are condensed references, not new test claims.

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
