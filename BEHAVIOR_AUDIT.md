# Behavior audit — 2026-09-07

Initial audit of the working source on 2026-09-07; follow-up fixes are tracked below. Pre-existing working changes, including loops, were retained. Unconfirmed behavior must not be documented as intended merely because existing code or tests implement it. **A1 and A3–A7 fixed; A2 confirmed intended. All seven findings reviewed with the user on 2026-09-08.**

## Confirmed intended behavior

The user confirmed these rules during this audit:

- **Explicit V belongs to its own note's onset.** When two notes in one Instrument start together at V13 and V5, each must use its own explicit V. The user answered “Each uses its explicit V.” Higher note IDs must not override another note's explicit value. Fixed in A1.
- **Overlap warnings require the same Instrument instance, start time and pitch.** The user answered “Same pitch only.” Two instances using the same GM voice remain independent. Chords with different pitches are not warning overlaps. Sustained same-pitch notes with different start times are not warning overlaps. More than ten sounding notes remains a separate density condition.
- The user's initial request explicitly requires a V13 note to play at V13 immediately, not set V13 for the next note.

On 2026-09-08 the user settled inheritance for notes with **no explicit V**: “Use the most recently created explicit-V note’s value.” At a shared onset, the highest-ID explicit note supplies the value for unset notes there and afterward; explicit notes retain their own V. The user added “if this occurs, it's on the user to control Velocity,” so no additional ambiguity prompt is wanted. Default V8 and V0 silence remain. Version-2 JSON is unchanged. Artificial clip/repeat onsets intentionally count for warnings, as confirmed in A2.

## Findings

### A1 — Explicit volumes on simultaneous notes overwrite each other (fixed 2026-09-08)

The following paragraphs describe the original failure. The fix uses `resolveVolumes` from `src/music/volume.ts` across playback/held restoration, MML, loops, sheet planning, section slicing, Segment projection/reconciliation, instrument operations and clipboard copying. `volumeAt` now respects a note's explicit V. Removed obsolete simultaneous-volume import/merge/split warnings. Regression: `tests/volume.test.mjs`, inspector/clipboard/Undo assertions in `tests/renderer.test.cjs`, and native `tests/electron-volume.cjs`. Current diagnostic reports no A1 mismatches; A2–A5 still reproduce. The initial audit ZIP preserves the original evidence.

Create C4 V13 and E4 V5 at time 0 in the same Instrument, in that ID order. Both notes play at V5 (MIDI velocity 42); the first should have velocity 110. Selecting C4 shows the stored Volume field V13 alongside **effective V5**. Generated MML likewise emits V5 for both channels. Reversing IDs changes the winner.

This is not a one-note delay: sequential V13, V5, inherited V5, V0, V13 controls correctly apply V before note-on, and MML orders V before the note. The current resolver groups notes at a timestamp and uses its highest-ID explicit V for every note in the group.

The failure also occurs after MIDI import (explicit values are stored correctly), at Segment/section-export starts that clip two crossing notes together, and at untied loop repeats that restart crossing notes together. Two separate Instrument instances with the same preset correctly remain independent.

Owners: `src/music/volume.ts`, `src/playback/midi.ts`, `src/music/mml.ts`. Related resolution copies exist in `src/music/loops.ts`, `src/model/segment-view.ts`, `src/music/structure.ts`, `src/music/sheets.ts`, and `src/model/instrument-operations.ts`. A fix must cover playback/seek, UI, copying, merging/splitting, views and exports consistently.

Fixture: `.validation/behavior-audit/explicit-volumes.json`; screenshot: `explicit-volumes.png` in the same directory.

### A2 — Opening a Segment can introduce an overlap warning without editing notes (confirmed intended 2026-09-08)

User decision: “Create a warning. Multiple notes should generally NOT overlap to begin with, let alone enter a segment overlapping. It's user error and should throw a warning, but not be fixed.” Keep the existing non-blocking warning for coincident same-pitch/Instrument onsets in the actual view/performance. Original onset identity does not exempt clipped or restarted notes. Do not automatically repair the music or reject editing/saving/exporting. This clarification addresses A2; it does not turn different-pitch chords into warning overlaps or change the previously confirmed full-project onset rule.

In one Instrument, C4 starts at 0 for 128 units and another C4 starts at 16 for 128 units. The full project has no overlap warning. Open the Segment from 32 to 96: both continuations are clipped to local time 0, and Instruments now reports an overlap. Return to Project: the warning disappears. The parent notes remain unchanged.

An untied repeat from 64 back to Entry 32 similarly restarts both held voices together and generates the warning. These warnings refer to generated local onsets, not two notes the user originally started together.

Owner: `src/model/segment-view.ts` / `src/music/loops.ts` create clipped onsets; `src/music/mml.ts` checks those notes with `src/music/note-density.ts`.

The existing behavior already satisfies the decision. Added a regression in `tests/note-density.test.mjs` for both clipped and restarted overlaps, successful playback/serialization, and unchanged source notes. The standalone audit now treats the two A2 checks as intended controls, not failures.

Fixtures: `crossing-notes.json`, `untied-loop-volumes.json`; native screenshot: `scope-overlap.png`.

### A3 — Segment view loses inherited volume from a note that already ended (fixed 2026-09-08)

User decision: “Copy the LAST Velocity before entering the view. If the Velocity should NOT be that, it would explicitly be set in the project.” projectSegment now copies the last pre-boundary V per Instrument, retains explicit overrides and seeds inherited onsets only where clipping would otherwise change them. V0, newest-note ties and default V8 are preserved. Implicit crossing notes use the copied boundary V; explicit crossing notes retain their own V. Explicit changes inside the view govern subsequent notes. Clearing V on an edited crossing fragment now restores inheritance. Automatic copied values remain baseline context and do not become parent edits when saving or changing an unrelated property.

The following describes the original reproduction:

Create C4 at 0–128 with V13, E4 at 16–32 with V5, and G4 at 64–80 with no explicit V. In the full project G4 correctly inherits V5. Open Segment 32–96: C4 is clipped in with V13, E4 is outside the view, and G4 incorrectly inherits V13. Both MIDI and MML change, and the native inspector shows effective V13.

This occurs without conflicting explicit volumes at the same original onset. A1 alone does not explain it: the projection confuses a held note's onset volume with the instrument's latest inherited V at the boundary. Simply entering/leaving/saving the untouched view preserves the full project; the wrong dynamics affect the local playback/export.

Owner: `src/model/segment-view.ts`, especially the first-onset seeding in `projectSegment`. Fixture: `scope-inheritance.json`.

Verified: G4 retains V5 in the view's inspector, MIDI and MML. Tests cover V0, an explicit change at the boundary, older held notes with higher IDs, new notes, explicit V removal, unrelated edits and unchanged parent saves. All 107 regression tests passed; the extended native Segment harness passes save IPC, inspector, Undo and Return checks. Current standalone diagnostics no longer report A3. Evidence: .validation/electron-segment-velocity.png and .validation/electron-segment-view.json.

### A4 — Fixed: preserve each original note duration

Create C4 V13 from 0–128, then C4 V5 from 16–32 in the same Instrument. At time 32 the generated MIDI sends C4 note-off. The bundled synthesizer releases the **first** C4 voice (V13) and leaves the second (V5) held until time 128. The intended source durations are effectively exchanged. This is separate from the overlap-warning definition: the starts differ.

The diagnostic drives the actual installed synthesis engine with the compiler's note-on/off events and inspects voice IDs/release state after time 32: voice 1 remains held instead of voice 0. This was not assessed by listening to physical speakers.

Owner: one MIDI channel per Instrument in `src/playback/midi.ts`; the bundled `spessasynth_core` `noteOff` pairs repeated same-pitch notes FIFO. MML already allocates overlapping notes to separate channels. Fixture: `nested-same-pitch.json`.

Confirmed 2026-09-08: honor the original note, as MML places the long and short notes in different Channels. Preview now shares MML's monophonic interval partition in src/music/channels.ts. Each derived channel has its own MIDI route; held-note restoration retains that exact route. Instrument mute/solo and presets apply to every derived channel, including drum channels on separate ports. These are temporary playback routes, not new project Instruments or stored lanes. Existing overlap warnings remain unchanged.

Verified: the actual bundled synth releases the short V5 voice at tick 32 and retains the original V13 voice until tick 128. All 109 tests pass, including routing, seek, MIDI port rollover, presets, drums and simulated mute/solo. The native AudioWorklet harness passes with overlapping notes through section seek, live/paused preset changes, rewind and master volume. Diagnostic A4 now passes; A5 remains reproducible. No physical-speaker or in-game verification performed.

### A5 — Fixed: audible melodic range and MS2 boundary notation

The key preview has a high-note transposition fallback, but song playback sends pitch 109 directly to the bundled Piano preset. On a fresh synthesis engine, C8 (108) produces peak PCM about 0.032; C-sharp 8 (109) produces exactly 0. The compiler reports no skipped note because 109 is within MIDI's supported numeric pitch range.

Owner: `src/playback/engine.ts` applies the fallback only in `getPreviewEngine`; `src/playback/midi.ts` does not apply it for song playback. Existing `tests/playback.test.mjs` verifies that the C-sharp 8 preview fallback sounds. This audit verifies the direct song-note silence; it does not claim every preset/high pitch has the same limitation.

Confirmed 2026-09-08: every melodic pitch from C0 through B8 must sound, plus B-1 and C9 represented by o0c-/o8b+. Shared preset-specific sample fallback now covers all silent ranges in keyboard and song playback. Fixed-tuning MIDI routes preserve release tails and seeking. 42,240 dry-synth cases across all 128 presets, MIDI11–120 and V1/V8/V15 pass; all 112 tests and native AudioWorklet checks pass. The diagnostic now drives compiled high-note events and reports nonzero PCM; its raw-bank silence control remains zero. See PLAYBACK_UPDATE.md for implementation limits and validation.

Notation clarification: GUI labels use #. MML import accepts # as an alias, but generation always uses + or -. Both operators work on every note letter; boundary output stays within O0–O8. Fixture: `high-piano-note.json`.

### A6 — Fixed: Save / Discard / Cancel on native close

The native audit loads a disposable project, verifies `unsaved()` is true, and calls the actual BrowserWindow close path. The window closes and no confirmation is requested. No user project was opened or closed by this test.

`PROGRESS.md` records removal of `beforeunload` cancellation to fix the main window refusing to close after MIDI import. That explains the implementation; it does not establish that silent loss of unsaved work was expressly intended. New/Open/Import replacement prompts still exist.

Owners: `main.cjs`, end of `src/files.ts`.

Confirmed 2026-09-08: offer Save / Discard / Cancel. Main/preload/renderer now perform an authenticated native close handshake, coalesce repeated X clicks and avoid beforeunload cancellation. Save completes before closing; Cancel, cancelled/failed Save and intervening edits keep the editor open. The save baseline records the contents actually written. Native tests cover clean/dirty close, app.quit cancellation, close after import, duplicate X, save errors and full-project saves from Segment View. OS message/file dialogs are stubbed to deterministic choices and isolated files; the actual Electron window lifecycle and IPC are exercised.

### A7 — Fixed: Segment-only return button below the measure ruler

At the default window size, opening “Audit segment” places Return to Project and the Segment label over the left side of the transport. The native screenshot shows the overlap, and DOM rectangles confirm Return to Project intersects the transport in both axes. The existing native Segment test only checks the header's right edge and therefore misses this collision.

Owners: the fixed three-column `.app-header` layout and `.project-identity` / `.segment-identity` sizing in `studio.css`, with structure in `index.html`. Evidence: `scope-overlap.png` and `headerCollision` in the native diagnostic report.

Confirmed 2026-09-08: place the Return to Project button under the measure bar on the right, beneath Time signature, in Segment View only. It now floats 6px below the 30px ruler, with its right edge aligned to the Time signature field, and remains fixed while scrolling. Song View retains return navigation through File; neither return control appears in the root project. The scoped name sits beneath the project field and cannot spill into transport. Native checks cover 1320px/900px widths, exact geometry, real mouse navigation, computed visibility and Sky/Night screenshots.

## Original audit validation and reproduction

- `node tests/run.cjs`: incremental-output build and **98/98 existing tests passed**, including simulated DOM and CPU synthesis checks. The first sandboxed build failed on installed audio dependency access; the approved rerun passed.
- `node tests/behavior-audit.mjs`: **13 control comparisons passed**; diagnostic mismatches reproduce A1–A5. The script emits observed vs expected values rather than declaring current buggy behavior a passing regression requirement. Fixtures/results are under `.validation/behavior-audit/`.
- `tests/electron-behavior.cjs`: native renderer and AudioWorklet regression passed for section seeking, held-note restoration, live/paused preset changes, playback speed, master volume and responsive controls.
- `tests/electron-segment-view.cjs`: native view entry, edit reconciliation, save/export IPC and Undo regression passed. File dialogs are stubbed to isolated destinations.
- `tests/electron-behavior-audit.cjs`: native DOM reproduction of A1–A3, actual test-window closing for A6, and rectangle/screenshot verification of A7. Fixture loading and control clicks are programmatic; this is distinct from the simulated-DOM suite. Both audit screenshots were inspected.

Run the native scripts using `node_modules/electron/dist/electron.exe tests/<script>.cjs` from the project directory. They create isolated preferences and fixtures; do not substitute the running user session. No physical-speaker listening or in-game MS2 testing was performed. The original audit changed no production behavior; A1 was subsequently fixed as described above. `tests/electron-behavior-audit.cjs` records the original pre-fix assertions; use `tests/electron-volume.cjs` for current A1 regression validation.

Current close/layout regression entry points: tests/electron-close.cjs --case=save|clean|discard|quit|import (run each case separately) and tests/electron-segment-view.cjs. The original native audit is historical and intentionally retains its pre-fix assertions.
