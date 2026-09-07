# MML Music Studio 0.3.0 — modular Electron editor

Extract into a NEW folder. Requires Node.js 22.12.0 or later to build the TypeScript source.

```
npm install
npm start
```

The source is TypeScript; the build uses the pinned TypeScript package to generate JavaScript ES modules. This is a transpile/build check, not a static TypeScript type check. Electron main and sandboxed preload are CommonJS. The ZIP also includes generated dist files.

## Editing

- **Ctrl+C / Ctrl+V** (Cmd on macOS): copy the selected group and paste into the active instrument. By default, paste starts at the copied group's end; repeated pastes follow consecutively. Click empty piano-roll space in Select mode to choose a grid-aligned insertion position. Pasted notes remain selected for moving and support Undo/Redo. Timing offsets, pitches, durations and attached tempo are retained; inherited volumes are made explicit. Conflicting tempo changes block the paste without modifying the project. The clipboard is internal to this app window; text-field copy/paste keeps its normal behavior.

- **Draw (D)**: click empty space for one grid-length note. Drag right while creating to extend its duration.
- **Select (S)**: drag empty space for a blue selection box. **Shift-drag** box-selects in either tool. Blue outlines update during selection.
- Click a note to select. Its body cannot move until a subsequent click-drag. Movement begins after four pixels.
- Ctrl/Cmd-click toggles a note in the selection. Ctrl/Cmd-drag a selection box adds notes. Ctrl/Cmd+A selects all notes of the active instrument.
- Drag a selected note to move the group. The first selected note is the timing anchor, regardless of which member you drag. The group keeps its pitch intervals, timing offsets and lengths. A collision blocks the whole move.
- Drag a note's right edge to resize; a resize cursor marks the available hit zone. Edge-resizing also selects an unselected note.
- Delete or Backspace deletes selection; right-click deletes a note. Text fields keep normal editing behavior.
- Escape cancels an active gesture. Undo/Redo buttons and Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z restore project changes.
- Grid L4–L128 changes snapping and alternating gray timing columns. Horizontal zoom changes pixels only.
- Pitch rows match the labeled black/white piano keyboard. Notes use their instrument color; sharp notes are slightly darker. Labels are clipped and centered within canvas notes.
- Scroll vertically/horizontally using the scrollbars/trackpad. Piano keys stay fixed horizontally; measure labels stay fixed vertically. Measures use 4/4 and start at 1.
- Keyboard clicks report a placeholder pitch preview; no audio yet.
- Instrument + adds a named instrument. Double-click its name to rename inline; Enter/blur commits, Escape cancels. Color swatches edit instrument colors.
- Note inspector edits pitch, exact length and optional V0–V15. Empty V inherits the preceding instruction within that instrument. Moving or deleting a note carries/removes its V change.
- Different pitches may overlap as chords; overlapping notes at the same pitch within one instrument are rejected. Instruments are independent.

## Timing and files

Positions and durations are integer 1/128-whole-note units, independent of pixels. L128 is 1 unit, L64 is 2, and L64. is 3 units (enter 3 in the length field). L128. would require a fractional unit and is rejected. The inspector accepts exact integer lengths independently of the snapping grid. Pitch is not constrained to MIDI range: inspector changes and note movement expand the editor extent as needed.

Save/Open use native desktop JSON dialogs. This clean rebuild uses a versioned `mml-studio` version 2 format. It intentionally does not silently load the previous prototypes' pixel-based JSON files. Invalid files are rejected before replacing the open project. Notes belong directly to named instruments, without editing channels. MML channels, export limits and MML/MIDI import/export are deferred. Playback is now available; see PLAYBACK_UPDATE.md.

## Verification

```
npm test
```

Six core tests check timing, whole-group movement, collisions, V persistence, note names and JSON validation. A renderer test invokes actual pointer handlers in a simulated DOM to check create/select without duplication, resize, move, box select/delete, inline rename and grid changes. The build and these seven tests passed in the development workspace. A Chromium/Electron executable was unavailable there, so native dialogs, desktop launch and visual appearance still need a desktop check. No claim of full Electron UI automation is made.

## Working on individual parts

Start with `PROJECT_MAP.md` to find the module for a change, and `PROGRESS.md` for the saved checkpoint. The source is now split by responsibility; build output mirrors these directories and rewrites only changed files. Project JSON and controls remain compatible with v0.2.0.

## Playback and tempo

See `PLAYBACK_UPDATE.md` for General MIDI playback, note-attached T32–T255 instructions, and patch installation. Default BPM is 120. Select a playback preset below each instrument name. Existing version-2 JSON projects remain supported. Current build and all 12 tests pass, including actual PCM synthesis; native audio-device output is unverified.
