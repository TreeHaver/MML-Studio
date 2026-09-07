# Song and Segment views

Place the playhead inside a named section, then use **Open Song** or **Open Segment**. A marker with Reset measure count enabled starts a Song; a named marker without it starts a Segment. Projects containing both types show both buttons. Projects with only one type show its matching button. Positions before the first matching marker or after the final event have no view to open.

- Song ends at the next Song, ignoring Segment markers in between.
- Segment ends at the next named marker, whether Song or Segment.
- Without a following boundary, the end is the latest note end or silent instruction end in the project. Empty time up to an existing next boundary remains part of the view.

Opening a view stops playback and sets its local playhead/timeline to zero. Notes are cloned and clipped at both ends of the interval. Effective tempo, time signature and initial per-instrument volume are inherited from the parent; subsequent instructions come only from inside the interval. Measure numbering starts at 1. This is a temporary version-2 project projection, not a saved format change.

Velocity rule confirmed 2026-09-08: copy the last explicit V before the view boundary for each Instrument, even if the note carrying it has ended. Use V8 if none exists, and preserve V0 silence. A crossing note with explicit V keeps that override; a crossing note without V uses the copied value. Later unset notes inherit the parent's current setting, not an older held note's V introduced at local zero by clipping. Explicit changes at/inside the boundary apply normally; simultaneous explicit changes use the newest note for inheritance. Automatic copied values belong to the view baseline and are not saved into the parent by unrelated edits. Clearing an explicit V restores inheritance.

The normal MML compiler and sheet planner run again on that local projection. They allocate channels anew and calculate local character totals, warnings, and red limit boundaries. They do not trim previously generated album channel strings. Playback uses the local clock and ends at the view boundary. Speed and master-volume controls retain their session settings.

## Editing and returning

Overlap warnings intentionally use local clipped onsets. Two held same-pitch notes in one Instrument that become simultaneous at local time zero must warn, even if their original starts differed. The user confirmed this on 2026-09-08 as a user-controlled overlap: keep it non-blocking, preserve all notes and never automatically repair the overlap. This applies to warnings on expanded untied loop restarts as well. See BEHAVIOR_AUDIT.md A2.

The view name appears beneath the Project name field. In Segment View only, **Return to Project** floats just below the measure ruler at the right edge, aligned beneath Time signature. It stays fixed while scrolling. Song View offers Return to Project in the File menu; the root project shows neither return control. The actual Project name remains the album's name. A Song containing Segments retains section navigation; a Song without them and a Segment view hide it. A Song can open its current Segment. Return always returns to the full project and translates the playhead back to absolute time.

Simply opening, exporting, saving or closing a view does not split or shorten source notes. The projection keeps an unedited baseline so automatic clipping and inherited instructions can be distinguished from explicit edits. Editing/deleting a boundary-crossing note changes only its portion inside the view; outside portions keep their original pitch, timing and onset volume. Actual splits are created in the parent only when that note is edited. New/moved notes use local coordinates and are translated back on commit. Edits extending beyond the fixed view boundary are rejected; use Return to Project for those edits.

Undo/redo stores full-project snapshots, works inside a view, and continues to work after returning. View switching itself is not a musical edit. Reprojecting after edits recomputes inherited context, including after deleting an opening instruction or note. Boundaries remain fixed for the lifetime of an open view even if its marker is edited/deleted; reopen from the full project to derive new bounds.

Instrument name, color and preset settings are shared with the parent. Removing an instrument while in a view clears its local notes/events and preserves the shared instrument and outside music. Merge/split operations move only notes shown in the view; source lanes remain available for outside music. These operations retain the usual undo behavior.

## Save and export

**Save Project saves the entire parent project**, including changes made in the view, while keeping the view open. View metadata and automatically inherited/clipped data are not serialized. New, Open and Import leave the view when replacement succeeds; cancellation leaves it intact.

In a view, selected/all-instrument MS2MML export treats the local projection as the entire song. The separate-sections export option is temporarily disabled/ignored, including in a Song containing Segments. Only local notes/instructions plus the required inherited starting context reach the compiler. Files are prefixed with the view's name. Existing character-limit single-file/parts choices still apply to the local counts. Returning restores normal whole-project export behavior.

## Implementation and validation

- `src/model/segment-view.ts`: DOM-free boundaries, context projection, explicit-edit reconciliation and ID mapping.
- `src/segment-session.ts`: full-project save/history access and committed-view synchronization.
- `src/segment-view.ts`: view buttons, label, return workflow and visual end boundary.
- Existing editor state, history, pointer/clipboard commands, instrument actions, playback, toolbar, viewport, renderer and export modules use those helpers. MML generation and sheet planning continue to read the active local project.

`node tests/run.cjs` runs the incremental build and all 72 automated tests. Added pure and simulated-renderer coverage checks boundary types, untouched round trips, inherited context, left/right clipping, partial edits/deletion, note-ID collisions, history across views, nested navigation, playback bounds, save/export scope and local limits. `tests/electron-segment-view.cjs` checks native handlers, actual JSON/MS2MML IPC writes (OS picker stubbed), exact local red-limit pixels and a 900px header. The native fixture reduces an album with more than ten channels to a two-channel, 27-character Segment export. No in-game MS2 or physical-speaker listening test is claimed.

Closing with unsaved view edits offers Save / Discard / Cancel. Save writes the reconciled full project, retaining notes outside the view, and closes only after a successful save with no subsequent changes. A cancelled or failed save leaves the editor open.
