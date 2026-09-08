# Import, MML generation and export

File > Import MIDI / MML parses before replacing the open project. Cancellation, invalid input or declining unsaved replacement leaves the project intact. Successful imports are unsaved version-2 projects; save JSON to keep them. Failures open an Import failed report, and conversion notices appear in the success report.

Project/open/import instruction events automatically enable Advanced Instructions, including unbound tempo changes from MIDI/MML and imported signatures. The dedicated Instructions card stays last and does not count toward the musical-instrument total in the sidebar or import report. Its events remain active if the card is hidden. Version-2 files with multiple old Instructions lanes are loaded into one dedicated lane, preserving events and remapping owners.

Import/editing have no application-imposed file-size, note/event/track/instrument-count caps or MS2 tempo clamps. Keep decoder validation and reported model conversions distinct from export compatibility. [MUSIC_MODEL.md](MUSIC_MODEL.md) is the behavior contract; [PROJECT_MAP.md](PROJECT_MAP.md) links implementation and tests.

## MIDI import

The binary reader accepts **Standard MIDI File format 0/1 with PPQ timing**. It supports multiple tracks, running status, MIDI ports, programs, note-on/off, chords, leading rests and sustain CC64. Different source track/port/channel/program combinations become separate named instrument instances. Program selection is captured at note onset. Source files are never modified.

| Source data | Stored result or report |
| --- | --- |
| Absolute note-on/off ticks | Endpoints round with `round(tick * 32 / PPQ)`; length is the endpoint difference, at least 1 unit. Representable arbitrary lengths stay exact. Finer timing reports 1/128-whole-note rounding, not grid snapping. |
| MIDI velocity 1–127 | Explicit V1–V15 per note, with a quantization notice. Each chord note retains its own explicit V. Note-on velocity 0 is a note-off. |
| Repeated overlapping pitches | Source note-offs pair FIFO. The resulting notes remain editable; subsequent preview isolates their stored lifetimes on derived routes. |
| Sustain and held-note resets | Sustain becomes longer durations; All Sound Off, All Notes Off and Reset All Controllers handle held notes. |
| Tempo | Microseconds/quarter converts to nearest positive integer BPM, reporting fractional rounding and never clamping to T32–T255. Last event at a rounded position wins reported conflicts; unchanged tempos are omitted. |
| Note-bound / unbound tempo | Attach at a matching musical onset when possible; otherwise use a silent Instructions carrier, including changes inside a held note or rest. |
| Time signatures FF 58 | Silent Instructions markers, including explicit 4/4 and signature-only files. Reuse an unbound tempo marker at the same tick. Last rounded-position conflict wins with a notice. |
| Channel 10 percussion | Standard Drum Kit, with the requested non-blocking MS2 warning. Alternate kit programs reduce to Standard Kit with a notice. |
| Dangling notes / unmatched note-offs | End dangling notes at the last file event and report; ignore/report unmatched note-offs. Zero-duration notes become one unit. |

Bank selection reduces to GM program and is reported as unrepresented. Other controllers, pitch bend, aftertouch, SysEx, lyrics/text/key-signature metadata and nonstandard drum routing are not represented. Signature denominators finer than 1/128 are skipped with a model-limitation notice; malformed payloads/zero numerators fail validation. Nonstandard notated 32nd-note scaling is reported.

Format 2 independent sequences, SMPTE timing and RIFF/RMID wrappers are rejected as unsupported decoder formats. Independent trailing silence after all notes/events has no dedicated version-2 song-length field and is not preserved simply from a MIDI end-of-track event.

Owners: `src/import/smf.ts` reads validated binary chunks; `src/import/midi.ts` converts to the project; `src/files.ts` and main/preload own dialogs/IPC/reporting. Import dispatch currently recognizes MIDI by `.mid`/`.midi` filename extension; other selected files use UTF-8 MML parsing.

## MML files and external text paste

Files support UTF-8 `.mml`, `.ms2mml`, `.mne`, plus recognized contents through Text/All files filters. The parser supports this common subset:

- A–G notes, `+`/`-` accidentals (`#` accepted as an alias), R rests, N numeric pitches, O octaves and `<`/`>` octave shifts.
- L defaults, explicit positive length denominators, dots, V0–15, positive integer T and adjacent same-pitch `&` ties. Defaults are O4/L4/V8/T120.
- Whitespace, `//` and `/* */` comments; comma-separated plain channels or `MML@...;` wrappers with a required final semicolon.

Any positive denominator can be parsed. Fractional boundaries round **cumulatively** to nearest integer units with a warning; a duration rounding to zero is rejected as a model limitation. Tied pieces become one held note. A V change within a tie retains the initial onset V and reports that conversion. Tempos inside held notes/rests use Instructions; conflicting global tempos fail atomically.

| Container | Interpretation |
| --- | --- |
| MS2MML | `ms2` XML containing melody/chord children, CDATA or escaped text. Double-quoted channel attributes include game-produced `chord="N"` and exported `index="N"`. |
| MNE | Supplied text format with one named part per MML@ score and zero-based GM program numbers. Ancillary editor metadata is reported as unrepresented. |
| 3MLE | Channel sections and TrackName settings; each channel becomes a separate instrument. Arbitrary editor instrument assignments/settings are not mapped. |

Real-sheet compatibility also accepts repeated tie markers, ignores bare L while keeping the prior default, and skips source-editor M measure labels and s switches, each with a notice. Unknown commands/macros/loop syntax, invalid ties and V above 15 still fail; do not clamp loudness. This parser does not promise every historical MML dialect or legacy non-UTF-8 encoding. Imported pitches outside MS2's target range remain stored for later compatibility warnings.

External grid paste uses this parser before committing notes/history. Musical parts combine into the active musical instrument; unbound tempo carriers use Instructions. See [clipboard behavior](EDITOR.md#copy-and-paste) for its insertion position versus internal group paste. Native copy/paste events belong to `src/keyboard.ts`; insertion/scope validation belongs to `src/note-clipboard.ts`.

## Generated channel text

Each instrument's Instrument actions contains its total Character count, channel count, Real time updating checkbox, Update MML and Open MML. Real-time updating defaults on. Turning it off retains a visibly Out of date snapshot until Update; selection/scroll/Mute/Solo do not regenerate unchanged strings. New/Open/Import reset session caches. Generated strings are never stored in JSON.

Open MML is a non-modal native window. Channel tabs show individual counts; Copy to clipboard copies exactly the selected raw string without wrappers/whitespace/newlines. The window follows its instrument, clamps removed tabs and clears on project replacement.

`src/music/mml.ts` expands loops, partitions overlapping voices into the minimum monophonic channels, emits leading rests and exact durations, propagates the global tempo clock, and applies resolved per-note V. `src/music/mml-optimizer.ts` then compacts L defaults and redundant V commands without changing music. Counts, file export and sheet planning share this optimized output. It is not a global shortest-score search; channel allocation, duration decomposition and sheet-cut optimization are separate concerns.

Generated syntax is ASCII, so characters equal UTF-8 bytes. An instrument's count is the sum of raw channel strings; XML markup and text separators do not count. Normal empty instruments produce no musical channels. Instructions never become sounding MML notes. More than ten channels, Standard Drum Kit, identical-onset/pitch overlaps and target-range pitch/tempo issues warn without truncating the generated data.

See [MS2 notation rules](MUSIC_MODEL.md#ms2-notation-and-compatibility) for L64 defaults, explicit 128th lengths, dotted defaults, boundary pitches and tie placement. Musical GM program selection is external to raw MML; fixed MS2 drum output maps notes to C4 without changing source pitches.

## Export choices

Export is one dialog with four formats and selected/all-instrument scope. These read the active project projection, independent of stale manual MML snapshots.

| Format | Output | Settings used |
| --- | --- | --- |
| MS2MML sheet | One XML file per musical instrument; melody followed by indexed chord elements. | Character-limit single/parts choice; optional section separation at root. |
| MML text | Same raw channel strings in `.txt`, blank lines between channels and a final newline. | Same sheet limits and section choices. |
| MIDI file | Format-1 performance from `compilePlayback`, 32 PPQ, conductor/global-tempo track and derived voice tracks. All instruments share a file per chosen section/scope. | Expands loops; no character limit. Uses stored notes/velocities/presets, not session speed/master volume/Mute/Solo. |
| Audio | One mixed WAV/MP3/OGG/FLAC/M4A/Opus file for the current view. | Snapshots speed/master volume/Mute/Solo; no sheet limits or section splitting. See PLAYBACK_AUDIO. |

At the root, **Export sections as separate song sheets** splits MS2MML/text/MIDI at every named boundary, independently of Reset measure count. Loops expand before slicing. Music before the first boundary is retained as Opening; prefixes are ordered by section. Held notes clip/restart in each file with needed starting tempo/volume. Empty/Instructions-only musical outputs are omitted; without markers, whole-project behavior applies.

In Song/Segment View, exports use the local projection and view name; additional section splitting is disabled. JSON Save always saves the full parent instead. MML text files with blank-line channel separation are for reading/sharing; the importer expects comma-separated channels and does not promise direct multi-channel `.txt` round-trip fidelity.

## Character limits and synchronized parts

The **Character limit** field beside the roll is a saved application preference, default 10,000, accepting positive safe integers. It never limits JSON save, import, editing or raw generation. The active musical instrument's red timeline line indicates its first planned boundary at/over the limit. A limit too small for the next notes/controllers marks the beginning. The overlay uses current music even when manual MML updates are paused.

When an instrument exceeds the limit, export offers **Yes, and in a single file**, **Yes, in parts**, or **No**; Escape cancels. One file keeps everything, including over-limit content. All part plans are generated/verified before writing begins. Canceling an OS save stops subsequent writes and reports how many files were already saved.

Each part spans one shared `[start, end)` interval across that instrument's channels. Carried notes clip locally, keep resolved onset V, and restart in the next file; ties cannot cross independent files. Leading silence and trailing padding to the common cut count toward the limit, as do tempo/octave/volume commands. Different instruments have independent sheet boundaries.

The planner finds a verified fitting cut and prefers a clean gap within 32 units (one quarter note) before it. Otherwise it divides held notes. Encoded sizes are non-monotonic, so it checks nearby integer boundaries and independently verifies every part. This conservative planner is not optimal packing. If no positive-progress cut fits, it reports the issue instead of truncating or writing oversized parts.

## Known export limitations

These are code-inspected limitations as of 2026-09-08, not newly approved behavior or fixes made during documentation work:

- **Selected-instrument MIDI filters the clock's source notes.** `src/export.ts` retains the selected instrument and Instructions events, but drops tempo carriers on other musical instruments before compilation. Audio and musical MML retain the global clock. Broader MIDI tempo preservation needs a separate fix.
- **Scoped MIDI does not pass the view's explicit end** into `compilePlayback`; silent time after its last included event can be shorter than the view. Live playback and audio pass that boundary explicitly.
- **MIDI is the preview compiler's performance output**, including sample-fallback tuning/routes. It emits tempo and voice data, not editor time-signature/section metadata. It is not a lossless project interchange format, and compiler warnings/skipped pitches are not surfaced by the MIDI file-export success message.
- **Compatibility warnings are not a complete export-resolution wizard.** More than ten MML channels are retained (XML is not capped at nine chords); out-of-range tempos/pitches and Standard Kit remain the user's responsibility. Only character overflow currently presents the single/parts/cancel choice.

MIDI/preview encoding also has actual binary timing/tempo/port constraints; see [audio limits](PLAYBACK_AUDIO.md#limits-and-revalidation). Do not turn those execution limitations into project/import restrictions. Automated decoding and native harnesses cover specified behaviors; in-game MS2 playback is not established by those checks.
