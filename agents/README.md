# MML Music Studio

An Electron/TypeScript piano-roll editor for MapleStory 2 MML, with General MIDI preview. The active application is version **0.3.0**; its saved project format remains **version 2**. Earlier web and Avalonia prototypes are not this codebase.

The editor supports note drawing and group editing, instruments and drums, MIDI/MML import, nested loops, temporary Song/Segment views, live MML counts, sheet splitting, and MS2MML/text/MIDI/audio export. Playback uses a bundled SoundFont and needs no MIDI device or network connection after installation.

## Run the source checkout

From the repository root, with Node.js **22.12 or later**:

```powershell
npm ci
npm start
```

`npm start` checks for the optional audio encoder, builds the source, and launches Electron. If `vendor/ffmpeg.exe` is missing, editing and preview still work; see [audio encoder setup](PLAYBACK_AUDIO.md#encoder-setup) for audio export. TypeScript compilation transpiles the source; it does not perform static type checking.

To run a packaged Windows release, extract the entire release ZIP and launch `MML Music Studio.exe`. The `Example Project` folder sits beside the executable. Node/npm are not required for the packaged application. See [release builds](DEVELOPMENT.md#windows-release-build).

## Find the right document

| Need | Read |
| --- | --- |
| Use the editor, shortcuts, panels, note and instrument controls | [EDITOR.md](EDITOR.md) |
| Find the code and tests for a feature | [PROJECT_MAP.md](PROJECT_MAP.md) |
| Contribute, build, validate or package a change | [DEVELOPMENT.md](DEVELOPMENT.md) |
| Preserve JSON, timing, velocity, tempo and MS2 behavior | [MUSIC_MODEL.md](MUSIC_MODEL.md) |
| Work with signatures, sections, scoped views or loops | [STRUCTURE_VIEWS.md](STRUCTURE_VIEWS.md) |
| Understand import conversions, MML generation and file export | [IMPORT_EXPORT.md](IMPORT_EXPORT.md) |
| Understand preview, drums, recording and audio dependencies | [PLAYBACK_AUDIO.md](PLAYBACK_AUDIO.md) |
| Resume work or check actual recent validation | [PROGRESS.md](PROGRESS.md) |

For development, read the project map and latest progress first, plus the repository rules in DEVELOPMENT and MUSIC_MODEL. Then open only the relevant feature document and source files. Paths in prose are repository-relative; links from these documents resolve one level up into the source tree.

## Current documentation and history

These documents describe source inspected on **2026-09-08**, including the latest edge-dragging and paste changes. Confirmed behavior and current code limitations are distinguished explicitly. Test results belong in PROGRESS, where their date and scope are visible.

The [original progress log](history/PROGRESS-2026-09-06-08.md) is preserved byte-for-byte for prior decisions, changed-file lists and validation evidence. Its entries mix historical ordering and include subsequently replaced behavior. Use the current documents for implementation guidance; consult history only when investigating an earlier change. The [consolidation record](PROGRESS.md#documentation-consolidation) maps the retired documents to their replacements.

The root `AGENTS.md` is only a discovery pointer. Runtime assets and third-party license/provenance files stay with the application; development documentation lives here.
