# MIDI import and MapleStory 2 durations

## Workflow

The working folder is updated directly by development changes; patch ZIPs are optional backups/transfers. Restart the editor, click **Import MIDI**, and choose a `.mid` or `.midi` file. Import replaces the current project after confirmation if it has unsaved edits. Cancelling, declining replacement, or choosing an invalid file leaves the existing project untouched. The imported project is unsaved; use **Save JSON** to keep it. The source MIDI file is never changed.

The import report lists approximations and unsupported events. Instrument names include the source track, MIDI channel, and GM preset. Different source tracks, ports, channels, and programs become separate editor instruments. Same-pitch overlaps are retained in extra instrument lanes, since version 2 forbids such overlaps within one instrument. Other chords remain together.

## Export limits belong to export planning

User correction (2026-09-06): importing and editing are not constrained by MapleStory 2 export limits. There are no application-imposed file-size, note-count, event-count, source-track or instrument-lane caps. Import does not truncate music or warn about exceeding target export limits. A future export-planning workflow should report those issues and present export choices without changing the original project. Malformed MIDI validation and the format's own structural rules remain necessary.

Tempo instructions are positive integer BPM, including values outside T32–T255. MIDI import rounds fractional BPM to the nearest whole number and reports this conversion. The editor and JSON validator reject fractional tempo instructions; no JSON shape change is required. Any target-specific tempo restrictions are deferred to export planning. Older editor builds that enforced T32–T255 may reject projects containing the newly supported tempo values.

## Permanent dialect rule: lengths are not limited to powers of two

User-confirmed requirement (2026-09-06): **the MapleStory 2 dialect of MML allows non-power-of-two note lengths.** Future MML parsing/export must not assume only conventional length denominators or silently normalize music to powers of two.

Keep these concepts distinct:

- Version-2 project timing uses 128 integer units per whole note (32 per quarter). `note.length` accepts **any positive integer**, including 5, 7, 11, 13, etc. It is not an MML denominator: a length of 7 means 7/128 of a whole note, not `L7`.
- An MML denominator describes a fraction of a whole note. Non-power-of-two denominators may imply fractional current model units. Supporting those exactly would need a separately designed timing change/migration; the current JSON schema is intentionally unchanged. Do not invent denominator bounds or syntax without verifying the dialect when implementing export.
- The L4–L128 **grid dropdown is an editing/snap preference**, not a whitelist of legal note lengths. Changing grid or zoom must not change imported durations. Deliberate edge resizing still uses the chosen grid.
- Import converts absolute MIDI note-on and note-off ticks using `round(tick * 32 / PPQ)`. Length is the rounded endpoint difference, at least one unit. Representable lengths stay exact regardless of whether they are powers of two. Finer timing is rounded to the existing model resolution and reported. For example, a quarter-note triplet at 32 units per quarter is not exactly representable; this version does not claim lossless arbitrary MIDI timing.

## Supported and approximated data

- Standard MIDI File formats 0 and 1 using PPQ timing; multiple tracks, running status, MIDI ports, program changes, note-on/off, chords, leading rests and sustain (CC64). MIDI note-on velocity zero is a note-off. Overlapping repeated pitches pair note-offs in FIFO order.
- Program selection is captured when a note starts. Banks are reduced to the GM preset; bank-selection messages are reported as unsupported.
- Velocities map to explicit V1–V15 instructions per note. This is a quantization of MIDI's 1–127 velocity range, reported after import.
- Sustain becomes longer note durations. All Sound Off, All Notes Off and Reset All Controllers handle held notes. Other controllers, pitch bend, aftertouch and SysEx are reported but not represented.
- Global tempo is converted from MIDI microseconds per quarter to the nearest integer BPM, without export-range clamping. Fractional source tempos produce a rounding notice; preview follows the rounded instruction, so the source microsecond timing may change. Conflicting coincident changes are reported; the last tempo event at a rounded position wins and unchanged values are omitted.
- T is attached to a note at the same start position where possible. Tempo changes in rests or inside a held note create a **Instructions (silent)** instrument with V0 event carriers. They affect the global clock without splitting/retriggering audible notes. Moving/deleting those markers moves/removes the tempo instructions, just like other note-attached T values.
- GM1 percussion-channel (channel 10) notes import as Standard Drum Kit and play percussion. The requested non-blocking warning says it is not a valid MS2 instrument; this does not prevent importing, editing, saving or previewing. Alternate kit programs use Standard Drum Kit with a conversion notice. GM2/GS/XG or SysEx-selected drum routing on other channels is not detected. See DRUM_KIT.md.
- MIDI time signatures (FF 58) import as silent Instructions markers, including explicit 4/4 and signature-only files. They never attach to musical notes; an existing unbound tempo marker at the same position is reused. Marker positions use the same reported 1/128-unit rounding as notes. Conflicting signatures at a rounded position use the last event with a notice. Denominators finer than 1/128 are skipped with a model-limitation notice; malformed payloads/zero numerators fail validation. Nonstandard notated 32nd-note scaling is reported; numerator and denominator remain intact. MIDI lyrics/text/key-signature metadata are not imported as editor objects. Explicit trailing silence after all notes is not stored, because version 2 has no independent song-length field.
- Dangling notes end at the file's final event, with a warning. Unmatched note-offs are ignored with a warning. Zero-length notes become one timing unit.

Format 2 (independent sequences), SMPTE timing, and RIFF/RMID wrappers are rejected with a clear message. Convert those to a standard format-0/1 PPQ `.mid` first. These are decoder capability distinctions, not export-planning limits. Likewise, existing 1/128-unit timing and V-scale conversion are reported model conversions, not note-count/export restrictions.

## Maintenance and validation

`src/import/smf.ts` validates binary chunk boundaries and reads events without arbitrary size/count caps. `src/import/midi.ts` converts them to a version-2 project. Both are pure and have no DOM/audio dependencies or new npm packages. `src/files.ts` owns UI orchestration; main.cjs/preload.cjs provide a native file picker and byte IPC. Renderer wiring is unchanged. Large-song validation groups/sorts notes rather than checking every pair; viewport bounds, new note IDs, and playback compilation avoid spreading entire songs into function arguments. Playback computes inherited V once per start group.

`node tests/run.cjs` builds incrementally and runs conversion/round-trip/malformed-input regressions plus existing suites. `node_modules/electron/dist/electron.exe tests/electron-midi-import.cjs` exercises native file reading, IPC, renderer import/report, dirty-state protection, arbitrary durations and playback. Its file-dialog selection is stubbed: it does not certify interacting with the OS picker or hearing physical speakers.

File-format reference: [MIDI Association Standard MIDI Files specification](https://midi.org/standard-midi-files). The MapleStory 2 duration rule above is a project requirement supplied by the user, not a claim inferred from the MIDI specification.

