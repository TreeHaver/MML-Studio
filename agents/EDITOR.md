# Using the editor

Use File to create/open/save a project or import MIDI/MML. Import replaces the current project only after parsing succeeds and any unsaved-replacement confirmation is accepted. Imported music is unsaved until you save project JSON. The source import file is not changed.

The Project field names the whole project, including while a Song/Segment is open. New/unnamed projects display Untitled; imports use their filename without extension. Renaming is undoable. Save suggests a filesystem-safe name without changing the actual project name.

## Notes and shortcuts

Choose an active instrument in the left panel. These controls leave text-field editing and text-field clipboard behavior alone.

| Action | Control and behavior |
| --- | --- |
| Draw | **D**. Click empty space for a grid-length note; drag right or left to extend a newly drawn note. |
| Spray | **A**. Drag through cells/pitches to create a run of grid-length notes. |
| Select | **S**. Drag empty space for a selection box; **Shift-drag** box-selects in any tool. |
| Select and move | In Select mode, click-drag a note to select and move it in one gesture. In Draw/Spray mode, its body must already be selected before dragging moves it. Movement starts after four pixels. |
| Add/remove selection | **Ctrl/Cmd-click** toggles a note; Ctrl/Cmd-drag adds a box selection. **Ctrl/Cmd+A** selects the active instrument's notes/events. |
| Move a group | Drag a selected note. The first selected note anchors grid snapping; relative timing, pitches and durations are preserved. |
| Resize | Drag a note's right edge. This also selects an unselected note and snaps its length to the current grid. |
| Delete | **Delete/Backspace**, or right-button click/drag to erase notes along the pointer path. |
| Cancel gesture | **Escape**, pointer cancellation or lost capture restores the gesture's previous data. Escape also clears selection. |
| Undo/redo | **Ctrl/Cmd+Z**, **Ctrl/Cmd+Shift+Z**, or the history buttons. Holding a history button repeats; history retains up to 100 snapshots. |
| Clear all | Trash button in the editing toolbar, with confirmation and Undo. In a scoped view, reconciliation preserves music outside that view. |

Box selection scrolls near either horizontal or vertical roll edge. Moving selected notes scrolls horizontally near the left/right edges, including while the pointer is held still. Group movement is recomputed from the original gesture data and scroll offset; release/cancel stops scrolling. A completed gesture is one undoable edit.

The inspector edits numeric pitch, exact length in 1/128-whole-note units, optional V0–V15, and optional positive integer BPM. Empty Volume/Tempo inherits. See [music rules](MUSIC_MODEL.md) for independent explicit chord volumes and the global tempo clock. Same-pitch overlaps remain valid; warnings do not block editing or save.

## Copy and paste

**Ctrl/Cmd+C** copies selected notes/events in the active instrument. **Ctrl/Cmd+V** pastes the group into a compatible active instrument:

- With selected notes in that instrument, the copy starts at the **greatest selected end timestamp**. Each paste becomes selected, so repeated pastes append consecutively.
- With no selected notes there, paste starts at the copied group's **original earliest timestamp**. Copy/delete/paste restores placement; switching to another instrument can layer the copy at the original times.
- Relative timing, pitch, duration and attached instructions are retained; inherited V is materialized to preserve the copied sound. Instructions copies go into Instructions; musical copies go into musical instruments.

The internal group is held by this app window; the system clipboard carries a custom marker. It is not a cross-window/project-file interchange format. No note clipboard data is serialized in JSON.

External MML text is parsed before editing. Its musical channels are inserted into the active musical instrument; unbound tempos use Instructions. A click on empty space in Select mode sets the **MML text** insertion position. Successful text paste advances that position by the parsed span. It does not determine internal note-group paste placement. Invalid syntax, conflicting instructions or edits outside a scoped view leave the project unchanged.

## Instruments

Add instrument creates a new named instance. Click its name to select it; click the selected name again to collapse/expand its controls. Rename uses the dedicated pencil button; Enter/blur commits and Escape cancels. The swatch opens the themed color picker with palette, saturation/value area, hue, hex and RGB controls.

The preset selector offers GM voices 1–128, Standard Drum Kit and fixed MS2 drums. Vanilla voices use MS2 display names with their original 1–128 GM program numbering; saved MIDI programs and custom instrument names are unchanged. **Show only MapleStory 2 Instruments**, beside Instruments and its musical-instrument count, filters the preset choices to Vanilla voices and the three fixed MS2 drums. It defaults off and remains a session preference across project changes, outside project JSON and Undo. The enabled toggle is tinted blue in Sky and orange in Night.

Enabling the filter never changes existing presets, notes, selection or playback. An excluded current preset remains visible in yellow in the closed field but is absent from the open list. Standard Drum Kit is always yellow and can only be newly selected with the filter off. Instructions is a separate lane and never receives the Vanilla warning tint. Turning the filter off restores all musical choices. Keyboard navigation/type-ahead follows the filtered list. The 40-preset catalog lives in `src/playback/vanilla-instruments.ts`. Electric Guitar uses Overdriven Guitar; Bass uses Electric Bass (finger); Pick Bass Guitar uses Electric Bass (pick); Organ uses Church Organ; Saxophone uses Alto Sax; Tom-Tom uses Melodic Tom.

**Enable Advanced Instructions** shows the permanent Instructions card at the bottom of the list, after every musical instrument. It is hidden in a new project and automatically shown when opening/importing a project containing instruction events (including note-bound tempo and unbound MML/MIDI tempo shifts), or when the first instruction is added. Turning it off hides the card without removing or disabling any events; reopening a project with instructions shows it again. Selecting an instruction band/caption also reveals its card. Instructions does not count toward the instrument total, cannot be renamed/deleted or changed into a sound preset, and has no Mute, Solo or Instrument Actions. It is always active and editable during musical Solo. Select the card and draw markers to edit tempo, signatures, sections or loops. Delete individual markers normally.

Details belong to the selected instrument; MML controls sit inside its initially closed Instrument actions section. Warnings remain visible as an amber marker with a tooltip.

Mute silences the owning musical instrument's preview routes. Solo silences the other musical instruments while preserving their explicit mutes; selecting Solo unmutes its owner. Instructions remains active. These settings and collapse state are session-only. Pointer editing and paste require the active musical instrument to be unmuted and not excluded by Solo; this is not a global read-only lock on every editing command.

Instrument actions provide:

| Action | Effect |
| --- | --- |
| Delete | Confirms removal of owned notes/events and tempo instructions; the last musical lane becomes an empty Piano while the dedicated Instructions events remain. |
| Merge into | Moves source notes/events into another musical instrument, keeps destination settings and removes the source in the full project. Instructions is never a source or destination. |
| Split Notes | Moves an exact named pitch into another existing musical instrument. |
| Split Drumkit | On Standard Drum Kit, creates populated Bass Drum, Snare Drum and Cymbals lanes; unclassified percussion stays in the source. |

Merge/split preserve original note velocities and timing. Actions use Undo; instrument-count changes remap/reset session lane state so mutes or collapsed cards cannot attach to the wrong instrument. In a Song/Segment, operations affect only local music and preserve shared lanes/outside notes; see [scoped editing](STRUCTURE_VIEWS.md#editing-without-damaging-the-parent).

## View and workspace

Grid L4–L128 is a snapping aid. Exact imported/stored durations are independent of that dropdown. Horizontal zoom ranges from 1–8 and vertical zoom from 0.5–3; Reset returns to 3/1. Ctrl+wheel changes vertical zoom around the pointer. Sliders retain the visible top-left musical position; zoom is ignored during an active gesture.

Sharp pitch rows are 75% of natural-row height. The optional piano-style key column changes rendering; the same pitch mapping drives note placement, hit testing, movement and previews. The keys start below the 24px measure ruler. Vertical scrolling keeps measures/captions fixed; horizontal scrolling keeps piano keys fixed. Click/glide over keys to hear a short preview without adding notes.

Sky/Night themes, side-panel widths/visibility and piano-key style are saved locally. Panels can be resized, hidden with toolbar buttons, or closed by dragging inward; these preferences do not change project JSON. Custom select lists use available viewport space and close with outside clicks/Escape. Section navigation is in the **Section menu beside Tools**, not the editing toolbar.

The caption contains the character limit, H/V zoom, playback position/BPM and Time signature. Yellow regions/markers mean more than ten simultaneous voices in the active musical instrument; the red line marks its first planned sheet boundary. These overlays update independently of a paused manual MML snapshot.

## Explicit cleanup tools

Both Tools commands operate on the **whole active musical instrument in the current view**, regardless of selected notes, and undo in one step. Neither runs automatically during import or export.

- **Simplify Timing**: choose L4/L8/L16/L32/L64. Each edge extends to include its grid window only when the note covers **more than 40%** of that window; smaller coverage is trimmed. New overlaps are prevented; existing polyphony remains. Notes that cannot fit retain their original timing and are reported. Short note rolls (at least three consecutive changing-pitch notes, each L32 or shorter and shorter than the chosen window) may rise, fall or turn: where three or more starts share a window, retain its first note and fill that window. Two sequential notes competing in one window instead compare their coverage within that window: a 40/60 through 60/40 split (inclusive) becomes equal halves; otherwise the larger share takes the whole window. Portions held outside that window remain, and a losing note is removed only if no duration remains. This exception also applies to two-note windows in a roll. Existing chords/sustained overlaps are excluded from competition. A hammer-on is an L32-or-shorter lead-in into a different-pitch note **more than six times longer**; remove the lead-in and round the longer note normally. Consecutive ornament notes may touch or have a one-unit gap. Simultaneous onsets are excluded from detection. Condensation protects attached instructions, unrelated notes and the current view end; surviving inherited velocities, including V0, are retained when carriers are removed. Conflicting instruction conversions are rejected and Undo restores all removed notes.
- **Remove overlap**: shorten a held note at the next distinct onset of the exact same pitch. Same-start, same-pitch notes on the active instrument instance leave one survivor: equal lengths keep the highest effective V; otherwise length wins unless the shorter note is at least three V steps louder. For larger groups, keep the longest note within two steps of the loudest, then highest V, then lowest ID for exact ties. Compare original lengths before shortening. Chords and other instrument instances remain independent. Preserve surviving inherited volumes when deleting carriers; Undo restores deleted notes. This tool's sustained-overlap behavior is intentionally broader than the identical-onset warning definition.

## Playback, structure and export

Play toggles Pause/Resume. The transport also offers Return to start, Stop and five-second rewind/forward. Clicking/dragging the ruler seeks; Section > Go to sets the start/seek position. Playback settings open from the editing-toolbar icon: speed 25–400%, master volume 0–100%. Stop/Play picks up musical edits; preset changes can refresh in place. See [PLAYBACK_AUDIO.md](PLAYBACK_AUDIO.md).

Instructions markers supply global tempo, signatures, named sections and nested loops. Section > Open Song/Open Segment opens a temporary editable local timeline. **Save still writes the entire project**; playback and export use the active view. Segment return floats under the ruler; Song return is in File. See [STRUCTURE_VIEWS.md](STRUCTURE_VIEWS.md).

Export opens one dialog with MS2MML sheet, MML text, MIDI file and Audio, plus selected/all-instrument scope. Raw channel copying remains in Open MML, not Export. See [IMPORT_EXPORT.md](IMPORT_EXPORT.md) for counts, sheet choices and format-specific limits.
