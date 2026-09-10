# Music and project rules

These rules preserve the user's confirmed musical behavior. See [PROJECT_MAP.md](PROJECT_MAP.md) for owners and tests, [STRUCTURE_VIEWS.md](STRUCTURE_VIEWS.md) for projection/loop details, and [IMPORT_EXPORT.md](IMPORT_EXPORT.md) for format conversions. Model/music functions must remain free of DOM and editor-state dependencies.

## Version-2 project data

The persisted format is `mml-studio`, version `2`. Sources: [types](../src/model/types.ts), [parser](../src/model/serialization.ts), [validation](../src/model/validation.ts), [defaults](../src/model/project.ts). Do not change the format without an explicitly requested migration.

| Object | Fields and meaning |
| --- | --- |
| Project | Required `format`, `version`, `grid`, `instruments`, `notes`; optional string `name`. Grid is one of 4/8/16/32/64/128. At least one instrument is required. |
| Instrument | Required `name` and six-digit hex `color`; optional `volume` (integer 0–100%, absent means 100%; playback/audio gain independent of note V), `midiProgram` (zero-based 0–127), `isDrum`, `isInstructions`, `ms2Drum` (`snare`, `bass`, `cymbals`). Special roles are mutually exclusive. Missing flags mean melodic; missing program uses GM Piano. |
| Note/event | Required unique integer `id`, owning instrument index, integer `start >= 0`, integer `length > 0`, integer numeric `pitch`, and `volume` (`null` or integer 0–15). |
| Optional instructions | `tempo` (absent/null to inherit, otherwise positive integer BPM), `timeSignature`, `section`, `resetMeasures`, `loopEntry`, `loopExit`, `loopTie`, `loopCount`, `speedEntry`, `speedExit`, `speedMultiplier`. See STRUCTURE_VIEWS for validation and activation. |

Notes belong to instrument instances, not presets or editable channels. Two instruments using the same sound remain independent. Channels for MML/MIDI are temporary derived data. Pitch integers are not restricted to the MIDI or MS2 target ranges during editing/storage.

Instructions use existing note-shaped records, marked by the owner's `isInstructions` flag. Newly drawn/imported silent carriers use length 1 and V0; do not synthesize them as musical notes. `src/model/instructions.ts` recognizes the old specifically named `Tempo markers (silent)` lane when its records are silent tempo carriers.

On import, condense silent Instructions events at the same timestamp into one record containing all payloads, including tempo/signature/Speed Multiplier. Reuse its surviving ID for selection. Last-encountered conflicting import payload values win with a notice. Musical note-bound settings remain on their notes; existing version-2 JSON loading is unchanged. This import rule was explicitly clarified by the user on 2026-09-09.


Instructions uses the fixed blue color #579dff; loading version-2 files normalizes older Instructions colors without changing musical instrument colors or events.

Instructions is a permanent, dedicated UI lane, hidden by default behind Enable Advanced Instructions and automatically revealed for project/import instructions. It is excluded from musical instrument counts, preset choices, Mute/Solo and instrument actions. Its events always apply even while the card is hidden or a musical instrument is soloed. The unused card is virtual until selected or needed by an edit/import, so simply toggling visibility does not add project data. Selection materializes the existing version-2 `isInstructions` record; no new JSON fields are introduced. Loading older files with multiple Instructions lanes consolidates them into the first, retaining every event/ID and remapping instrument ownership.

Selection, viewport/zoom, tools, playback settings, Mute/Solo, collapse state, generated MML and Song/Segment session metadata are not project fields. Theme, panel geometry, piano-key style and character limit are local application preferences. Grid is stored in the project even though it only controls editing resolution.

## Timing: model units are not MML denominators

One whole note is **128 integer model units**; one quarter is 32. Any positive integer note length is legal, including 5, 7, 11 and durations longer than a whole note. `length: 7` means 7/128 of a whole note, not the MML denominator `L7`.

| Expression | Model duration |
| --- | --- |
| `c4` | 32 units |
| `c64` | 2 units |
| `c64.` | 3 units |
| `c128` | 1 unit |
| `c128.` | 1.5 units; cannot be stored exactly in version 2 |

MapleStory 2 MML supports non-power-of-two length denominators. Do not restrict imported/stored/exported durations to the grid dropdown or conventional power-of-two lengths. A denominator that implies fractional model units needs reported conversion under the current format; exact finer timing would require a separately designed model change.

The editing grid defaults to L4 and offers L4–L128. Changing grid or either zoom axis must not alter existing notes. Creating a note uses the clicked cell's left boundary; deliberate movement/resizing uses snapping, with group movement anchored on the first selected note. Import performs reported model-resolution rounding, never silent grid snapping. ABC import may round sub-unit rests to zero with a notice (user-authorized 2026-09-09); its fractional cumulative clock continues and no musical notes are removed. User-authorized best-effort ABC file recovery expands musical durations that round to zero to one unit, retains the original cumulative onset clock and reports possible overlaps. Direct strict ABC parser calls still reject zero-duration notes. Tools > Simplify Timing is an explicit undoable conversion, separate from import and MML string optimization.

## Velocity and inheritance

Use the shared [volume resolver](../src/music/volume.ts) for playback, held restoration, MML, copying, instrument operations, loops, sheet cuts and projections.

1. Every explicit V controls its own note at its onset. Simultaneous C4 V13 and E4 V5 must each use their explicit value, regardless of note IDs or array order.
2. An unset V inherits the latest onset's explicit V in the same instrument. If several explicit values share that onset, the most recently created note (highest ID) supplies inheritance for unset notes at that onset and afterward.
3. With no preceding setting, use V8. Explicit V0 is silence and must survive every transformation.
4. Moving/deleting a carrier moves/removes its V instruction. Later V changes do not change a held note's original onset velocity.

The user is responsible for velocities in ambiguous chords. Do not add conflict prompts, flatten explicit values or let an internal ID overwrite another note's explicit V.

Song/Segment views copy the last explicit V before the boundary per instrument, including a carrier that has ended. Explicit crossing notes keep their own V; inherited crossing notes use the copied boundary value. Explicit changes inside the view govern later inheritance. Automatic context must not become a parent edit merely by opening, saving, returning or editing an unrelated property; clearing an explicit V restores inheritance. The projection tracks a baseline to make this distinction.

Explicit Tools commands target selected musical notes, otherwise the active instrument, within the current view. Volume offsets warn before clamping but permit it (user decision 2026-09-10); unselected effective velocities remain unchanged. Held Note Simplifier trims only eligible earlier sounding notes above ten voices, prioritizing exact-pitch retriggers, lowest onset V, then oldest onset. Chord Simplifier retains outer notes and limits exact-onset/exact-length groups to the chosen complexity, using spacing and an optional estimated-scale preference. Tools edits are explicit and undoable, never automatic warning repair. Ordinary MML export may separately offer an explicit export-copy fitting choice above ten channels: held-note simplification followed, only if needed, by chord complexity 2; fail before saving if still over ten. This does not edit the project. See [tool details](EDITOR.md#explicit-cleanup-tools).

## Global tempo

Default tempo is **120 BPM**. Stored T instructions are positive integers; no editing/import clamp to MS2 T32–T255 is permitted. Fractional MIDI tempos round to the nearest whole BPM with a conversion notice. Conflicting simultaneous explicit tempos are invalid; matching values are allowed.

Only additive drag/drop imports into populated projects offer retaining or removing T instructions; menu replacements and empty-project drops retain T automatically. Retained file conflicts are normalized before commit: the last encountered source tempo wins, and a dropped tempo supersedes conflicting existing T at the same position (later dropped files win). Report replacements rather than rejecting the import. This import policy does not relax stored-project/editing validation or change strict clipboard-paste behavior. Removing imported T preserves musical notes/V and other instruction payloads, and uses the current/default clock.

File import may explicitly offer the user a Speed Multiplier conversion for out-of-range tempos, as described in IMPORT_EXPORT. Automatic conversion uses only ×2/×4 with at most 2 BPM error, or exact ÷2/÷4 for slowdown. Report approximations; tempos that cannot fit remain unchanged with a notice. Declining retains original tempos. This is not an implicit parser clamp or a restriction on manually edited/stored Speed Multiplier values.

Note-bound and unbound tempos share one global clock. Unbound supported tempos belong to Instructions, including changes in rests or inside held notes. Muting an instrument must not remove its tempo from live playback, audio rendering or musical MML channels. Blue default timeline indicators use the same clock and omit redundant changes/implicit default 120.

Generated musical channels must carry global tempo changes through their last note. Split rests and held notes at tempo boundaries; tie held continuations. MS2 ties prefix the continued note: emit `c4t150&c4`, never `c4&t150c4`. The selected-instrument MIDI file exporter currently has a separate [tempo-filtering limitation](IMPORT_EXPORT.md#known-export-limitations); it is not an exception to intended global-tempo semantics.

## Simulated speed zones

**User-reported in-game observation, 2026-09-09:** the removed sound-conversion experiment's tempo behavior worked with generated timing substantially finer than 1/128. Treat 128 as the editor/model resolution, not a demonstrated maximum MML-engine denominator or audio sample rate. No exact upper engine limit has been measured. Speed Multiplier may continue deriving finer output durations from integer notes; this does not authorize finer imported/stored note positions or lengths. Import and the program grid remain at 1/128-whole-note resolution (one integer model unit), with existing reported rounding/rejection for fractional source timing. The converter itself is not retained.

Advanced Instructions offers Multiplier Entry (default 2×) and Multiplier Exit. Optional version-2 fields are booleans `speedEntry` / `speedExit` and a positive finite numeric `speedMultiplier`; absent fields preserve existing behavior. See [zone and view rules](STRUCTURE_VIEWS.md#simulated-speed-multiplier-zones).

**2026-09-09 replacement audio converter:** voice-line drops now synthesize up to five spectral voices every 30 ms using T250 and ×4, with 16 integer model units per frame. The final frame rounds to the nearest unit (1.875 ms); source notation import precision remains unchanged. See [voice-line audio drops](IMPORT_EXPORT.md#voice-line-audio-drops). This replaces the removed experiment mentioned above; it does not establish an engine denominator limit.

Editable note positions, lengths, grid and stored integer BPM stay unchanged. The shared playback clock multiplies BPM in the zone. MML uses the base BPM and divides every note/rest span by the active multiplier, tying held continuations at boundaries. Decimal multipliers and fractional derived durations use exact rational notation; they are not rounded back into version-2 note timing. Explicit denominators beyond 128 receive a target-support warning. MML import still has the existing integer-model-resolution conversion rules.

## Overlap warnings, density and note lifetimes

| Condition | Required behavior |
| --- | --- |
| Identical start, pitch and instrument instance | Non-blocking overlap warning. Keep notes editable/saveable/exportable. |
| Sustained same-pitch notes with different starts | No identical-onset overlap warning. Their lifetimes still overlap for channel allocation. |
| Different-pitch chord | No overlap warning solely because it is a chord. |
| More than ten simultaneously sounding notes | Separate density condition: yellow regions/markers for the active musical instrument. Instructions do not count. |

Use current Segment/Song projection or expanded loop onsets for warnings. Clipping or an untied repeat can restart two held same-pitch notes together; warn even if their original starts differed. This is user-confirmed behavior (A2), not a false positive to suppress. Never automatically trim, delete, move or otherwise repair notes in response to a warning. The explicitly invoked Remove overlap tool is a separate editing command.

Preview must honor every original start, duration and resolved onset V, including a short same-pitch note nested in a long one. Use [shared monophonic channel partitioning](../src/music/channels.ts) and keep exact routes for held-note restoration. Same-channel MIDI note-off pairing must not exchange note lifetimes. All derived routes follow the owning instrument's preset and Mute/Solo settings; they never become stored lanes.

## MS2 notation and compatibility

- Named-note octaves are O0–O8 (C0–B8). The adjacent boundary pitches B-1 and C9 are spelled **only** `o0c-` and `o8b+`.
- `+` and `-` shift every note letter by a semitone, including E+, B+, C- and F-. Generate `+`/`-`, never `#`; accept `#` as an import alias. GUI labels retain sharps such as C#.
- Explicit `c128` and `r128` are valid. Default lengths stop at **L64**: never emit L128. A grid label of L128 is an editing resolution, not permission to emit that command.
- Dotted defaults such as `l1.` are supported. An explicit length overrides the complete default: `l1.c128` is one unit.
- Conventional dotted lengths and ties can represent every integer model duration exactly. Their use in generated strings does not imply that the dialect forbids other denominators.

Melodic preview must sound from C0 through B8 and both accidental boundaries. Keyboard and song preview share the preset-specific sample fallback in `src/playback/sample-pitch.ts`. Standard Drum Kit keeps its percussion mapping; fixed MS2 drums keep their mapped sounds.

## Instruments, import and preservation

Standard Drum Kit is supported for General MIDI import/editing/preview. Show the user's non-blocking warning: **Not a valid MS2 instrument. Available for editing and preview.** Keep projects saveable; do not silently convert/delete drum parts. Fixed MS2 Snare Drum, Bass Drum and Cymbals are separate supported presets. Their mappings and explicit splitting tools are described in PLAYBACK_AUDIO.

Import/editing must not enforce export limits: no application file-size, note/event/track/instrument-count caps, no truncation, no MS2 tempo clamping. Keep malformed-file checks and report actual decoder/model limitations. Export warnings and character-limit choices do not grant permission to change original music. Broader target-specific resolution choices remain future work.


Instrument merge retains destination settings, transfers source notes/events, materializes inherited V as needed and reindexes owners. Instructions cannot be merged from/to or deleted as a lane; its individual events remain editable/deletable. Deleting the final musical instrument leaves an empty Piano and preserves the dedicated Instructions events. Scoped operations preserve outside music and shared instruments; use the projection helpers rather than applying full-project deletion semantics blindly.

## Saving and closing

Save and history must use the reconciled full project, even while a Song/Segment is open. Replacement workflows reset the scoped session only on success. Automatic clipping/context is not saved as an edit.

Unsaved-close behavior is an Electron main/preload/renderer handshake. Offer Save / Discard / Cancel; cancelled/failed saves, Cancel, or intervening edits keep the editor open. Save records the contents actually written. Coalesce repeated close requests and never replace this with cancelling `beforeunload`.

Return to Project floats below the measure ruler, right-aligned under Time signature, **in both Song and Segment Views**. Neither scoped view uses File > Return to Project. The full project shows neither return control.
