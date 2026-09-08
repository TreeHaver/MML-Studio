# Instructions, sections, views and loops

These features use optional metadata in version-2 JSON. [MUSIC_MODEL.md](MUSIC_MODEL.md) defines the common timing, tempo and volume rules; [PROJECT_MAP.md](PROJECT_MAP.md) identifies source/test owners.

## Silent Instructions

Turn on **Enable Advanced Instructions**, select the dedicated **Instructions** card at the bottom of the instrument list, draw a marker and select it. The inspector exposes Tempo, Time signature, Section, Reset measure count and loop fields. Pitch/length/volume editing is disabled for these events. New markers have no explicit tempo, so adding a visual guide does not introduce a T command. The card is hidden by default and auto-enabled for project/import instruction events. Hiding it never disables tempo, sections or loops; musical Mute/Solo never affects Instructions.

Unbound tempo and imported MIDI signatures reuse/create this silent lane. Instructions are stored as note-shaped records but never sound or consume musical MIDI/MML channels. Moving/deleting a marker moves/removes its instructions and supports Undo.

The roll paints 15-screen-pixel instruction bands independently of pitch/zoom. Click a band or its caption to select it; captions can select an Instructions lane from another active instrument. Tempo, signature, section and reset captions group by position in bordered boxes below the ruler. Neighboring boxes stack, stay fixed vertically while scrolling, and ellipsize long text at the viewport edge. Full text remains in the inspector. Yellow tempo lines include both note-bound and unbound actual changes.

## Time signatures and measure numbers

The default is **4/4**. A marker's blank signature inherits; a nonblank signature starts a measure at that marker's **exact start**. An off-boundary change ends the preceding partial measure. Signature changes alter bar/beat guides, not musical timing or grid snapping.

The two entry paths have different placement behavior:

| Entry path | Placement and validation |
| --- | --- |
| Inspector on an Instructions marker | Signature takes effect at that marker's exact position. |
| Time signature field in the roll caption | Captures the playhead/visible start when editing begins. If there is no explicit signature yet, sets the initial signature at tick 0; otherwise edits the containing measure's start. Reuses or creates a silent marker there. |

Typed signatures accept 1–32 beats over 1/2/4/8/16/32/64/128. Files use the broader positive-numerator validation, subject to safe timing arithmetic; loading existing/imported signatures is not limited to the UI's numerator range. A rejected caption edit shows a red field and status explanation; blur restores the actual signature. The display follows signature changes while playing.

A nonblank Section names a boundary. **Reset measure count** on a named section realigns that exact tick to measure 1 using the active signature. With reset off, the name alone neither realigns nor renumbers measures. Blank names never reset measures. Conflicting nonblank names or signatures at one tick are rejected; identical duplicates are allowed.

Signature/section/reset metadata becomes active as visual structure only on Instructions lanes. Legacy metadata on musical lanes remains stored without automatic activation. Instructions is no longer a switchable sound preset. These guides do not themselves change generated MML or sounding notes; export slicing is a separate chosen action.

## Section navigation and scoped boundaries

Use the **Section menu beside Tools**: Go to, Open Segment, Open Song. Go to parks the next playback start or seeks the running/paused performance. The menu/action visibility follows available markers and the current scope; it hides when none apply.

| View | Start markers | End |
| --- | --- | --- |
| Song | Named Instructions markers with Reset measure count on | Next Song marker, ignoring intermediate Segments. |
| Segment | Every named Instructions marker, including Song boundaries | Next named marker, whether Song or Segment. |

The latest matching marker at/before the playhead determines the view. The UI offers Open Song at the root when reset-marked boundaries exist, and Open Segment when non-reset named markers exist. Once Open Segment is available, its interval may also begin at a Song boundary: the pure range calculation uses every named marker. Before the first matching marker or at/after the effective final end there may be no view to open. Without a following boundary, the end is the latest note/event end; otherwise silence up to the next boundary belongs to the view.

Opening stops playback, clones/clips the interval into a local timeline starting at zero, and starts measure numbering at 1. A Song containing Segments can open its current Segment. A Segment hides further section navigation. Return always goes to the full project, translating the playhead to absolute time.

Segment View's **Return to Project** floats 6px below the current 24px ruler, under Time signature, and remains fixed while scrolling. Song View returns through File. The root project shows neither return control. The scoped name appears beneath the full Project name.

## Editing without damaging the parent

The active `state.project` is the editable local projection. `state.segment` holds the root, projection baseline/range and source-instrument mapping. `fullProject()` reconciles explicit local edits into the parent; `historySnapshot()` and Save must use it.

Opening a view alone must not shorten/split source notes or write automatic context into the parent. The baseline distinguishes clipping/inherited context from deliberate edits:

- Notes crossing either boundary are clipped locally. Editing/deleting one changes only its portion inside the view; untouched outside portions keep original timing, pitch and onset V. A parent split is created only when an actual edit needs it.
- New/moved notes use local coordinates and translate back on reconciliation. Edits extending past the fixed view bounds are rejected; return to the project for those edits.
- Effective global tempo/signature and the last explicit pre-boundary V per instrument carry into the view. Ended V carriers still count; V0 survives. Explicit crossing-note overrides remain explicit. Clearing V restores inheritance. See [velocity rules](MUSIC_MODEL.md#velocity-and-inheritance).
- Overlap warnings use the clipped local starts, even when formerly distinct same-pitch onsets become simultaneous. Warnings never repair music.
- Boundaries stay fixed while the view is open even if their marker changes/deletes. Reopen from the project to derive new bounds.
- Instrument name/color/preset changes are shared. Deleting a lane inside a view clears local events while preserving the shared instrument/outside music; merges/splits act only on visible music.

Undo/redo stores full-project snapshots, works within views and continues after returning. View switching itself is not a musical edit. Reprojection after edits recomputes inherited context rather than treating automatic context as an override.

**Save Project writes the entire reconciled parent and keeps the view open.** New/Open/Import reset the view only when replacement succeeds; cancellation leaves it intact. Native close includes scoped edits in its Save/Discard/Cancel decision.

MML, counts, sheet limits and playback are recalculated from the local projection, not sliced from cached parent channel strings. Live playback and audio export receive the explicit view end to preserve trailing silence. File export uses the active projection and a view-name prefix; extra section splitting is disabled while scoped. MIDI has a documented [view-end limitation](IMPORT_EXPORT.md#known-export-limitations).

## Nested instruction loops

Fields are `loopEntry`, `loopExit`, `loopTie` booleans and `loopCount`, a positive safe integer defaulting to **1 total play**. Only Instructions events participate. Count controls show for Entry; Tie controls show for Exit.

Each Exit closes the most recent unmatched Entry across the global Instructions timeline. Nested loops are supported. At a shared tick, Exits precede Entries; a marker with both flags closes a preceding loop and opens the next. Unmatched partners warn and are ignored; complete children of an unmatched outer Entry still repeat. Editing/save/playback/export are not blocked.

Complete regions paint their Entry instrument's color at 10% opacity between grid and other roll overlays; nested shading accumulates. Expansion creates a temporary performance project, clips spans, restores entry tempo/volume context on each pass and shifts following material. Integer durations and leading/trailing rests are preserved.

At ordinary forward boundaries, fragments of the same note remain continuous. At Exit-to-Entry jumps:

- Without Tie, continued notes retrigger.
- With Tie, one matching instrument/pitch voice joins when the Entry-side original starts before Entry **or** the Exit-side original ends after Exit.
- Exact Entry-start / Exit-end pairs retrigger; nested loops use their own Exit's Tie setting.

MML generation, counts, sheet planning and preview share loop expansion. Section-separated export expands before slicing; a scoped view expands only local partners and warns for missing partners outside the view. Playback seconds refer to performance time; the playhead maps back to source ticks during repeats. Ruler seeking chooses the first performance occurrence of that source position.

## Maintenance boundaries

`src/music/structure.ts` owns visual measure math and export slices; `src/model/segment-view.ts` owns editable projections/reconciliation. They serve different purposes: exported cuts materialize resolved source velocities, while editable views track boundary inheritance and untouched baselines. Do not substitute one for the other.

`src/segment-session.ts` is the UI/state adapter for full-project save/history and scope validation. `src/segment-view.ts` owns menu visibility, opening/return and the end overlay. `src/toolbar.ts` still owns Go to options/seek and caption signature edits, despite the controls moving into the header. `src/rendering/instructions.ts` owns bands/captions/shading; `src/rendering/tempo.ts` is its compatibility re-export.
