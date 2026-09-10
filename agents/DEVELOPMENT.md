# Development and validation

These are repository-wide working instructions. User instructions take precedence. Start with [PROJECT_MAP.md](PROJECT_MAP.md) and the latest [PROGRESS.md](PROGRESS.md); use [MUSIC_MODEL.md](MUSIC_MODEL.md) as the required behavior contract.

## Make a focused change

1. Use the map to identify the owner module and relevant existing tests. Read related imports when behavior is unclear; do not routinely read or rewrite the whole project.
2. Preserve unrelated working changes. Edit source `.ts`, HTML/CSS or the owning native/build module; never hand-edit generated `dist/` or audio bundles.
3. Keep model/music functions free of DOM and mutable editor-state dependencies. `src/core.ts` is a compatibility export barrel, not an implementation file. Add UI handlers to their owner module; wire a new module in `src/renderer.ts` only when needed. Install handlers once.
4. Preserve version-2 project JSON unless a migration is explicitly requested. Follow the shared volume, tempo, channel, projection and timing rules in MUSIC_MODEL and STRUCTURE_VIEWS.
5. Run the incremental-output build and the relevant existing tests below. If changing DOM IDs, check actual `index.html` as well as the renderer: missing elements can abort startup before instruments or painting initialize.
6. Record the behavior change, changed files, actual commands/results, limitations and outstanding work in PROGRESS. Update the map when ownership changes. Use newest-first entries and keep historical failures distinguishable from current issues.
7. ZIPs are optional backups/transfers; the working folder is updated directly. Prefer a focused patch ZIP for small code updates and a full source ZIP for runtime/module structural changes. Preserve relative paths and include required generated dependencies. A documentation-only reorganization can ship a complete documentation ZIP; list obsolete files because extracting a ZIP cannot remove them. Use the release builder for distributable applications.

Do not add export restrictions to import/editing, silently snap arbitrary durations, flatten explicit chord velocities, automatically repair warning overlaps, or serialize automatic view context into the parent. These are settled user decisions, not open design questions.

## Build and test commands

Run from the repository root:

| Command | What it checks |
| --- | --- |
| `node build.cjs` | Transpiles all source, rewriting only changed `dist` outputs; rebuilds deterministic audio bundles with the local SF2 adapter. |
| `npm test` or `node tests/run.cjs` | Builds first; runs core/model, music, import, audio synthesis and simulated renderer tests. |
| `node --experimental-vm-modules --test tests/renderer.test.cjs` | Focused simulated DOM/canvas integration, including actual HTML ID presence and owner-module startup. |
| `node --test tests/volume.test.mjs` | Example focused pure regression after building; choose the relevant suites from PROJECT_MAP. |
| `git diff --check` | Whitespace errors in tracked changes; also inspect new files and local Markdown links. |

`tests/run.cjs` compiles `tests/core.test.ts` to a temporary `.mjs` using `transpile.cjs` and cleans it afterward. It does **not** run `tests/electron-*.cjs`, release-content tests, or the standalone behavior audits. The build uses pinned TypeScript rather than Node's built-in type stripping. There is no configured static TypeScript type-checking gate.

The installed npm shim has previously resolved to a missing roaming `npm-cli.js` on this machine. Direct `node build.cjs` / `node tests/run.cjs` bypass npm for validation; this is an environment issue, not a reason to change application dependencies. The filesystem sandbox has also blocked esbuild dependency-directory reads. Record the failure and the actual authorized rerun rather than claiming the sandboxed build passed.

## Native Electron validation

Use isolated test processes, not the user's open editor:

```powershell
node node_modules/electron/cli.js tests/electron-ui.cjs
node node_modules/electron/cli.js tests/electron-pitch-layout.cjs
```

On Windows, `node_modules/electron/dist/electron.exe` is an equivalent launcher. Feature-specific harnesses are linked in PROJECT_MAP. They create local fixtures/preferences and generally write evidence under `.validation/`; inspect fresh output for that invocation, not an old success file.

For close behavior, run each case separately:

```powershell
node node_modules/electron/cli.js tests/electron-close.cjs --case=save
node node_modules/electron/cli.js tests/electron-close.cjs --case=clean
node node_modules/electron/cli.js tests/electron-close.cjs --case=discard
node node_modules/electron/cli.js tests/electron-close.cjs --case=quit
node node_modules/electron/cli.js tests/electron-close.cjs --case=import
```

Distinguish validation levels when reporting results:

- Pure/simulated tests execute model code and stubbed DOM/canvas handlers. They are not native UI testing.
- Native harnesses exercise Electron windows, browser rendering, IPC and, where specified, real input or AudioWorklet PCM. Many substitute deterministic OS dialog choices.
- PCM measurements and encode/decode checks establish synthesis or file behavior, not physical-speaker listening, manual file-picker operation or in-game MS2 compatibility.

Run additional native checks when the changed behavior warrants them. Documentation-only edits need link/map checks and the required build/regression validation; they do not require a fresh native UI run.

## Windows release build

Every user-facing update must bump the semantic version in `package.json` before packaging. The visible version is read from Electron's `app.getVersion()` and must never be hardcoded in HTML/CSS. The package version, Git tag, release/update metadata, ZIP name or release entry, and embedded EXE file/product version must all identify the same release. Do not publish an update while any of these versions disagree.

Packaged Windows builds check the public `TreeHaver/MML-Studio` latest release four seconds after startup. Release assets must include exactly one Windows portable archive named `MML Music Studio-win32-x64.zip` or `MML.Music.Studio-win32-x64.zip`, with GitHub's `sha256:` digest populated. The updater never runs from a development checkout. It prompts before downloading, streams at most 512 MiB into the user profile, verifies exact size and SHA-256, then uses an external hidden PowerShell handoff after the normal Save/Discard/Cancel close flow. Keep `updater.cjs` in the release runtime list. A release without the expected ZIP or digest is not installable automatically.

The handoff now waits for a hidden PowerShell launcher to run `Start-Process -WindowStyle Hidden` before Electron quits; do not use Node's `detached:true` directly for Windows PowerShell. The previous launcher could exit without running the installer. `updates/update-launch.log` captures bootstrap output, and `updates/update-error.log` records launch/install errors under app userData. `node tests/electron-updater.cjs` separately verifies real native Electron shutdown, PowerShell extraction/replacement and restart of a tiny disposable executable under `.validation/`. It neither downloads the public release nor modifies a user's installation. Existing published copies with the broken launcher require a one-time manual installation of a release containing this fix.

After `npm ci` and [encoder setup](PLAYBACK_AUDIO.md#encoder-setup), close any running copy of the packaged app and run:

```powershell
.\build.bat
```

The batch file works from any current directory and stops on build/packaging errors. Failures pause so double-clicked windows keep the error visible; automated callers can pass `--no-pause`. It calls `package-release.ps1`, which validates and replaces only its generated staging and target release paths. Packaging refuses to replace a release copy that is still running, before clearing staging or release files; close that copy and its error dialogs first.

| Output | Purpose |
| --- | --- |
| `staging/app/` | Runtime-only payload: compiled modules, native entrypoints, HTML/CSS, images, SoundFont, audio bundles, encoder and license notices. |
| `releases/MML Music Studio-win32-x64/` | Portable Electron folder with `MML Music Studio.exe`; examples live in `Example Project/` beside the EXE. |
| `releases/MML Music Studio-win32-x64.zip` | Entire enclosing application folder; the previous ZIP is replaced only after compression succeeds. |

The helper checks the installed Electron version and Windows x64 architecture, retains Electron DLLs/locales/notices, embeds `assets/logo.ico` and project version metadata using `build-icon.cs`, and omits development documentation, source, tests, npm dependencies and old archives. This is an unsigned portable release, not an installer. Distribute the entire folder/ZIP.

For staging only, build first and run `powershell -NoProfile -ExecutionPolicy Bypass -File package-release.ps1 -StageOnly`. This does not rebuild the release folder or ZIP. Add new runtime assets to the helper's explicit file lists, including local native dependencies such as `zip.cjs` (export archives) and `updater.cjs`; compiled module paths are derived from current `src` files to exclude obsolete outputs. Release tests check that literal relative CommonJS imports resolve within the packaged payload.

After a full release build, run `node --test tests/release.test.cjs` for payload/example byte comparisons and embedded icons, and `node node_modules/electron/cli.js tests/electron-release.cjs` for packaged startup, title and synth initialization. These are separate from the normal test runner.

## Settled behavior audit

All seven findings were reviewed with the user on **2026-09-08**. The original reproductions and historical validation remain in [history](history/PROGRESS-2026-09-06-08.md); the table describes their final disposition.

| Finding | Decision and current regression entry points |
| --- | --- |
| A1: explicit V overwritten in simultaneous notes | Fixed: each explicit V controls its own note; highest ID resolves inheritance only. `tests/volume.test.mjs`, `tests/electron-volume.cjs`. |
| A2: clipped/restarted notes introduce warnings | Confirmed intended: current view/performance onsets determine overlap warnings. Preserve music and keep warnings non-blocking. `tests/note-density.test.mjs`. |
| A3: views lose the last inherited V | Fixed: copy the last pre-boundary V, including ended carriers and V0, without turning automatic context into parent edits. `tests/segment-view.test.mjs`, `tests/electron-segment-view.cjs`. |
| A4: nested same-pitch notes exchange lifetimes | Fixed: preview shares MML's monophonic partition and restores held notes on their assigned routes. `tests/playback.test.mjs`, `tests/electron-behavior.cjs`. |
| A5: missing melodic samples / boundary spelling | Fixed: shared sample fallback; output B-1/C9 as `o0c-`/`o8b+`. `tests/playback.test.mjs`, `tests/mml.test.mjs`, `tests/electron-behavior.cjs`. |
| A6: native close loses unsaved edits | Fixed: authenticated Save/Discard/Cancel handshake; failed/cancelled saves or intervening edits keep the window open. `tests/electron-close.cjs`. |
| A7: scoped return collides with header | Fixed: Song and Segment return below the ruler under Time signature; neither at root (updated by user request 2026-09-10). `tests/electron-segment-view.cjs`. |

`tests/behavior-audit.mjs` is a standalone diagnostic, not part of the normal suite. `tests/electron-behavior-audit.cjs` intentionally retains original pre-fix assertions and is historical; use the current regression harnesses above as acceptance checks.

## Remaining limits

See [import/export limitations](IMPORT_EXPORT.md#known-export-limitations) and [audio limitations](PLAYBACK_AUDIO.md#limits-and-revalidation) before promising format fidelity. `EditorState.gesture` remains `any`; a discriminated gesture type would be a separate improvement. Native tests have historically exposed stale selectors and timing-sensitive Undo-hold assertions, so diagnose a failure rather than documenting it automatically as intended product behavior.
