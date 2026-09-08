# Checkpoint — 0.3.0 General MIDI playback and note-attached tempo

## Keyboard runs to the top edge, and every Electron check passes — 2026-09-07

The ruler painted a solid 62x30 block above the key column, so the keyboard began below a header of its own. That block is gone and the keys are drawn from the top of the canvas, clipped, so the column reads as continuing past the edge. The row arithmetic was measured first and ruled out: across 430 scroll positions the first drawn row never leaves a gap, so the strip was the painted corner, not a layout seam.

The remaining stale Electron assertions were then worked through. `electron-smoke` was failing on a piano-key glide expecting E4 and hearing F4: it dragged a fixed 80px, which meant four semitones only while every row was 20px tall. Uneven rows made 80px reach F4. The target is now derived from the layout, so it survives another change of row heights.

Fixing that one uncovered the rest, each hidden behind the previous failure:

- Four files still drove `#pause`, removed when play and pause became one icon button. They check `is-playing` and the button's title now.
- `electron-instrument-actions` simulated Ctrl+C/Ctrl+V with synthetic keydowns, which the native clipboard handlers never see. It uses the real clipboard through `webContents.copy()`/`paste()`.
- The same file clicked "the first button in Instrument actions" for Merge, which Split now precedes. It finds the button by name.
- `electron-timeline` read "the second select under #instruments" for an instrument preset, an index shifted by the Split and Merge selects. It starts from the card instead.
- `electron-midi-import` expected "MIDI import failed"; the importer takes MML too, so the message no longer names MIDI. Its dialog title changed for the same reason.
- `electron-midi-import` and `electron-dialog-focus` forced `state.dirty=true` to stand for unsaved work. Prompts compare against the last saved contents now, so the flag alone no longer means there is anything to discard; both clear the saved snapshot as well.
- `electron-mml` read a warning from the card's text, where warnings are a hover marker now.

Two files gained a `run`/`evaluate` wrapper that reports which expression failed: "Script failed to execute" on its own says nothing, and both spent their failures on it.

The Undo hold check in `electron-ui` was the last flaky spot: a lost mouseDown left nothing to poll for. It now waits for the immediate undo that pointerdown fires and presses again if that never arrives. Three consecutive runs clean.

State: node tests/run.cjs 91 passing, and every Electron file passing except `electron-release`, which looks for a packaged build that `build.bat` has to produce first.

Changed: src/rendering/ruler.ts, src/rendering/keyboard.ts and their two generated dist outputs. Tests: electron-smoke, electron-ui, electron-instruments, electron-instrument-actions, electron-midi-import, electron-mml, electron-timeline, electron-dialog-focus. Actual validation: incremental build, node tests/run.cjs, the full Electron sweep above, an Electron measurement of the warning tooltip against the card width, and a scripted check of the row arithmetic across 430 scroll positions.

## One drum warning, and a UI check that reports every failure — 2026-09-07

The class `instrument-warning` was serving two things at once: a full-width amber line written by the instruments panel, and the new hover marker for MML warnings. Restyling it for the marker squeezed the drum-kit line into a 24px box on top of the card's other icons. The marker now has its own class, `instrument-flag`, and `instrument-warning` is a text line again.

The drum note was then saying the same thing twice: `Standard Drum Kit is not a valid MS2 instrument.` from MML generation, and `Not a valid MS2 instrument. Available for editing and preview.` as its own line in the card. Both now come from `DRUM_MS2_WARNING`, already shared with MIDI import, and reach the card only through the marker. The separate line is gone.

The warning tooltip was clipped by the scrolling instruments panel: it was anchored to the icon, which sits 64px inside the card, so a 214px bubble hung past the card's left edge. It is anchored to the card edge and capped, measured at 202px inside a 212px card.

tests/electron-ui.cjs was rewritten. It ran 46 assertions in one linear script inside a single try/catch, so the first failure hid the rest — three consecutive runs failed at three different points, which read as three bugs rather than one flaky script plus one stale assertion. Each area is now a named check that runs and reports independently, and the result file lists what passed and what failed. Fourteen "wait a frame or two" pauses became `until(condition)` polls with a deadline, a divider drag waits for the handler's `resizing` class before moving, and holding Undo polls for the repeat instead of sleeping 900ms hoping it fired; the only remaining wall-clock wait proves that nothing more happens after release, which genuinely needs one. The stale assertion expecting a non-selected instrument's MML box to be hidden was replaced with what the box now guarantees: one per instrument, inside its Instrument actions body, closed by default. A new check covers a select list staying open while the roll scrolls. Three consecutive runs now pass 19 of 19.

The simulated DOM in tests/renderer.test.cjs had `setAttribute(){}` as an empty function, so nothing set through an attribute could be asserted. It records attributes now and offers `getAttribute`.

Known failure, unrelated and pre-existing: tests/electron-smoke.cjs expects a piano-key preview of E4 and gets F4, one key out. Verified by stashing this work and rerunning at the previous commit, where it fails identically. The uneven pitch rows are the obvious suspect. Not investigated further here.

Changed: src/mml.ts, src/music/mml.ts, src/instruments.ts, studio.css, themes.css and three generated dist outputs. Tests: tests/electron-ui.cjs rewritten, tests/renderer.test.cjs and tests/electron-smoke.cjs follow the marker instead of the removed line. Actual validation: incremental build, node tests/run.cjs 91 passing, tests/electron-ui.cjs passing 19 checks on three consecutive runs, and an Electron measurement of the tooltip against the card width.

## Playback settings, card cleanup and unsaved-state accuracy — 2026-09-07

Speed and volume left the caption strip for a panel behind an icon button at the right of the editor toolbar, next to the history actions. They are set once and then ignored, so they no longer hold a permanent row; Zoom stayed in the toolbar because it is used continuously. The sliders are 35% larger there, keeping the native control rather than reimplementing it. Merging the caption strip into the toolbar was measured and rejected: in the default window the editor column is 794px while the toolbar already needs 847px and the caption 448px, so a merged row would wrap into two lines again.

The effective-BPM readout was a superscript, rendering smaller and off the baseline like a stray footnote. It is now part of the line at full size and rounded to whole numbers: `115.0 s · 136 BPM · 185 effective`, still amber with `(out of bounds!)` when the speed pushes the tempo outside T32–T255.

The MML block — character count, real-time toggle, Update and Open — moved inside the existing Instrument actions section, closed by default, since converting is the last step of a session rather than something every card must advertise. Its warnings did not follow it: they stay in the card as a bare amber triangle in the icon row with its own hover tooltip, because the native `title` only appears after about a second and reads as nothing happening. The triangle is a marker, not a control, so it is a span with no click behaviour. The Instructions lane's description text was amber like an alert despite describing the lane rather than reporting a problem, and is now neutral. Empty warning elements no longer reserve a line.

New project reset an already-empty project silently, which looked like a dead button. It now reports in the status bar and focuses and selects the project name, offering a name without a modal that would interrupt a quick sketch.

Unsaved-change prompts compare the project against its last saved contents instead of trusting a one-way flag. Adding and removing an instrument leaves the project as it was, but `dirty` only ever cleared on save, so New asked to discard work that no longer existed. The comparison runs only when a prompt is about to appear, with the flag kept as a cheap gate. Imports still count as unsaved, since their contents exist in no project file. Verified in Electron: fresh project quiet, adding an instrument prompts, undoing back to one instrument quiet again, adding again prompts.

Fixed: a select list could not be opened during playback. The lists are fixed-position panels on `body`, so any scroll closed them, and the roll scrolls constantly while following the playhead. A scroll now closes a list only when the scrolled element actually contains that select. Verified in Electron: the Grid list survives the roll scrolling and a preset list still closes when the instruments panel scrolls.

Also: the MML pop-out window had no icon at all, since only the main window passed one to Electron; the panels met the roll on a hard vertical edge and now have 16px inner radii; File, Tools, Export and the theme menu all carry icons, the theme showing a sun on Sky and a moon on Night; the icon-only playback button lost its chevron; the panel toggles were pulled in on both sides; and the time signature field, which inherited the caption's 9px letterspaced label style, now looks like the editable field it is.

Changed: index.html, mml.html, main.cjs, studio.css, themes.css, src/appearance.ts, src/chrome.ts, src/files.ts, src/instruments.ts, src/instrument-actions.ts, src/mml.ts, src/playback/transport.ts, src/state.ts and eight generated dist outputs. Tests: tests/renderer.test.cjs follows the MML block into Instrument actions and the new effective-BPM wording; tests/electron-behavior.cjs points at the playback panel and the same wording. Actual validation: incremental build and node tests/run.cjs, 91 tests passing, plus targeted Electron probes for the unsaved comparison, select lists under scrolling, and header centring. tests/electron-ui.cjs was run three times and failed at three different points — divider drag, undo auto-repeat and the instrument MML box — so it is timing-flaky on top of one assertion left stale by the instrument-panel rework; it was not used as a gate.

## Real MapleStory 2 sheet import — 2026-09-07

Sheets exported by MapleStory 2 could not be imported at all. The MS2MML element pattern accepted only index="N", while real files label channels chord="N"; nothing matched, the leftover body was non-empty, and every sheet failed with "Invalid or unsupported MS2MML XML elements." Any attribute list is now accepted. Verified against a ten-channel piano sheet that plays in game: 3345 notes.

Three further tokens in the same file stopped an atomic import and are now skipped, each with its own warning: a repeated tie marker with a command between it and the tied note, which is redundant rather than broken; s0/s1 switches this model has no equivalent for; and an L with no length, which leaves the previous default in place. Converter measure labels (M29, M30 and so on) are skipped as well. That last decision was measured rather than assumed: parsing the channel while ignoring them puts every label on an exact measure boundary — ticks 3712, 3840, 10368, 10496 and 10624 against a 128-unit 4/4 measure — with the label matching the elapsed measure count in all five cases, so they are positional annotations that cannot carry sound. Unknown letters still fail atomically, and a tie must still continue the same adjacent pitch.

A failed import previously reported only in the footer status line, which reads as the button doing nothing. Failures now open the existing report dialog titled "Import failed" with the reason, hiding the paragraph that only applies to a successful import. The open-file dialog also offers Text files and All files, since MML sheets are not always named with one of the five known extensions.

Known unrelated limitation confirmed while checking for regressions: sheets using volumes above 15 (rushe_full_3mle_loud.ms2mml, rushe_full_3mle_v2.mml) still fail validation. Clamping them would silently change loudness, so no change was made.

Changed: src/import/mml.ts, src/files.ts, main.cjs, index.html and the two generated dist outputs. Tests: tests/mml-import.test.mjs gains coverage for chord attributes, repeated ties, pedal switches, measure labels and a bare L, and asserts that the annotated and plain forms of the same phrase produce identical notes. Actual validation: incremental build and node tests/run.cjs, 91 tests passing, plus the ten-channel sheet and six other local MML/MS2MML files imported through the built module.

## Workspace controls and header layout — 2026-09-07

Panel visibility is back to one control per panel, at the toolbar end nearest it, so the same button closes and opens instead of closing from inside the panel and reopening from a tab on the roll edge. Both intermediate arrangements were removed, including the divider column that widened to 18px to host a reveal tab; dividers are 6px again. A button drops to half opacity while its panel is hidden.

The header is a three-column grid (1fr auto 1fr) with the left and right groups wrapped, so the transport is centred on the window rather than on whatever space the side groups leave over. Measured in Electron: transport centre 652 against a window centre of 652.

Tools moved out of the editor toolbar into the header beside the theme and Export menus, adopting their height and padding. Its panel is now two blocks with their own headings, one-line descriptions and full-width Apply buttons; the length selector is labelled "Round to" rather than "Grid", which collided with the toolbar's own Grid control. The Export panel is split the same way: an Options section carrying the character limit with a line saying what it does and the section checkbox, then an Export as MS2MML section with two centred buttons.

Icons: Draw, Select and Spray carry pencil, marquee and spray-can glyphs at 38px height; Tools carries a wrench; Export a download arrow; and the theme menu shows a sun on Sky and a moon on Night, with the same pair marking the two options in its list. Add instrument left the panel heading to become a full-width dashed button above the list, where the old plus button sat, and is exempt from flex shrinking so it keeps its height once the list overflows.

Fixed while moving these: a click inside one of our select lists closed the menu containing it, because the lists are appended to body and the menu-dismissal handler read that as a click outside. Choosing a length in the Tools menu closed the whole menu.

Changed: index.html, studio.css, src/appearance.ts, src/chrome.ts and two generated dist outputs. Tests: tests/electron-ui.cjs covers the toolbar toggles and asserts that a select list can be used without closing its menu. Actual validation: incremental build, node tests/run.cjs, and targeted Electron measurements of header centring. tests/electron-ui.cjs runs to its instrument-panel section; one assertion there, expecting a non-selected instrument's MML box to be hidden, has been stale since the instrument-panel rework and was left alone. Two other stale assertions in the same file were corrected: the undo button is outlined rather than filled, and #theme no longer exists since the theme became a menu.

## Right-button erase and backwards note drawing — 2026-09-07

Holding the right button erases every note the pointer crosses, where before only a single click deleted the note under it. The path is sampled every 4px so a fast drag cannot skip a note between two move events, overlapping notes at one point are all removed, and the whole drag is one undo step rather than one per note. Erasing stays confined to the selected instrument.

Drawing a note now grows in both directions. Dragging left of the cell the drag started in moves the note's start with the pointer and anchors its end to that cell. Dragging right is unchanged and still uses the existing resize path, as does edge-resizing an existing note, where dragging back must shorten rather than move the start.

Changed: src/pointer.ts, src/music/note-operations.ts and their two generated dist outputs. Tests: tests/renderer.test.cjs asserts that a right click removes one note, that a right drag removes all three it crosses in a single history step, and that drawing backwards moves the start one cell while the length becomes two cells. Actual validation: incremental build and node tests/run.cjs.

## One toolbar row fewer, quieter crowding markers, panels that close by dragging — 2026-09-07

The playback bar added earlier spent a full row on two sliders. Speed and volume, along with the time and BPM readout, moved into the caption strip, leaving toolbar and caption above the roll instead of toolbar, playback bar and caption. The strip wraps instead of clipping when the window narrows.

Crowded regions, marking more than ten simultaneous notes on the selected instrument, filled the roll's whole height in yellow behind a 2px border and made the notes inside hard to read. The signal moved to a solid 3px bar at the foot of the ruler, where it is visible at a glance without covering anything; the tint inside the roll dropped from 15% to 8% opacity with 1px edges in place of the border. Detection itself is unchanged.

Dragging a divider now closes its panel. Past 120px the panel hides and keeps its preferred width; dragging back out past that threshold reopens it at the width the pointer gives it; between 120 and 180px it snaps to the 180px minimum. Before this a drag bottomed out at 180px and could never close, and grabbing the divider of a hidden panel expanded it to its stored width on mousedown.

The project name was a stacked label over a bordered field. It reads as a document title now: inline caption, 14px semibold, transparent until hovered or focused, elided rather than pushing the header wider. It had also inherited a top margin from the generic text-field rule, which left it out of line with the File menu.

Changed: index.html, studio.css, src/appearance.ts, src/painting.ts, src/rendering/note-density.ts and three generated dist outputs. Tests: tests/electron-ui.cjs covers closing and reopening a panel by dragging; tests/electron-behavior.cjs points at the caption strip instead of the removed playback bar; tests/renderer.test.cjs follows the new crowding colour. Actual validation: incremental build, node tests/run.cjs, and a targeted Electron drag reporting 264px to hidden and back to 220px.

## Neutral closed theme selector — 2026-09-07

The theme selector now uses the neutral surface while closed and switches to the selected/accent treatment only while its dropdown is open. Changed themes.css and this log. Technical validation confirms both state rules, a successful build and all 45 functional tests. Per user direction, no visual judgment was performed. Local only, no push.

## Automatic note-label contrast — 2026-09-07

Note labels now compare WCAG-style relative luminance contrast between the existing dark text and a light alternative, selecting the more readable color for each instrument swatch. Dark blues and blacks receive light labels; bright colors retain dark labels. Instructions use the same calculation against their fixed yellow. Changed src/rendering/notes.ts, dist/rendering/notes.js, tests/renderer.test.cjs and this log. Technical validation: successful build and all 45 tests, including dark-blue/light-label and orange/dark-label assertions. Per user direction, no visual judgment was performed. Local only, no push.

## Stable panel columns when hidden — 2026-09-07

Assigned Instruments, both resize hit areas, the editor and Note properties to explicit grid columns. Hiding one panel no longer causes the remaining grid children to shift into earlier columns and collapse the useful editor area. Changed themes.css, tests/electron-ui.cjs and this log. Technical validation: successful build, all 45 functional tests, and DOM geometry confirms the editor remains over 400 px wide while Note properties remains over 180 px after hiding Instruments. Per user direction, no visual judgment was performed. Local only, no push.

## Single-gesture select and move — 2026-09-07

Dragging an unselected note in Select mode now selects and moves it in the same gesture. Dragging an already-selected note continues to move the current group; dragging from empty space retains multi-note box selection, and Ctrl-click retains additive toggling. Changed src/pointer.ts, dist/pointer.js, tests/renderer.test.cjs and this log. Technical validation: successful build and all 45 tests, including immediate unselected-note movement. Per user direction, no visual judgment was performed. Local only, no push.

## Select menu edge spacing — 2026-09-07

Added four pixels of separation before the first select option and after the last, with six-pixel option padding and additional edge padding so the first row does not visually merge with the trigger border. Changed themes.css and this log. Technical validation confirms the rule, successful build and all 45 functional tests. Per user direction, no visual judgment was performed. Local only, no push.

## Visible history buttons and panel icons — 2026-09-07

Undo, Redo and Trash now use 36 px bordered control backgrounds with 19 px neutral Lucide icons. Removed the accent-colored bottom focus stripe from every control. Replaced the ambiguous mirrored text glyphs with Lucide PanelLeft and PanelRight: the first toggles Instruments and the second toggles Note properties. Changed index.html, themes.css, tests/electron-ui.cjs and this log. Technical validation confirms all required Lucide classes, absence of the focus stripe, successful build and all 45 functional tests. Per user direction, no visual judgment was performed. Local only, no push.

## Lucide history actions — 2026-09-07

Replaced the custom Undo, Redo and Trash drawings with the official Lucide Undo2, Redo2 and Trash2 SVG geometry and standard `currentColor` stroke attributes. Removed the forced red color from Trash so all three controls inherit the same neutral theme color. Changed index.html, themes.css, tests/electron-ui.cjs and this log. Technical validation confirms all three Lucide classes, neutral Trash styling, a successful build and all 45 functional tests. Per user direction, no visual judgment was performed. Local only, no push.

## Clear-all action and fixed-center chevrons — 2026-09-07

Added a disabled-when-empty trash button beside Undo/Redo. It shows the English confirmation “Delete all N notes and instructions from this project? You can undo this action.”, stops playback, clears every note/event as one undoable history step, and retains instruments/settings. Rebuilt dropdown indicators as symmetric chevrons inside fixed boxes so their centers do not move when rotating between closed/down and open/up states. Changed index.html, src/toolbar.ts, src/playback/transport.ts, themes.css, matching dist modules, tests/electron-ui.cjs and this log. Build and all 45 functional tests pass. Native Electron verifies confirmation text, empty-state disabling, Undo restoration, and identical arrow center coordinates before/after opening. Local only, no push.

## Refined transport icon geometry — 2026-09-07

Replaced font glyphs with consistent inline SVG transport icons. Pause now uses two rounded bars with a wider gap; Stop uses a larger rounded square; Play uses a curved triangle without sharp corners. Changed index.html, themes.css, tests/electron-ui.cjs and this log. All 45 functional tests pass, native Electron verifies six SVG controls, and the refreshed Night screenshot was inspected. Local only, no push.

## Unified animated select chevrons — 2026-09-07

Replaced generic/native dropdown arrows with a single visible CSS chevron for File, Export, Instrument actions and every main-window select. Each has a consistent 7 px stroke form, 14 px right inset and rotates upward while its control is open. Select wrappers preserve all existing change handlers and dynamically cover newly rendered instrument controls. Changed index.html, src/appearance.ts, dist/appearance.js, themes.css, tests/electron-ui.cjs and this log. Build and all 45 functional tests pass. Native Electron verifies menu chevrons, select open/close state and preserved controls; the refreshed Night screenshot was inspected. Local only, no push.

## Icon transport and empty-project guard — 2026-09-07

Replaced textual playback controls with compact Start, Rewind, Play, Pause, Stop and Forward icons. Start/Rewind/Forward seek the loaded playhead; Play is disabled when there are no audible musical notes and becomes available immediately after adding one. Changed index.html, src/playback/transport.ts, src/painting.ts, themes.css, matching dist modules, tests/renderer.test.cjs, tests/electron-ui.cjs and this log. Build and all 45 functional tests pass. Native Electron verifies the empty-project disabled state, icon labels and re-enabled Play after fixture notes are added; the refreshed Night screenshot was inspected. Local only, no push.

## Wider piano-roll scrollbar — 2026-09-07

Increased the piano-roll vertical and horizontal scrollbar tracks to 18 px and reduced the thumb border so their usable hit area is substantially larger. Changed themes.css, tests/electron-ui.cjs and this log. Native Electron confirms the view scrollbar is 18 px wide. Local only, no push.

## Consistent menu chevrons — 2026-09-07

File, Export and Instrument actions now use down chevrons while closed and rotate them upward while open. Replaced Export's unrelated diagonal-arrow icon. Changed index.html, themes.css, tests/electron-ui.cjs and this log. Native Electron verifies File and Export open states and their chevron elements. Local only, no push.

## Divider handle removal — 2026-09-07

Removed all visible divider treatment: both the decorative accent handle and the divider columns themselves are transparent. The hit areas remain draggable and keyboard-resizable but no longer show blue or light strips beneath the header controls. Changed themes.css, tests/electron-ui.cjs and this log. Native Electron confirms the pseudo-element has no content and the divider background is transparent. Local only, no push.

## Preview-key label contrast — 2026-09-07

The highlighted piano key now keeps its pitch label in dark, high-contrast text rather than inheriting the white label used by black keys. Changed src/rendering/keyboard.ts and dist/rendering/keyboard.js. Build and all 45 functional tests pass. Local only, no push.

## Root-window background coverage — 2026-09-07

Explicitly sized and colored the document root and body so no system-colored strip can show through at the window edge. The main editor root follows the active theme; the MML pop-out root uses its graphite background. Changed themes.css, style.css, tests/electron-ui.cjs and this log. All 45 functional tests pass. Native Electron verifies the Night document root is #0d0d0d and the full visual/layout test passes. Local only, no push.

## Keyboard glide, visual feedback and smooth retrigger — 2026-09-07

Holding the mouse on the piano keyboard and dragging across keys now previews each crossed pitch; the most recently previewed key lights up for the 500 ms preview duration. Preview retriggering now releases the prior sound rather than force-stopping it, removing the abrupt discontinuity that produced a click on rapid low-note repeats. Changed src/pointer.ts, src/rendering/keyboard.ts, src/state.ts, src/playback/engine.ts, matching dist modules, tests/renderer.test.cjs, tests/preview.test.cjs, tests/electron-smoke.cjs and this log. Build and all 45 functional tests pass. Native Electron verifies C#8 audio plus a C4→E4 keyboard glide in the real canvas/AudioWorklet. Local only, no push.

## High-key keyboard preview — 2026-09-07

The bundled SoundFont becomes nearly silent above C8 (MIDI 108), causing C#8 through G9 keyboard previews to appear broken. Melodic previews now trigger C8 as the source sample and apply a proportional pitch wheel, preserving the requested high pitch. Drum previews are unchanged. Changed src/playback/engine.ts, dist/playback/engine.js, tests/preview.test.cjs, tests/playback.test.mjs, tests/electron-smoke.cjs and this log. Build and all 45 functional tests pass. Native Electron clicks C#8 in the piano keyboard and measured non-silent audio (peak 0.0152). Local only, no push.

## Draw-mode paint gesture — 2026-09-07

Dragging from an empty cell in Draw mode now paints one grid-length note into every cell crossed, including cells skipped by a fast pointer movement; painted notes remain selected as one group. Click still creates one note, moving an existing selected note still moves it, and dragging its right edge still resizes it. Instructions remain one-unit silent markers. Changed src/pointer.ts, dist/pointer.js, tests/renderer.test.cjs, tests/electron-ui.cjs and this log. Build and all 44 functional tests pass. Native Electron drag across four cells verifies notes at all four cell starts. Local only, no push.

## Grid-cell click alignment — 2026-09-07

Drawing a note or setting an empty Select-mode paste location now resolves to the left edge of the rendered grid cell. Previously nearest-grid rounding sent clicks in the right half of a cell to the next cell. Movement and edge-resize retain nearest-grid snapping. Changed src/music/timing.ts, src/pointer.ts, dist/music/timing.js, dist/pointer.js, tests/core.test.ts, tests/renderer.test.cjs, tests/electron-ui.cjs and this log. Build and all 44 functional tests pass. Native Electron sends a real click into the right half of an empty cell and verifies it creates at that cell's left edge. Local only, no push.

## Hold-to-repeat history controls — 2026-09-07

Undo and Redo now apply once immediately on press, then repeat every 85 ms after a 420 ms hold. Releasing, cancelling or losing pointer capture stops the repeat; keyboard activation remains a single action. Changed src/history.ts and generated dist/history.js. Build, functional tests and native Electron history interaction check pass. Local only, no push.

## Theme selector focus refinement — 2026-09-07

Removed the oversized outer accent ring from header controls and inputs. Keyboard focus now uses a slim inset accent line instead of a second blue perimeter, while active controls keep their regular active state. Changed themes.css. Native Electron visual check passes. Local only, no push.

## Minimal M logo — 2026-09-07

Simplified the application mark to a transparent cyan musical M with its two note heads. Removed the cloud, sparkle, background tile and piano-roll bars; regenerated the native PNG window icon from the SVG. The Night palette and all workspace behavior remain unchanged. Validation: build, 43 functional tests and native Electron visual check pass. Local only, no push.

## Neutral Night theme — 2026-09-07

Added Night alongside Sky/Midnight: near-black surfaces, neutral gray controls, grid, keyboard and ruler, with grayscale UI accents. Instrument/note colors, warning semantics and the blue logo remain intact. Selection persists using the existing workspace preference key. Changed index.html, themes.css, src/appearance.ts, dist/appearance.js, tests/electron-ui.cjs and this log. Build and all 43 functional tests pass. Native Electron verifies neutral panel/canvas colors and Night restoration after reload; ui-night.png captured and inspected. Local only, no push.

## Sky/Midnight, movable dividers and sky logo — 2026-09-07

Added Sky (default light azure) and Midnight (deep blue) themes, covering main-window controls and canvas grid/ruler/keyboard/playhead. The new original SVG mark combines a musical M, note heads, a cloud and a sparkle on a clear-blue gradient; generated the native PNG from that vector. Instrument colors and project version-2 data remain unchanged.

Added draggable left/right dividers, header buttons to hide/show either panel, keyboard arrow adjustments and double-click default widths. Widths are constrained to preserve the editor, adapt when the window shrinks and restore preferred sizes when space returns. Theme, widths and panel visibility persist under mml-studio-workspace-v1 in localStorage; unavailable/malformed storage falls back safely. Scrollbars remain only where content overflows. The MML pop-out retains its separate stylesheet.

Changed: index.html, themes.css, src/appearance.ts, src/renderer.ts, src/painting.ts, src/rendering/grid.ts, src/rendering/ruler.ts, src/rendering/keyboard.ts and matching dist modules; assets/logo.svg, assets/logo.png; tests/electron-ui.cjs, PROJECT_MAP.md, PROGRESS.md. Validation: build and all 43 functional tests pass; native Electron test with software rendering verifies mouse drag with button held, hide/show, keyboard resize, default reset, theme selection and preference restoration after reload, menus/inspector, and layout at 900/1320px. Sky/Midnight screenshots were inspected. Initial synthetic drag needed a held-button modifier and capture needed completed frames; corrected test passes. Next: user trials of palette and workspace proportions. No commit/push performed.

## Desktop visual refresh and logo — 2026-09-07

Replaced the crowded main header with a compact MML Studio identity, File menu, central transport and Export menu. Introduced a graphite/mint theme and an original vector M logo with piano-roll bars; derived a 256px PNG for the native Electron window icon. Moved selected-note properties into a right-hand inspector with a contextual empty state and shortcut reference. The left list shows full sound/MML controls only for the selected instrument; remaining instruments keep name/color/Mute/Solo. Merge/Delete are collected in a collapsible Instrument actions section. Main editor styles are isolated in studio.css; the MML pop-out keeps style.css. Reduced grid contrast and added octave separators while preserving hit testing, timing and yellow tempo markers.

Changed: index.html, studio.css, assets/logo.svg, assets/logo.png, main.cjs, src/chrome.ts, src/renderer.ts, src/instruments.ts, src/instrument-actions.ts, src/inspector.ts, src/rendering/grid.ts, src/rendering/ruler.ts and corresponding dist modules; tests/electron-ui.cjs, PROJECT_MAP.md, PROGRESS.md. Validation: incremental build and all 43 existing functional tests pass. Dedicated native Electron check passes logo load, File/Export menus, outside/Escape dismissal, selected-instrument detail switching, empty/selected inspector states, action disclosure, and absence of panel/header/toolbar overflow at 900px and 1320px. Captured and visually inspected .validation/ui-900.png and ui-1320.png; result .validation/electron-ui.json. Test uses an isolated profile and software rendering; screenshot notes are an unsaved test fixture. No physical audio or in-game test performed. Local changes only, no commit/push. Next: user feedback on panel proportions, typography and logo.

## Selected-group copy/paste — 2026-09-06

Added Ctrl/Cmd+C and Ctrl/Cmd+V for selected notes/events, using a window-local snapshot clipboard. Paste defaults to the copied group's end, advances by its span for repeated pastes, and targets the active instrument. A click on empty roll space in Select mode sets a grid-aligned paste position. Group offsets, arbitrary integer durations, pitches and attached tempo are retained; original inherited volumes are materialized to avoid destination inheritance changing the copied dynamics. Pasted notes get new IDs, remain selected and form one undo checkpoint. Muted lanes, incompatible silent/musical roles and conflicting global tempo instructions reject paste without mutation. Editing input/select/textarea/contenteditable elements keeps native shortcuts; copying or pasting during a pointer gesture is ignored.

Changed: src/note-clipboard.ts, src/keyboard.ts, src/pointer.ts and corresponding dist modules; tests/renderer.test.cjs, tests/electron-instrument-actions.cjs, README.md, PROJECT_MAP.md, PROGRESS.md. Validation: incremental build and all 43 tests pass, with renderer assertions for group data, fresh IDs, inherited volume, cross-instrument paste, undo/redo, text-field behavior, muted/silent destinations and atomic tempo-conflict rejection. Native Electron verification passes keyboard-event copy/paste and undo in the actual DOM, alongside the instrument-action regressions. Native events in this test are dispatched programmatically; no physical keyboard/audio/in-game testing. Clipboard does not cross app windows or use the system clipboard. Changes remain local, with no push.

## Delete/merge instruments and organized panels — 2026-09-06

Added Delete and Merge into controls to expanded instrument panels. Delete confirms note/event and global-tempo removal; deleting the last instrument leaves an empty Piano. Merge transfers every source note/event into the destination, retaining destination name/color/preset and source timing, IDs, pitch and tempo. Original inherited volumes are resolved before combining lanes; simultaneous conflicting volumes show a confirmation warning because the model has one V per instrument/position. Silent Instructions merge only with silent Instructions. Musical merges adopt the destination sound, including its melodic/drum role, as stated in confirmation.

Both operations checkpoint once and support project undo/redo, stop playback, clear selections/gestures, remap surviving mute/collapse preferences and invalidate stale MML output. Instrument-count changes during undo/redo reset session preferences. Panels now have a consistent border/title area, separate sound/MML/action sections, a wider sidebar and keyboard focus indicators. Collapsing hides all details/actions.

Changed: src/model/instrument-operations.ts, src/instrument-actions.ts, src/instruments.ts, src/history.ts, corresponding dist modules, style.css, tests/instrument-operations.test.mjs, tests/renderer.test.cjs, tests/core.test.ts, tests/run.cjs, tests/electron-instrument-actions.cjs, PROJECT_MAP.md, PROGRESS.md. Existing renderer label expectation and two old overlap-rejection tests were updated to match the already-implemented behavior documented in earlier checkpoints; overlap validation behavior was not changed.

Validation: node tests/run.cjs passes all 43 tests and the incremental build. Regression coverage includes cancellation, deletion of the final lane, index remapping, merge in both index directions, volume inheritance/conflicts, tempo preservation, silent role protection, playback stop and exact project undo/redo. Native Electron test passes real DOM controls, collapse layout, cancel/confirm action paths (confirmation response stubbed), merge/delete/undo/redo and sidebar overflow at 1100px. Evidence: .validation/electron-instrument-actions.json and .png; screenshot visually inspected. No native confirmation-dialog clicking, physical-speaker listening or in-game MS2 validation was performed. Work is local; no GitHub push. Next: user trials of the updated instrument workflow.

## Repository setup — 2026-09-06

Initialized a local Git repository for the project. Added `.gitignore` rules for installed dependencies, local validation output, release bundles, archives/logs, and the Windows spell-check cache; source, tests, generated runtime files, bundled assets, package metadata, and documentation remain versionable.

Validation: repository initialized and initial commit created after reviewing the staged file list. No remote was configured because no repository URL was provided.

Next: add a remote with `git remote add origin <url>` and push when the destination is chosen.

Added playback/ modules (GM names, MIDI compiler, SoundFont engine, transport), music/tempo.ts, bundled TimGM6mb bank and license. Extended optional data fields, inspector, preset UI, transport buttons/playhead, native asset IPC, build bundling and tests. Version-2 JSON remains readable; older files default to Acoustic Grand Piano and 120 BPM.

Verification: build and all 12 tests pass. Tests cover tempo bounds/conflicts/moving/deleting, clock conversions, initial rests and MIDI programs/velocity, backward JSON compatibility, multiple MIDI ports, all 128 bank presets and non-silent PCM rendering for all 128. Renderer regression test exercises GM dropdown/T inspector as well. Native Electron audio device output remains unverified.

Deliverable: mml-studio-v0.3.0-gm-playback-tempo-patch.zip. Apply to modular v0.2.2, run npm install then npm start. New audio modules are isolated for future focused edits. See PLAYBACK_UPDATE.md and PROJECT_MAP.md.

## Local validation — 2026-09-06 (Windows, Node 22.12.0)

Read AGENTS.md, PROJECT_MAP.md, PROGRESS.md and PLAYBACK_UPDATE.md. No application source or project format changes.

- Standard npm launcher fails because it resolves a missing AppData/Roaming/npm/node_modules/npm/bin/npm-cli.js. Used the installed CLI at C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js.
- Ran npm install and then npm ci from the existing lockfile to restore dependencies. Full test runner invokes the incremental build; source transpilation succeeds, but synth bundling fails. Windows reports node_modules/stb-vorbis/dist/index.js contains a virus or potentially unwanted software. Security protection was not changed. Subsequent imports report the entry point missing.
- Six existing core tests pass when compiled with transpile.cjs and run separately; temporary compiled test removed. Existing simulated DOM renderer test passes (one test). These are not native UI tests.
- Existing playback suite fails during module loading because the blocked stb-vorbis entry point is unavailable; its five tests could not execute. Full build/test success is not established locally.
- Launched installed Electron against this folder. Processes started and reported responding, but no main-window title was observed. This establishes process startup only, not successful native rendering. Native interaction and physical audio output remain unverified; native-control runtime was unavailable.

Changed tracked project documentation: PROGRESS.md. Dependency installation restored node_modules; incremental build may refresh generated dist outputs, but vendor bundling did not complete. No source fixes or feature changes were made.

Next: investigate the Windows security detection and obtain a verified usable synth dependency through an approved resolution, then rerun node tests/run.cjs and native window/playback checks. Do not treat this checkpoint as a passing desktop release.

## Piano previews and decoder removal — 2026-09-06

Implemented left-keyboard clicks as 500 ms previews using the active instrument's GM preset. Preview has a separate lazy synthesizer, releases its note automatically, replaces rapid clicks, ignores stale initialization, reports failures, and leaves notes/selection/history untouched. Right-click and header clicks do not preview. Version-2 JSON and existing editor module ownership are preserved.

Removed the upstream stb-vorbis runtime dependency through a local SF2-only rejection adapter; pinned SpessaSynth core 4.3.22 alongside wrapper 4.3.14. Rebuild both renderer synth and AudioWorklet with that adapter because the upstream prebuilt worklet embeds the decoder. Compressed SF3 decoding is explicitly unavailable; the fixed SF2 bank needs none. See AUDIO_SECURITY.md for research sources, alternatives, and scope. Security protections were not changed. Corrected main.cjs to load index.html relative to its own directory, discovered when running Electron with the smoke-test entrypoint.

Changed source/config/build files: src/pointer.ts, src/playback/engine.ts, new src/playback/preview.ts, main.cjs, package.json, package-lock.json, build.cjs, new build-audio.cjs, new packages/sf2-only-decoder/package.json and index.js. Generated outputs: dist/pointer.js, dist/playback/engine.js, dist/playback/preview.js, vendor/synth.js, vendor/spessasynth_processor.min.js. Tests: tests/run.cjs, tests/renderer.test.cjs, tests/playback.test.mjs, new tests/preview.test.cjs and tests/electron-smoke.cjs. Documentation: PROGRESS.md, PROJECT_MAP.md, PLAYBACK_UPDATE.md, new AUDIO_SECURITY.md.

Actual validation: clean npm ci succeeds with no upstream decoder tarball in the lockfile. node tests/run.cjs passes all 15 tests, including non-silent PCM for all 128 bank presets, preview lifecycle/error/race checks, and simulated DOM piano hit/preset/no-edit checks. Repeated incremental build preserves generated-file timestamps. Native Electron smoke test passes after clean installation: real canvas mouse events for Piano/Violin/Flute produce nonzero AudioWorklet PCM; Play/Pause/Resume/Stop and preview during song playback work; piano clicks create no notes. Native screenshot inspected. Evidence in .validation/electron-smoke.json and .validation/electron-smoke.png. This is native renderer/audio-graph verification, not a listening test of physical speakers or a native file-dialog test.

Deliverable: mml-studio-keyboard-preview-sf2-patch.zip, with relative paths preserved. Local installation and generated files are already updated. For another copy, close the editor, extract over this v0.3.0 folder, run npm ci and npm start. This machine's standard npm launcher still points at a missing roaming CLI; validation used node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" ci and node tests/run.cjs.

Next: user listening check of preview sound/output level and desired preview duration. No further feature change was requested.

## MIDI import and permanent MS2 duration rule — 2026-09-06

Added Import MIDI with native byte-file IPC, format-0/1 PPQ parsing, pure conversion into the unchanged version-2 project, a report of approximations, unsaved-replacement confirmation, and view positioning. Cancel/invalid input/declined replacement leave the project untouched. Successful import stops song playback, resets selection/history, and marks the imported project unsaved. No new npm dependencies or audio-decoder changes.

Preserves note pitches, leading rests, arbitrary integer durations, GM programs, tracks/ports/channels, sustain-expanded durations, and same-pitch overlaps through additional instrument lanes. MIDI velocities and tempos are mapped to current V/T bounds with a report. Silent V0 tempo markers preserve clock changes in rests/held notes. Import does not grid-snap or power-of-two-quantize note lengths. Finer MIDI timing rounds to 1/128-whole-note units. Unsupported controls/percussion preview/time signatures are reported; format 2, SMPTE and non-SMF wrappers are rejected. See MIDI_IMPORT.md for exact behavior and bounds.

Recorded the user-supplied MapleStory 2 non-power-of-two duration requirement in AGENTS.md, PROJECT_MAP.md and MIDI_IMPORT.md, explicitly distinguishing integer model lengths from MML denominators and documenting the current resolution limit for future export work.

Changed files: new src/import/smf.ts and src/import/midi.ts; src/files.ts; main.cjs; preload.cjs; index.html; style.css; tests/run.cjs; new tests/midi-fixtures.cjs, tests/midi-import.test.mjs and tests/electron-midi-import.cjs; AGENTS.md; PROJECT_MAP.md; PROGRESS.md; new MIDI_IMPORT.md. Generated files: dist/files.js, dist/import/smf.js, dist/import/midi.js.

Actual validation: incremental build and all 23 automated tests pass. New regressions cover 7/11-unit durations and internal MIDI/JSON round trips, finer-time rounding, format-1 track/port/program mapping, running status, sustain/overlaps, tempos and silent markers, unsupported-event reporting, dangling notes and malformed/truncated files. Native Electron import checks pass for cancel, malformed data, declined dirty-state confirmation, successful byte IPC/conversion/report, unchanged lengths after changing grid, and starting/stopping playback. Native report/editor screenshots inspected, including the 900 px minimum window width with no page overflow. File-dialog selection was stubbed; actual native OS picker interaction and physical speaker listening were not tested. Evidence: .validation/electron-midi-import.json, midi-import-report.png and midi-import-editor.png. Final copy-only pluralization fix rebuilt after those checks.

Working folder and build outputs are already updated. Restart the editor and choose Import MIDI; no extraction or dependency installation is needed here. Optional transfer/backup ZIP: mml-studio-midi-import-patch.zip (apply only to another copy with the preceding preview/SF2 update).

Next: user trials with representative MIDI files; exact fractional timing and percussion playback remain separate future improvements, not silently promised import fidelity.

## Remove import/export-limit coupling — 2026-09-06

User correction: limits belong to future export planning, not MIDI import or editing. Removed the 16 MiB file cap in both native IPC and the reader, the 256-track / 250,000-event caps, all 10,000-note/marker checks, and the 512-instrument cap. Removed source-name truncation. Structural MIDI validation still rejects malformed files and unsupported formats; it does not apply target export rules.

MIDI BPM now preserves the exact microseconds-derived value without T32–T255 clamping or integer rounding. Positive finite decimal BPM values are accepted by the model, JSON loading and inspector. JSON remains version 2 with the same fields; older builds with narrow tempo validation may reject these broader values. The existing preview backend reports an unrepresentable manually entered MIDI tempo rather than silently wrapping its bytes; this does not prevent importing or saving the project. Imported SMF tempos round-trip exactly through the MIDI preview encoding.

Supporting large projects required removing argument-spread extrema in viewport/new-note IDs/playback, replacing quadratic collision checking with grouped interval sorting, indexing tempo attachment by start position, and compiling V inheritance once per timestamp group rather than rescanning the entire song for every note. Existing same-start V tie-breaking and overlap rules are preserved. No new export-warning UI is implemented yet; AGENTS.md, PROJECT_MAP.md and MIDI_IMPORT.md explicitly place that work in future export planning. Existing timing-resolution/velocity conversions and unsupported-event reports remain documented.

Changed source: src/import/smf.ts, src/import/midi.ts, src/music/tempo.ts, src/inspector.ts, src/model/validation.ts, src/viewport.ts, src/pointer.ts, src/playback/midi.ts, main.cjs, index.html. Generated: corresponding eight dist JavaScript modules. Tests: tests/midi-fixtures.cjs, tests/midi-import.test.mjs, tests/playback.test.mjs, tests/renderer.test.cjs, tests/electron-midi-import.cjs. Documentation: AGENTS.md, PROJECT_MAP.md, MIDI_IMPORT.md, PLAYBACK_UPDATE.md, PROGRESS.md.

Actual validation: incremental build and all 26 automated tests pass. New tests import/save/compile 130,000 notes (>250,000 events), accept >16 MiB and 513-track/instrument files, and round-trip slow, fast, fractional and boundary SMF tempos exactly. Native Electron test also passes: real file IPC handles >16 MiB; a 130,000-note project renders and starts/stops playback without argument-count exceptions. Cancel, malformed-file handling and dirty-state protection still pass. OS file selection is stubbed and physical speaker output is not a listening test. Evidence: .validation/electron-midi-import.json.

The working folder is already updated; restart the editor. Optional backup/transfer artifact: mml-studio-import-without-caps-patch.zip. Future export planning should assess destination constraints and present warnings/choices without altering the imported source project.

## Integer tempo instructions — 2026-09-06

User clarified that tempo instructions must specifically be integers. Positive integer BPM is now enforced by shared model/JSON validation and the inspector; the number input uses min=1 and step=1. Fractional MIDI-derived BPM is rounded to the nearest whole BPM with a conversion notice. No T32–T255 clamp or import size/count cap is restored. This supersedes the preceding checkpoint's fractional-tempo allowance. Existing JSON with fractional instructions is rejected rather than silently modified.

Changed: src/music/tempo.ts, src/import/midi.ts, src/inspector.ts, index.html; generated dist/music/tempo.js, dist/import/midi.js, dist/inspector.js; tests/playback.test.mjs, tests/midi-import.test.mjs, tests/renderer.test.cjs; AGENTS.md, PROJECT_MAP.md, MIDI_IMPORT.md, PLAYBACK_UPDATE.md and PROGRESS.md.

Validation: incremental build and all 26 automated tests pass, including decimal rejection in model/JSON/simulated inspector, integer MIDI rounding with notices, acceptance of 20/300 BPM, and the prior large-import regressions. Native UI testing was not repeated for this small validation/input change. Folder and generated files already updated; optional backup/transfer ZIP: mml-studio-integer-tempo-patch.zip.

## General MIDI Standard Drum Kit — 2026-09-06

Confirmed GM1's standardized channel-10 percussion map (47 keys, 35–81), separate from melodic programs. Added Standard Drum Kit as the 129th selector option, with the requested persistent non-blocking warning: Not a valid MS2 instrument. Available for editing and preview. MIDI channel-10 parts import automatically as drum instruments, with alternate kit programs mapped to Standard Kit and reported. Optional boolean isDrum is saved in version-2 JSON; existing missing/false flags remain melodic. No new dependency or bank is needed.

Song playback allocates channel 10 on distinct ports for drum lanes; melodic lanes avoid that channel. Keyboard previews use the independent synth's drum channel and report the GM percussion name. Switching to a melodic preset removes the warning and retains notes. Drum map and future export handling are documented in DRUM_KIT.md and AGENTS.md; no export restriction blocks import/edit/save.

Changed source: src/model/types.ts, src/model/serialization.ts, src/instruments.ts, src/playback/midi.ts, src/playback/engine.ts, src/playback/preview.ts, new src/playback/drums.ts, src/pointer.ts, src/import/midi.ts, style.css. Generated corresponding dist modules. Tests: tests/playback.test.mjs, tests/midi-import.test.mjs, tests/preview.test.cjs, tests/renderer.test.cjs, tests/electron-smoke.cjs. Docs: AGENTS.md, PROJECT_MAP.md, MIDI_IMPORT.md, PLAYBACK_UPDATE.md, new DRUM_KIT.md, PROGRESS.md.

Validation: incremental build and all 29 automated tests pass, including all 47 standard percussion keys producing non-silent PCM. Native Electron smoke test passes warning display, real kick key-click preview (measured peak about 0.0093), sequenced kick/snare output (about 0.00067), and prior melodic/transport checks. Native screenshot inspected; physical speakers were not independently heard. Evidence: .validation/electron-smoke.json and electron-smoke.png.

Working folder already updated; restart the editor and select Standard Drum Kit. Optional backup/transfer patch: mml-studio-standard-drum-kit-patch.zip.

## Timeline follow, Instructions and tempo indicators — 2026-09-06

Implemented horizontal playback following at 75% of the viewport while preserving vertical position and pause/resume behavior. Added selectable silent Instructions instruments, automatic routing of unbound MIDI tempos, tempo-only MIDI support and recognition of legacy silent tempo lanes. Instructions have editable integer tempo and horizontal movement; they cannot sound or consume an instrument channel. Yellow full-height roll lines and T labels mark actual global tempo changes on either notes or Instructions. JSON stays version 2 with optional isInstructions metadata. See TIMELINE_UPDATE.md.

Changed source: src/model/types.ts, src/model/instructions.ts, src/model/serialization.ts, src/import/midi.ts, src/playback/midi.ts, src/playback/follow.ts, src/playback/transport.ts, src/viewport.ts, src/music/tempo.ts, src/rendering/tempo.ts, src/rendering/notes.ts, src/painting.ts, src/instruments.ts, src/pointer.ts, src/geometry.ts, src/inspector.ts, src/files.ts; corresponding generated dist modules; index.html and style.css. Tests: tests/timeline.test.mjs, tests/renderer.test.cjs, tests/run.cjs, tests/electron-timeline.cjs. Docs: AGENTS.md, PROJECT_MAP.md, MIDI_IMPORT.md, PLAYBACK_UPDATE.md, TIMELINE_UPDATE.md, PROGRESS.md.

Actual validation: incremental build and all 34 automated tests pass. Native Electron timeline test passes Instructions selector, exact yellow canvas pixels, real sequencer playback following, preserved vertical position and pause/resume. Screenshot inspected. Evidence: .validation/electron-timeline.json and .validation/electron-timeline.png. This is native app integration, not physical speaker listening. No unrelated files were rebuilt from scratch.

Working folder and generated outputs are updated directly. Restart the editor; no patch extraction is required here. Optional transfer/backup: mml-studio-timeline-patch.zip.

## Mute, Solo and collapsible instruments — 2026-09-06

Added per-instrument Mute and exclusive Solo preview controls. Solo silences every other instrument; choosing another Solo transfers isolation; toggling the active Solo off unmutes all instruments (clears previous manual mutes). Manual Mute toggles that instrument's explicit mute; Solo isolation still takes precedence for other instruments. Changes apply to running/paused playback through the synth's channel mute API, with melodic/drum MIDI port mappings retained by the playback compiler. Muting stops held voices; unmuting lets subsequent notes sound without retriggering held notes. Piano-key previews also respect mute.

Muted notes and their yellow tempo indicators are hidden and cannot be hit, box-selected or drawn into while muted. Selection clears when mute/solo changes. Tempo instructions remain in the global playback clock even when their owner is hidden, preserving synchronization. Collapse hides preset, color, helper text and Mute/Solo controls, retaining a compact selectable name and expand arrow. Session preferences stay outside version-2 JSON and undo snapshots and reset on New/Open/successful MIDI import.

Changed source: src/state.ts, src/instruments.ts, src/geometry.ts, src/pointer.ts, src/rendering/notes.ts, src/rendering/tempo.ts, src/files.ts, src/playback/midi.ts, src/playback/engine.ts, src/playback/transport.ts, style.css; corresponding ten dist modules. Tests: tests/renderer.test.cjs and new tests/electron-instruments.cjs. Documentation: PROGRESS.md.

Actual validation: node tests/run.cjs passes all 34 tests including expanded simulated-DOM regressions for independent mute, solo transfer/off, hidden notes/hit testing/edit protection, collapse toggles, unchanged saved data/history, reset and live engine mute calls. Incremental build passes (initial sandbox dependency traversal failed; rerun outside sandbox succeeded). Native Electron integration passes actual computed collapse layout and starting/muting/solo switching/pausing/resuming playback with 17 instruments spanning melodic ports and drums. Evidence: .validation/electron-instruments.json. No PCM measurements or physical speaker listening performed for this change. Final selection-handler adjustment preserves double-click renaming and was followed by a passing full build/test run.

Working folder and generated files are updated. Optional transfer patch: mml-studio-mute-solo-collapse-patch.zip. Next: user listening/layout trials; no project-format migration is needed.

## Solo as a quick mute toggle — 2026-09-06

User correction supersedes the preceding exclusive-isolation behavior. Solo now writes ordinary mute flags for all other instruments. Clicking any Mute control clears the Solo indicator and toggles only that instrument, retaining all other mute flags. Solo A then unmute B plays/shows A and B while C and remaining instruments stay muted. Clicking an active Solo again still unmutes everything; selecting a different Solo still mutes every other instrument. New instruments follow their normal unmuted default.

Changed: src/state.ts, src/instruments.ts, generated dist/state.js and dist/instruments.js, tests/renderer.test.cjs, PROGRESS.md. Validation: node tests/run.cjs passes all 34 tests and the incremental build. Added three-instrument simulated-DOM coverage for releasing a second lane, preserving the third lane's mute, clearing Solo, live playback mute updates, restored timeline drawing, and subsequent mute/solo switching/off. Native UI/audio testing was not repeated for this correction. Folder is updated; transfer patch: mml-studio-solo-quick-toggle-patch.zip. Next: user trials of the corrected toggle behavior.

## MML generation, byte counts and native channel window — 2026-09-06

Added a DOM-free MML compiler with exact integer-duration decomposition, ties, rests, sharps/octaves, inherited volume and synchronized global tempo in every musical channel. Heap-based interval partitioning retains every note in the minimum number of non-overlapping channels. More than 10 Channels shows a non-blocking warning. Instructions contribute tempo without becoming sounding channels. Drum/unsupported tempo/pitch warnings preserve source data for later export decisions; version-2 JSON and editing/import limits are unchanged.

Instrument panels now show exact raw-string UTF-8 byte totals and channel counts, per-instrument Real time updating, manual Update MML and Open MML. Paused snapshots are marked Out of date, remain paused through undo/redo, and generate no strings until requested. Counts update during pointer edits and inspector changes. The separate native pop-out provides channel tabs, per-channel bytes, read-only raw text and Copy to clipboard for exactly the selected string. New/Open/import clear the old window contents. See MML_GENERATION.md for scope and dialect reference.

Changed source: new src/music/mml.ts, src/mml.ts and src/mml-window.ts; src/instruments.ts, src/inspector.ts, src/state.ts; main.cjs, preload.cjs, new mml.html, style.css. Generated: dist/music/mml.js, dist/mml.js, dist/mml-window.js, dist/instruments.js, dist/inspector.js, dist/state.js. Tests: new tests/mml.test.mjs and tests/electron-mml.cjs, tests/renderer.test.cjs, tests/run.cjs. Docs: PROJECT_MAP.md, MML_GENERATION.md, PROGRESS.md.

Actual validation: node tests/run.cjs passes all 38 tests and the incremental-output build. New pure tests independently decode every duration 1–400, initial rests, sharps, byte totals, volume inheritance, >10 voices, global tempo within held notes/rests, Instructions silence and compatibility warnings. Expanded simulated-DOM tests check edit counts, pause/manual refresh and pause surviving undo. Native Electron test passes real separate window creation, 11 tabs/warning, tab switching, selected-channel clipboard equality, frozen stale text, manual refresh, re-enabling updates, tab removal and clearing after New. Evidence: .validation/electron-mml.json and .validation/electron-mml.png; screenshot inspected. Sandbox dependency traversal and GPU startup failed initially; approved runs outside the sandbox passed. No in-game MS2 playback or file export was tested or added.

Working folder and generated outputs are updated. Optional transfer: mml-studio-mml-generation-patch.zip. Next: in-game compatibility trials and a separate MS2MML file-export planner; no truncation or silent export-limit clamping is applied here.

## Tempo before tied continuation — 2026-09-06

Confirmed note-bound tempo already uses the project-wide tempo map and reaches every generated musical channel through its final note, including other instruments. Corrected held-note boundary ordering from c4&t150c4 to c4t150&c4: & immediately prefixes the continuation after the tempo command. Notes remain split exactly at tempo changes; separate adjacent notes remain separate.

Changed: src/music/mml.ts, generated dist/music/mml.js, tests/mml.test.mjs, AGENTS.md, MML_GENERATION.md, PROGRESS.md. The independent test reader now rejects commands between & and its note. Added exact-string and decoded-clock regressions for two note-bound tempo changes across overlapping channels and a second instrument. node tests/run.cjs passes all 39 tests and the incremental build (approved outside sandbox for dependency traversal). Native UI and in-game playback were not repeated for this pure serializer correction. Working folder updated; transfer patch: mml-studio-tempo-tie-order-patch.zip.
## Overlap warnings and MS2MML export — 2026-09-06

Same-pitch overlapping notes now remain in one instrument during MIDI import and editing; validation no longer rejects them. Import and generated MML show non-blocking warnings because MS2 may behave unexpectedly. Added Export Selected instrument to MS2 and Export Project controls. They write the documented XML `<ms2>` format with one melody and only non-empty numbered chords. Exports over 10,000 bytes require the requested confirmation; project export checks every instrument before opening save dialogs.

Changed: src/model/validation.ts, src/import/midi.ts, src/music/mml.ts, new src/export.ts, src/renderer.ts, main.cjs, preload.cjs, generated dist modules, PROJECT_MAP.md, PROGRESS.md. Incremental build was attempted but sandbox dependency traversal remains blocked by the known esbuild/spessasynth access issue. Full tests should be rerun outside the sandbox when usage allows.
## File action placement and project labels — 2026-09-06

Moved Export Selected instrument to MS2 and Export Project into the header beside New/Open/Import/Save. Renamed the end-user labels Open JSON and Save JSON to Open Project and Save Project; JSON remains the underlying storage format.

Changed: index.html, src/export.ts, generated dist/export.js and dist/renderer.js, PROGRESS.md. Focused source transpilation completed; no behavior changes to export or project serialization.
## Explicit per-instrument character count — 2026-09-06

Clarified the instrument row and MML pop-out labels as “Instrument character count”. The value is generated from that instrument’s channels only; no notes or channels from other instruments are included. Added a focused regression for instrument-local byte totals.

Changed: src/mml.ts, src/mml-window.ts, generated dist/mml.js and dist/mml-window.js, tests/mml.test.mjs, PROGRESS.md. Build/test follow-up remains subject to the known sandbox esbuild dependency access restriction.
## Closable MML pop-out — 2026-09-06

Made the native MML window explicitly closable and cleared its retained payload on close. The main editor is also explicitly closable; closing all windows can now terminate Electron normally instead of leaving a child window or terminal process alive.

Changed: main.cjs, PROGRESS.md. Native close-button verification remains to be rerun when the Electron test runner is available.
## Main window close after MIDI import — 2026-09-06

Removed the renderer `beforeunload` cancellation that could block Electron’s native main-window close after an import marked the project dirty. The native X now closes the editor consistently; project save/open/import prompts remain owned by their explicit actions.

Changed: src/files.ts, generated dist/files.js, PROGRESS.md. Focused source transpilation completed; native close-button verification remains pending.
## MS2 drum presets and note splitting — 2026-09-07

Added Snare Drum, Bass Drum and Cymbals presets. Every stored pitch on these lanes previews/plays the Standard Kit key D2 (38), B1 (35), or C#3 (49), respectively; generated MML and MS2MML export use only C4. Original note pitches remain editable and save unchanged. Version-2 JSON adds optional ms2Drum: snare/bass/cymbals; invalid values or conflicting drum-kit/Instructions flags are rejected. Standard Drum Kit retains its non-blocking MS2 warning.

Instrument actions now offers Split Notes with a note-name input and existing musical destination selector. It moves all exact-pitch matches without deleting the source instrument. Standard Drum Kit alone also offers Split Drumkit, creating only populated MS2 categories: bass keys 35/36, snare keys 38/40, cymbal keys 42/44/46/49/51/52/53/55/57/59 (including hi-hats and ride bell). Side stick, clap, toms and other percussion remain in the source. Automatic splitting creates new category instruments even when similarly named lanes already exist; use Split Notes to target an existing lane. Both actions preserve IDs, timing, original pitches, tempo and resolved inherited volumes, stop playback, and checkpoint once. Exact splitting warns before combining differing simultaneous destination volumes. No-match splits leave history/data unchanged.

Changed source: src/playback/drums.ts, src/playback/midi.ts, src/pointer.ts, src/model/types.ts, src/model/serialization.ts, src/model/instrument-operations.ts, src/music/mml.ts, src/instruments.ts, src/instrument-actions.ts; corresponding eight generated dist modules; studio.css. Tests: tests/instrument-operations.test.mjs and tests/renderer.test.cjs. Documentation: DRUM_KIT.md, PROJECT_MAP.md, PROGRESS.md. Rename input detection was scoped to the rename field so the new split textbox does not block renaming.

Actual validation: node tests/run.cjs passes all 48 tests and the incremental-output build, including existing SoundFont PCM checks. The initial sandbox build failed at known esbuild dependency traversal; approved execution outside the sandbox passed. New tests cover persistence/rejection, decoded MIDI percussion keys, C4 MML, exact split inheritance and conflict detection, category coverage/empty-category omission, simulated-DOM fixed previews, real handler wiring, and undo. Updated stale renderer harness assumptions to the current folder's existing UI (microtask scheduling, inline rename/icon labels, separate Spray tool, combined Play/Pause, and current Solo isolation); no unrelated product behavior was changed. No native UI, physical-speaker listening or in-game MS2 test was performed.

Working folder and generated files are updated. Transfer artifact: mml-studio-ms2-drums-patch.zip. Next: native UI/listening and in-game export trials.

## MML import and grid text paste — 2026-09-07

Implemented common MML parsing, MS2MML XML, 3MLE Channel sections and the supplied MNE multi-part format. File > Import MIDI / MML uses the existing import workflow, reports conversion notices, preserves version-2 JSON and applies no export caps. MNE names and GM instruments are retained. Unsupported ancillary settings, volume-model limitations and fractional timing rounding are reported. Unknown musical commands fail atomically. See MML_IMPORT.md for supported syntax and remaining dialect/encoding limitations.

Grid paste now receives native clipboard text, verifies/parses it, and inserts notes in the active instrument with selection, fresh IDs and undo. Internal copy/paste uses a custom clipboard marker; text inputs retain ordinary editing. Unbound tempos become silent Instructions events; conflicting tempo pastes leave the project unchanged. Fixed an existing import scroll assumption for an empty first instrument.

Changed: src/import/mml.ts (new), src/files.ts, src/note-clipboard.ts, src/keyboard.ts; corresponding four dist modules; main.cjs, index.html; tests/mml-import.test.mjs (new), tests/renderer.test.cjs, tests/run.cjs; MML_IMPORT.md, PROJECT_MAP.md, PROGRESS.md.

Actual validation: node tests/run.cjs completed the incremental-output build and all 54 automated tests passed. Build initially hit the known sandbox dependency traversal issue; approved execution outside the sandbox passed. Regressions cover containers, malformed strings, arbitrary denominators, tied tempo changes, volume/persistence, >20,000 notes and >10 channels, simulated clipboard insertion and invalid-text preservation. Directly parsed H:/Downloads/gas_station_third_sanctuary.mne: 10,730 musical notes across all 10 instruments. Native Electron file dialogs/clipboard, physical audio and in-game playback were not tested. Next: native clipboard/dialog trials and additional real-world dialect/encoding fixtures. Transfer artifact: mml-studio-mml-import-patch.zip.

## Rename button only — 2026-09-07

Removed the instrument-name double-click rename handler. The dedicated Rename button retains the existing inline rename behavior. Updated the existing renderer rename regression to use that button and corrected the project map.

Changed: src/instruments.ts, generated dist/instruments.js, tests/renderer.test.cjs, PROJECT_MAP.md, PROGRESS.md. Actual validation: incremental build and node --experimental-vm-modules --test tests/renderer.test.cjs passed (simulated DOM, including button-driven rename). Native UI testing was not repeated. Transfer patch: mml-studio-rename-button-only-patch.zip.

## Configurable sheet limit, red timeline boundary and multipart export — 2026-09-07

Added Export > Character limit, a persistent positive-integer application setting defaulting to 10,000 combined raw MML characters per instrument. The active instrument shows its first planned sheet boundary in red and recalculates from current musical data, including edits and global tempo changes, independently of paused MML snapshots. No import/edit/project-save limits or JSON migration were introduced.

Oversized exports ask “Do you still wish to export?” with the requested single file / parts / No choices. Parts cut all channels at a common time, favor clean boundaries within a quarter note, clip held notes and continue their remaining duration in the next file, restore tempo/volume/octave and pad channel endings for synchronization. Every generated part respects the selected limit including controllers/rests; impossible tiny limits report an error. Source notes are unchanged. All-instrument export uses the same per-instrument choice. Fixed XML chord numbering to index attributes. See SHEET_LIMITS.md for conservative search and separate-file continuation behavior.

Changed source: src/music/mml.ts, new src/music/sheets.ts, new src/sheet-settings.ts, new src/rendering/sheet-limit.ts, src/painting.ts, src/export.ts; six corresponding dist modules; index.html, studio.css; new tests/sheets.test.mjs and tests/electron-sheets.cjs, tests/renderer.test.cjs, tests/run.cjs; SHEET_LIMITS.md, MML_GENERATION.md, PROJECT_MAP.md, PROGRESS.md. Compiler overlap detection now uses sorted pitch end times rather than a quadratic scan, supporting interactive planning on large imports.

Actual validation: incremental-output build and all 59 automated tests pass via node tests/run.cjs (approved outside sandbox for dependency access). Independent decoded-output tests cover polyphony, inherited volume, global tempo, arbitrary durations, clean/forced cuts, rest-only portions, equal-limit files and tiny-limit rejection; simulated renderer tests cover live marker changes and export choices. Native Electron integration passes exact red canvas pixels, marker changes, saved setting, all dialog choices and actual IPC file writes; OS save picker was stubbed. Screenshot inspected. Evidence: .validation/electron-sheets.json and .validation/electron-sheets.png. No in-game MS2 or physical audio check was performed.

Supplied MNE first instrument: 14,739 raw characters; at default 10,000, planner produced intervals [0,17122) and [17122,22192), with 9,993 and 3,745 characters respectively (about 20 ms measured locally for planning). Working folder and generated outputs updated. Full source/application bundle: mml-studio-sheet-limits-full.zip (excludes node_modules, prior archives, release bundles and validation scratch files). Next: in-game sheet playback trials.

## Exact-onset overlap warnings and yellow crowded regions — 2026-09-07

Corrected MML and MIDI import warnings to the user definition: same start time, same pitch, same instrument. Same-pitch sustained notes starting at different times no longer warn. Detection uses source pitches before fixed MS2 drum mapping. Removed stale validation messages implying overlap is an editing error. Musical data and version-2 JSON are unchanged.

Added yellow outlined/shaded timeline boxes behind notes for the selected musical instrument's regions with strictly more than ten simultaneous notes. The interval sweep handles touching endpoints without phantom extra voices and merges contiguous crowded spans. Regions update after edits, additions/deletions and instrument changes; scroll/zoom position them correctly. Instructions events are excluded.

Changed: new src/music/note-density.ts and src/rendering/note-density.ts; src/music/mml.ts, src/import/midi.ts, src/painting.ts, src/commands.ts, src/model/serialization.ts and their seven generated dist modules; new tests/note-density.test.mjs, tests/midi-import.test.mjs, tests/renderer.test.cjs, tests/run.cjs; AGENTS.md, PROJECT_MAP.md, MML_GENERATION.md, PROGRESS.md.

Actual validation: incremental build and all 61 tests pass via node tests/run.cjs (approved outside sandbox for dependency access). Tests cover warning semantics, source drum pitches, exact >10 regions and endpoint handling, and simulated-DOM yellow-box geometry, editing and instrument switching. Directly checked H:/Downloads/Song of Storms.json: 69 notes, five generated channels, 328 characters, no warnings and no crowded regions. Native Electron visual checks were not repeated for this change. Transfer patch: mml-studio-overlap-density-patch.zip.
## Project names, time signatures, sections and measure resets — 2026-09-07

Implemented the Project name field with undo, persistence and NAME.json as the native save suggestion. New and legacy unnamed projects display Untitled; imports adopt their source filename. Suggested filenames sanitize filesystem-invalid characters and reserved Windows names without changing project metadata.

Instructions now expose optional Time signature, Section and Reset measure count fields. Signatures take effect at the marker's exact start: a marker at an existing measure boundary changes that same measure. Off-boundary changes open a measure there. Named sections appear on the ruler and in toolbar navigation; blank names do not create sections. Reset off keeps existing numbering/alignment; reset on makes the named marker measure 1 and realigns the grid there, using the current signature. Visual metadata stays in version-2 JSON and does not affect generated MML or playback. New silent markers start without explicit tempo; users can still add tempo instructions. See PROJECT_STRUCTURE.md for persistence and boundary details.

Export has a sections-as-separate-song-sheets toggle for selected/all instruments. Named sections become ordered separate files; pre-section music remains as Opening. Held notes crossing boundaries retain their remaining durations, and tempo/volume inheritance is restored in each segment. Existing character-limit choices work within each section. Empty musical instruments and Instructions are silently skipped in each exported segment. Source project data remains unchanged.

Changed source: src/model/types.ts, src/model/project.ts, src/model/serialization.ts, src/model/validation.ts, new src/music/structure.ts, src/files.ts, src/commands.ts, src/inspector.ts, src/toolbar.ts, src/export.ts, src/instruments.ts, src/pointer.ts, src/rendering/grid.ts, src/rendering/ruler.ts, src/rendering/notes.ts; corresponding incremental dist outputs; main.cjs, index.html, studio.css. Tests: new tests/structure.test.mjs and tests/electron-structure.cjs, tests/renderer.test.cjs, tests/run.cjs. Docs: new PROJECT_STRUCTURE.md, PROJECT_MAP.md, PROGRESS.md. Pre-existing unrelated workspace modifications were retained.

Actual validation: node tests/run.cjs passes all 64 tests and the incremental-output build. Initial sandbox esbuild traversal failed; approved execution outside the sandbox passed. Added regressions cover persistence/malformed data, exact-start 3/4 and 6/8 changes, off-boundary reset, blank/non-reset sections, scrolled measure numbering, unchanged musical MML, held-note/tempo/volume slicing, empty-lane omission, naming/undo/save, inspector edits and toolbar navigation. Native Electron tests/electron-structure.cjs passes actual field handlers, scroll navigation, 1320/900px header bounds, named JSON save and section MS2MML writes. Native save picker was stubbed; actual saved files were checked. Final screenshot inspected after separating section labels from measure numbers. Evidence: .validation/electron-structure.json and .validation/electron-structure.png. No physical audio or in-game MS2 playback test was performed.

Working folder and generated outputs updated. Full application/source transfer archive: mml-studio-project-structure-full.zip (excludes installed dependencies, previous release bundles, Git data and validation scratch files). Next: user trials of multi-song projects and in-game section playback.

## Text-field focus after import and modal dialogs — 2026-09-07

User reported that all text fields could stop accepting clicks/typing after imports until Alt-Tab restored focus. Replaced the desktop's Chromium window.confirm implementation with a parented native Electron confirmation through a fixed preload IPC. Existing synchronous confirm/cancel semantics and unsaved-change protection remain intact; Cancel is the default. All native open/import/save/export dialogs now explicitly return focus to the main window and its web contents in a finally block, including cancellation. This addresses the suspected Windows modal-dialog focus handoff without changing text-field behavior or project data.

Changed: main.cjs, preload.cjs, src/chrome.ts, generated dist/chrome.js, new tests/electron-dialog-focus.cjs, PROGRESS.md. Actual validation: incremental build and all 64 existing automated tests pass via node tests/run.cjs (approved dependency access), and node --check main.cjs passes. New native Electron regression passes real mouse clicks and keyboard character input in Project name, Character limit, Time signature and Section after canceled/accepted import, declined/accepted unsaved-change confirmation, report closure and canceled save. OS dialogs are stubbed and deliberately blur the window to test focus restoration; real file IPC, MML import, renderer controls and typing are exercised. The original intermittent behavior was not reproduced with an actual OS picker. Evidence: .validation/electron-dialog-focus.json. Initial test harness used an unsupported webContents.blur API; corrected to BrowserWindow.blur before the passing run. The test also caught and fixed premature synchronous IPC reply delivery before acceptance was known.

Working folder updated. Fully exit and restart the editor because main/preload changes do not apply to an already running window. Transfer patch: mml-studio-dialog-focus-patch.zip. Next: user confirmation that imports no longer require Alt-Tab.

## Section playback, live voices, MIDI signatures and playback controls — 2026-09-07

Section selection now seeks active/paused playback or parks the start position for Play; Stop then Play returns to the selected section. The former static time-signature caption is an editable current-signature field, defaulting to 4/4. It follows the playhead or left visible timeline position. Editing captures that position on focus, updates/creates silent Instructions metadata, validates input, supports undo/save, and leaves version-2 JSON unchanged.

MIDI FF 58 signatures now import as silent Instructions markers, including explicit 4/4 and signature-only files. Musical notes never carry imported signatures; coincident unbound tempo markers are reused. Position rounding, last-event-wins conflicts, unsupported denominators finer than 1/128 and nonstandard notated scaling are reported. Malformed signature payloads and zero numerators fail validation. No import/export-limit caps were added.

Tempo, signature, section and reset captions now share floating bordered text boxes below the measure bar. Nearby captions stack, long labels are ellipsized to the viewport, and full text remains in the inspector. The measure bar contains only measure numbers/lines; yellow global tempo indicators still extend down the timeline.

Changing an instrument preset refreshes playback at its current position without requiring the user to Stop/Play. Musical/drum/Instructions routing, rapid changes, paused updates, Stop during loading and voice undo/redo are handled. Held notes are restored with original onset volume and remaining duration; earlier music remains available when rewinding. Refreshing voices briefly reloads the sequence and re-attacks held notes, rather than promising seamless timbre morphing. Other musical edits retain existing snapshot behavior.

Added Playback speed (25–400%, default 100%) and Playback Volume (0–100%, default 100%) sliders. Pointer speed changes snap within three percentage points of 50%/200%; keyboard stepping can leave those values. Speed multiplies the sequencer clock and leaves source tempo, notes and exports unchanged. At non-100% speed, smaller raised Effective BPM follows the true BPM and shows Out of bounds! below 32 or above 255; it warns without clamping. Volume is a shared master gain for both song playback and key previews, including already sounding audio and later synth initialization. These playback preferences are session-only.

Changed source: src/toolbar.ts, src/painting.ts, src/music/structure.ts, src/instruments.ts, src/history.ts, src/playback/transport.ts, src/playback/engine.ts, src/playback/midi.ts, src/import/midi.ts, src/import/smf.ts, src/rendering/ruler.ts, src/rendering/tempo.ts; corresponding 12 incremental dist outputs; index.html, studio.css. Tests: tests/renderer.test.cjs, tests/midi-import.test.mjs, tests/playback.test.mjs, tests/preview.test.cjs, new tests/electron-behavior.cjs. Docs: PROJECT_MAP.md, PROJECT_STRUCTURE.md, MIDI_IMPORT.md, PLAYBACK_UPDATE.md, PROGRESS.md. Pre-existing unrelated workspace changes were retained.

Actual validation: final node tests/run.cjs passes the incremental-output build and all 67 automated tests, including existing SoundFont PCM checks. New coverage includes silent MIDI signatures/persistence/malformed events, held-note routing/velocity/boundaries, real renderer handler wiring, live and paused preset changes, coalescing/cancellation/undo, section seek/restart, signature editing, floating-label geometry, speed limits/snaps/effective BPM and shared master gain. Initial sandbox esbuild dependency traversal failed; approved dependency access passed. Native tests/electron-behavior.cjs passes section position, live/paused held-note AudioWorklet PCM, rewind, 400% speed clock advancement, 0% master silence/50% restored PCM, and responsive control bounds at 900px. Screenshot inspected. Evidence: .validation/electron-behavior.json and .validation/electron-behavior.png. Native GPU helper startup required approved execution outside the sandbox; an initial test-script variable redeclaration was corrected. No physical-speaker listening, OS file-dialog or in-game MS2 playback check was performed for this patch.

Working folder and generated files updated. Transfer patch: mml-studio-playback-behavior-patch.zip. Restart the editor to load the updated renderer. Next: user listening trials, especially voice-change transitions and dense instruction captions.

## Temporary Song and Segment views — 2026-09-07

Added Open Song / Open Segment buttons for the named section under the playhead. Song boundaries use named reset-to-1 markers and ignore intervening Segments; Segment boundaries stop at the next named marker of either kind. The final view ends at the last note/instruction end. Entering stops playback and rebases the local timeline/playhead to zero. A view badge sits beside Project name with Return to Project. Songs containing Segments retain section skipping; other scoped views hide the dropdown. Returning translates the playhead into full-project time and clears stale navigation/paste positions.

The view is an editable temporary project projection with inherited tempo, time signature and initial lane volumes. MML generation runs again on this projection: channels are allocated afresh, character counts are accurate for the local notes, and the red limit line is recalculated. Playback honors the fixed view end, including silence before the next boundary. Scoped exports treat the view as the entire project, use only in-range events plus inherited starting context, prefix filenames with the view name, and ignore/disable the separate-sections checkbox while scoped. Existing single/parts limit choices still apply.

User clarified that edits/deletions of crossing notes must affect only the portion inside the view. Automatic clipping/context is compared against an unedited baseline; simply entering, exporting, saving or leaving does not cut the parent notes. Explicit edits create the necessary parent fragments, retaining outside timing/pitch/onset volume. Committed edits rebuild the projection so inheritance remains correct after instruction/note deletion. Save always writes the full parent project. Full-project undo/redo works inside views and after returning; scope changes themselves do not add undo entries. View boundaries remain fixed while open; use Return to Project for edits extending across them or to recalculate bounds after changing markers. Version-2 JSON is unchanged.

Shared instrument settings remain shared. Clearing a lane in a view removes only its local notes/events; scoped merges/splits preserve outside notes and source lanes. New/Open/Import clear the temporary view only after successful replacement. No import/export-limit restrictions were added. Details and architecture are documented in SEGMENT_VIEW.md.

Changed source: new src/model/segment-view.ts, src/segment-session.ts, src/segment-view.ts; src/state.ts, src/commands.ts, src/history.ts, src/pointer.ts, src/files.ts, src/instrument-actions.ts, src/note-clipboard.ts, src/export.ts, src/toolbar.ts, src/viewport.ts, src/painting.ts, src/renderer.ts, src/playback/midi.ts, src/playback/transport.ts; corresponding 17 generated dist modules; index.html and studio.css. Tests: new tests/segment-view.test.mjs and tests/electron-segment-view.cjs, tests/renderer.test.cjs, tests/run.cjs, tests/electron-behavior.cjs. Docs: new SEGMENT_VIEW.md, PROJECT_MAP.md, PROJECT_STRUCTURE.md, PROGRESS.md. Pre-existing unrelated workspace changes were preserved.

Actual validation: final node tests/run.cjs passes the incremental-output build and all 72 automated tests (approved dependency access for the known esbuild sandbox restriction). Added regressions cover Song/Segment bounds, inherited context, unchanged parent round trips, partial-note edits/deletion, unique IDs, lane routing, nested navigation, history across views, pointer creation, boundary rejection, instruction deletion/reinheritance, save/export scope, freshly optimized channels and local limit geometry. Native tests/electron-segment-view.cjs passes actual renderer handlers and JSON/MS2MML IPC file writes (OS picker stubbed), exact red canvas pixels, parent preservation/partial edits/undo, next-to-name badge and a 900px header. Native fixture: album >10 channels, scoped Solo 2 channels and 27 raw MML characters; exported text exactly equals view-generated MML. The first native run exposed the gray end boundary covering the red limit at the same position; painting order was fixed. Screenshot inspected; evidence: .validation/electron-segment-view.json and .validation/electron-segment-view.png.

Existing native tests/electron-behavior.cjs also passes live/paused voices, held-note PCM, rewind, playback speed, master gain and responsive controls after integration. Its timing assertion initially sampled before asynchronous Worklet seek acknowledgement; the harness now settles first and measures actual elapsed time rather than assuming timer punctuality. No physical-speaker listening or in-game MS2 check was performed.

Working folder and generated outputs are updated. Restart the editor to load Segment View. Full source/application transfer bundle: mml-studio-segment-view-full.zip (excludes installed node_modules, previous ZIPs/release bundles, Git data and validation scratch files). Next: user trials with real album projects and in-game scoped exports.

## Automatic MML length and volume compaction — 2026-09-07

Added pure optimizeInstructions() in src/music/mml-optimizer.ts, called for every generated channel by generateMml(). A backwards dynamic program chooses the cheapest default-length changes for the compiler's existing exact duration tokens. It omits matching length suffixes, uses implicit L4 initially, retains dots on notes/rests rather than L commands, and places any L change before the tied continuation's &. This optimizes default-length selection; it does not claim globally minimal duration decomposition or channel assignment.

Generated V commands now omit redundant values, including the implicit initial V8. Actual changes, V0 silence and returns to earlier volumes remain intact. Per the user's clarification, optimization touches only generated MML strings: explicit instrument/note volume settings, repeated volume instructions and all project data remain stored unchanged. Version-2 JSON and playback dynamics are unchanged.

Existing live edit refresh, manual Update MML, Song/Segment entry, export and sheet-limit planning all share this compiler pass; character counts therefore use compact output. The existing user-controlled Real time updating pause remains respected. Example: sixteen consecutive eighth-unit notes at V11 now produce t120o4v11l16 followed by sixteen c characters: 27 characters instead of 57. Views independently choose their own length defaults and inherit starting volume as before.

Changed: src/music/mml-optimizer.ts (new), src/music/mml.ts, corresponding dist/music modules, tests/mml.test.mjs, tests/sheets.test.mjs, tests/segment-view.test.mjs, PROJECT_MAP.md and PROGRESS.md. Independent test readers now understand L and omitted lengths while enforcing tie syntax. The leading-silence split fixture was lengthened because optimized rests now fit in fewer characters.

Actual validation: node tests/run.cjs passed the incremental-output build and all 76 tests, including simulated renderer refresh/view/export/limit checks and existing audio tests. Initial sandbox esbuild traversal failed; approved dependency access passed. Added exhaustive minimum-cost checks over 729 mixed-length phrases, timing checks for every integer duration 1–400, volume/dynamics preservation, view recompilation after edits and matching sheet counts. After the user's clarification, added explicit assertions retaining repeated project volumes; node --test tests/mml.test.mjs passed all 9 tests. No native UI or in-game playback test was performed for this pure compiler patch.

Working folder and generated files updated. Transfer patch: mml-studio-mml-optimizer-patch.zip; apply over the current Segment View version and restart the editor. Next: user trials with dense imported projects and MS2 exports.

## Tools menu: Simplify Timing — 2026-09-07

Added a Tools dropdown in the editor toolbar with Simplify Timing, L4/L8/L16/L32/L64 choices (initial L64), and Apply to selected instrument. This is an explicit project edit on all notes of the active musical instrument, independent of note selection and the drawing grid. Starts round down and ends round up to multiples of 128/L model units, simplifying implicit rests too. Durations can remain multiple grid cells; this does not force every note to exactly one cell.

When expansion would overlap a previously non-overlapping later note, including a different pitch, the first end rounds down instead. Existing chords and overlaps are retained. User clarified that a note which would become zero length must retain its original timing and be reported as skipped. Following notes are also preserved/reported when rounding their starts would collide with such a retained note. No notes are deleted. In scoped views, ends round down if expansion would cross the view boundary; existing projection/merge behavior preserves outside portions. Silent Instructions markers remain untouched. Note IDs, pitches, explicit volume settings and metadata remain stored. Conflicting instructions abort the operation through validation.

The operation uses the standard commit/history/refresh path: one undo step, refreshed MML/counts and limits, and no history entry for no-op conversions. The current playback snapshot follows the existing musical-edit behavior (Stop/Play to reload musical edits). This tool is never run implicitly on imports or as part of MML text optimization. Version-2 JSON remains unchanged.

Changed: new src/tools.ts and src/music/simplify-timing.ts; src/chrome.ts, src/renderer.ts and corresponding four generated dist files; index.html, studio.css; new tests/simplify-timing.test.mjs, tests/renderer.test.cjs, tests/run.cjs; PROJECT_MAP.md and PROGRESS.md. Existing changes retained.

Actual validation: node tests/run.cjs passed the incremental-output build and all 80 tests using approved installed dependency access. New tests cover all offered grids, rounding/collision fallback across pitches, existing polyphony, preserving/reporting zero-length cases and their neighbors, Instructions isolation, scope-end bounds, volume/data preservation, idempotence, actual simulated menu handlers, refreshed MML counts and undo. No native UI or in-game check was performed for this patch.

Working folder and generated outputs updated. Transfer patch: mml-studio-simplify-timing-patch.zip. Apply over the current optimizer version and restart the editor. Next: user trials with imported timing and dense short-note passages.

## Tools: Remove overlap — 2026-09-07

Added Remove overlap as the second Tools action. For all notes of the selected musical instrument, each held note ends at the next later onset of the exact same pitch when that onset precedes its original end. Nested/chained overlaps are handled independently by pitch, with exact integer timing and no grid snapping. Different octaves, pitches and instruments are independent. Touching endpoints and gaps stay unchanged. Simultaneous same-pitch duplicates are kept and reported because cutting at their shared start would create zero-length notes; each can still be shortened at the next distinct onset. Silent Instructions are untouched.

The standard commit path provides one undo step and refreshes MML, counts and limits. No-op runs create no history entry. Volume values, tempo metadata, IDs and starts remain unchanged. In Song/Segment views only the viewed portion changes; parent note fragments outside both boundaries survive. Playback retains the existing musical-edit snapshot behavior until Stop/Play. Version-2 JSON unchanged.

Changed: new src/music/remove-overlap.ts and dist/music/remove-overlap.js; src/tools.ts and dist/tools.js; index.html; new tests/remove-overlap.test.mjs, tests/renderer.test.cjs, tests/run.cjs; PROJECT_MAP.md and PROGRESS.md. Existing workspace changes preserved.

Actual validation: node tests/run.cjs passed the incremental-output build and all 83 tests with approved installed dependency access. New coverage checks nested/chained overlaps, exact non-grid cuts, pitch/octave/instrument isolation, touching/gapped notes, duplicate onsets, immutability/volume retention, scoped outside-fragment preservation, simulated menu handlers, count refresh, no-op history and Undo. No native UI or in-game check performed.

Working folder and generated outputs updated. Transfer patch: mml-studio-remove-overlap-patch.zip. Apply over the Simplify Timing version and restart the editor.

## Header time-signature edits align to measures — 2026-09-07

The top Time Signature field now writes at timeline tick zero when the current project/view has no signature instructions. Otherwise it writes at the start of the measure containing the position captured when the field gained focus. The pure signatureChangeTick helper follows the same signature and named Song-reset anchors as the ruler; ordinary Segment markers do not reset measures. Future signature markers also count as existing instructions, so preceding default 4/4 measures are respected. Existing Instructions at the target are updated rather than creating an exact-playhead marker. The existing inspector still supports exact-position instruction edits.

Undo, validation and scoped-view behavior remain on their existing paths. No source note timing, volumes or version-2 format changes. Updated the field tooltip to explain placement.

Changed: src/music/structure.ts, src/toolbar.ts and their two incremental dist outputs; index.html; tests/structure.test.mjs and tests/renderer.test.cjs; PROGRESS.md. Existing workspace changes retained.

Actual validation: node tests/run.cjs passed the incremental-output build and all 84 tests using approved installed dependency access. Added coverage for no-signature initialization away from zero, future signatures, changed meters, Song resets, non-reset Segments, exact measure edges, ruler agreement, simulated header edits at measure start, stable focus position while the playhead moves, replacement of the initial signature and Undo. No native UI check performed.

Working folder updated. Transfer patch: mml-studio-signature-measure-patch.zip. Apply over the current Remove overlap version and restart the editor.

## Clean Windows staging and portable release build — 2026-09-07

Replaced the broad electron-packager batch command with build.bat plus package-release.ps1. The batch anchors to its own directory, checks installed prerequisites, runs the incremental-output compiler, stops on errors, and calls the packaging helper. No new npm dependency/download is needed: the helper verifies and copies the installed Electron 37.0.0 Windows x64 runtime and renames its executable to MML Music Studio.exe.

Staging uses explicit runtime file/asset/vendor lists and derives compiled module paths from current source to avoid shipping stale dist files. It writes a minimal runtime package.json without npm dependencies or build scripts. Output: staging/app and releases/MML Music Studio-win32-x64/resources/app. The portable release retains Electron DLLs/locales/notices and app/audio/SoundFont licenses. Source files, tests, project documentation, scripts, node_modules, packages, archives and validation scratch data do not ship. The installer/signing/executable metadata customization are outside this portable-copy workflow.

Rebuilds clean only the two exact generated directories after absolute-path and reparse-point checks. Sources are copied, never moved. Other releases and the existing release directory are retained. Optional -StageOnly supports payload inspection. Added staging/ and releases/ to .gitignore, retained release/, and removed the old build.bat ignore rule so build scripts are trackable.

Changed: build.bat, new package-release.ps1, .gitignore, README.md, PROJECT_MAP.md, PROGRESS.md; new tests/release.test.cjs and tests/electron-release.cjs. No application source changed.

Actual validation: ran build.bat end to end with approved compiler dependency access; incremental build passed and produced an 81-file app payload. Injected stale documentation into both output app folders, rebuilt via the helper, and verified those stale files disappeared. node --test tests/release.test.cjs passes exact staging/release file and byte equality, excluded development content, minimal manifest, assets/vendor/license coverage and Electron runtime presence. git check-ignore confirms generated folders ignored and scripts not ignored (the latter correctly returns status 1). Native tests/electron-release.cjs passes using the installed identical Electron runtime to load the packaged main/preload/renderer, SoundFont IPC and actual AudioWorklet/synth initialization; evidence .validation/electron-release.json. This checks packaged assets, not installer behavior or physical-speaker output. No unrelated musical regression rerun was needed for these packaging-only changes.

Release generated locally at releases/MML Music Studio-win32-x64. Build-script transfer patch: mml-studio-clean-build-patch.zip. Run build.bat after npm ci to regenerate the portable release.

## Automatic release ZIP — 2026-09-07

Full package-release.ps1 runs now create releases/MML Music Studio-win32-x64.zip with the enclosing application folder and all Electron runtime files. Compression writes to a temporary archive first, then replaces the previous ZIP only after success; the temporary file is cleaned on failure. Existing output archive directories/links are rejected. StageOnly remains staging-only. build.bat prints the ZIP path, README explains distribution/extraction, and existing releases/ plus *.zip ignore rules already cover the output.

Changed: package-release.ps1, build.bat, README.md, PROGRESS.md. Validation: build.bat completed the incremental build, portable packaging and ZIP creation. All 153 archived files matched their release files by SHA256, with correct enclosing folder and matching file count. Existing node --test tests/release.test.cjs passed. No native UI rerun was needed for archive-only packaging changes.

Generated release archive: releases/MML Music Studio-win32-x64.zip. Script transfer patch: mml-studio-auto-zip-patch.zip.

## Piano-roll sharp backgrounds and C guides — 2026-09-07

Reduced sharp-key and sharp-row painted backgrounds to 14 pixels, centered within the existing 20-pixel pitch rows. Added a low-opacity theme-specific blue tint across C rows and their piano keys. Natural-key height, pitch spacing and editing alignment remain unchanged. Per user clarification, no note drawing, geometry, hit testing or project/music data was changed.

Changed: src/appearance.ts, src/rendering/grid.ts, src/rendering/keyboard.ts and their three incremental dist outputs; PROGRESS.md.

Actual validation: node tests/run.cjs passed the incremental-output build and all 84 existing tests. Captured and inspected native Electron screenshots with C/sharp/natural note examples in Sky and Night; labels, centered bands and restrained octave tint are readable. Evidence: .validation/keyboard-sky.png and .validation/keyboard-night.png, captured with .validation/keyboard-preview.cjs. The prior saved theme/workspace preference was restored after capture.

Working source and generated outputs updated. Transfer patch: mml-studio-piano-background-patch.zip. Restart the source editor, or run build.bat again to refresh the portable release and its ZIP.

## Uneven piano-roll rows: sharps at 75% height — 2026-09-07

Corrected the previous inset-background treatment per the user's screenshot: the actual sharp pitch rows now occupy 15 pixels, while natural rows occupy 20 pixels. The entire vertical layout is uneven (215 pixels per octave). Black keys and sharp backgrounds fill their shorter rows, without artificial light padding. The subtle blue C-row guide remains.

Added a shared DOM-free pitch-layout mapping with periodic coordinates and inverse hit lookup, including negative/above-MIDI pitches. Keyboard/grid painting, note centers, pointer hit testing, vertical dragging, scroll extent, top-range expansion, startup/import/instruction-lane scrolling all use it. Note blocks retain the existing 14-pixel height and horizontal sizes; only their centers follow the new rows. Notes/volumes/durations/pitches in project data remain unchanged by the layout update. Adjacent-row hit testing cannot steal a note from the neighboring sharp row.

Changed source: new src/music/pitch-layout.ts; src/geometry.ts, src/viewport.ts, src/rendering/grid.ts, src/rendering/keyboard.ts, src/files.ts, src/instruments.ts, src/renderer.ts, src/pointer.ts; corresponding nine dist outputs. Tests: new tests/pitch-layout.test.mjs and tests/electron-pitch-layout.cjs; tests/renderer.test.cjs, tests/run.cjs; coordinate maintenance in tests/electron-ui.cjs, tests/electron-behavior.cjs, tests/electron-structure.cjs, tests/electron-segment-view.cjs and tests/electron-smoke.cjs. Docs: PROJECT_MAP.md, PROGRESS.md.

Actual validation: node tests/run.cjs passed the incremental-output build and all 85 tests. Coverage includes exact boundaries and inverse mapping across negative/MIDI/high pitches, 75% heights and octave sums, simulated note creation on every pitch in an octave, unchanged note height, selection and dragging across sharp/natural rows. Updated legacy fixed-coordinate expectations and native harness pitch coordinates. All six affected/new native test scripts pass node --check. Focused tests/electron-pitch-layout.cjs passes real native mouse creation of C/C-sharp and dragging C-sharp to D with exact pitch/time and unchanged note heights; evidence .validation/electron-pitch-layout.json/.png. Captured and inspected Sky/Night screenshots: .validation/uneven-keyboard-sky.png and .validation/uneven-keyboard-night.png. Broader tests/electron-ui.cjs stops before pitch checks on its pre-existing unrelated assertion that the Undo button background must not be transparent; that styling was not changed. Other native suites received coordinate updates but were not rerun.

Working source and generated output updated. Transfer patch: mml-studio-uneven-pitch-rows-patch.zip. Run build.bat to regenerate the portable release and ZIP with this layout.

## Embed the blue note-M executable icon — 2026-09-07

package-release.ps1 now embeds assets/logo.ico into the copied release executable before creating its ZIP. New build-only build-icon.cs uses Windows resource-update APIs to replace existing icon groups in all their existing languages with the studio icon images, preserving other resource types. It validates the ICO and fails the build on errors. The installed node_modules Electron executable is untouched. No package download is required, and the helper does not ship in resources/app. The window continues using the matching assets/logo.png.

Changed: package-release.ps1, new build-icon.cs, tests/release.test.cjs, README.md, PROJECT_MAP.md, PROGRESS.md. Regenerated local staging/release and releases/MML Music Studio-win32-x64.zip (now also containing the latest uneven-row renderer).

Actual validation: build.bat passed incremental compilation, resource embedding, packaging and ZIP creation. Both tests/release.test.cjs tests pass, including PE signature and exact ICO payload presence. Extracted the EXE's associated icon via Windows/System.Drawing and inspected the blue note-M at .validation/executable-icon.png. The ZIP's EXE SHA256 matches the verified release EXE. No new native app launch was performed for this resource-only update. API reference: https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-updateresourcew

Release ZIP updated locally. Build-script transfer patch: mml-studio-executable-icon-patch.zip. Future build.bat runs embed the icon automatically.

## Full-cell note blocks with darkened borders — 2026-09-07

Note rectangles now fill their full pitch-row height (20px natural, 15px sharp) and their complete displayed duration width. Removed the old vertical and horizontal inset. A 3px inside border slightly darkens each instrument color, retaining the existing sharp-note tint. Extremely narrow notes reduce border thickness to fit. The blue selection stroke stays clipped inside the note so neighboring rows remain clear. Project timing, pitches, volumes and MML are unchanged.

Changed: src/geometry.ts, src/rendering/notes.ts and their two incremental dist outputs; tests/renderer.test.cjs and tests/electron-pitch-layout.cjs updated for full-cell geometry; PROGRESS.md.

Actual validation: node tests/run.cjs passed the incremental-output build and all 85 tests. Native tests/electron-pitch-layout.cjs passed real mouse creation and movement, with new full-height geometry. Inspected Sky and Night screenshots showing natural and sharp notes filling their rows with the darkened outline. Evidence: .validation/electron-pitch-layout.json/.png and refreshed .validation/uneven-keyboard-sky.png/.validation/uneven-keyboard-night.png.

Working source and generated files updated. Transfer patch: mml-studio-full-cell-notes-patch.zip. Run build.bat to refresh the executable release and ZIP.

## Layered note borders and application/window names — 2026-09-07

Full-cell notes now have an outer 1px black edge and 2px of darkened instrument color inside it (3px total). Narrow-note borders still shrink to fit; blue selection remains available. No timing or musical data changes.

The main window title follows MML Music Studio - Project Name on initial load, rename, refresh/open/import/new and undo/redo. Electron application name and AppUserModelID are set explicitly. The prior userData path is retained when setting the app name, preserving saved preferences. Packaged EXE version resources now identify FileDescription/ProductName/InternalName as MML Music Studio, OriginalFilename as MML Music Studio.exe, and versions from package.json. The original runtime copyright string is retained. The installed development Electron executable is not modified; npm start still runs electron.exe, while releases run MML Music Studio.exe.

Changed: src/rendering/notes.ts, src/commands.ts, src/files.ts and three incremental dist outputs; main.cjs; build-icon.cs; package-release.ps1; tests/renderer.test.cjs and tests/electron-release.cjs; README.md and PROGRESS.md. Regenerated release folder and ZIP.

Actual validation: incremental build and all 85 tests passed after the border/title implementation. Added title rename/Undo/New coverage, then reran renderer and release checks: all 3 passed. build.bat completed metadata/icon embedding and ZIP creation. Windows FileVersionInfo confirms description/product/internal/original filename and version 0.3.0. Native packaged-app harness passes app.getName, actual BrowserWindow title after project rename (MML Music Studio - Blue Moon), startup, SoundFont and AudioWorklet checks. A standalone released-EXE probe confirms Windows ProcessName and description MML Music Studio; its hidden launch exposed no MainWindowTitle, so that probe's title assertion failed, and native title verification relies on the successful Electron harness instead. Evidence: .validation/electron-release.json and .validation/release-process-name.json. The test-launched process was closed.

Release ZIP updated: releases/MML Music Studio-win32-x64.zip. Transfer patch: mml-studio-borders-and-names-patch.zip. Existing releases must be replaced/rebuilt to receive EXE naming metadata.

## Indexed draw culling and lighter note borders — 2026-09-07

The old note renderer rejected off-screen rectangles only after scanning all project notes. Added a per-pitch balanced interval index so scrolling queries only intersecting pitch/time candidates. Held notes starting before the viewport remain visible; fixed-width Instructions account for zoom; original paint order is retained. The index rebuilds on note-array replacement, insertion/deletion count changes or instrument-role changes. Production timing edits use array replacement through commits/gestures. Box-selection previews evaluate only visible candidates while committed selections still include all intended notes.

Removed the black edge and reduced the darkened border to a single inside stroke instead of eight rectangle draws. Note width and height are one pixel smaller than their cells (bottom/right gap; 1px minimum width), retaining 20/15px row spacing and exact musical timing. Tiny notes skip unreadable text, and label contrast colors are cached per color.

Also removed repeated full-song serialization from unchanged density/character-limit overlay redraws. Density uses note identity/count/active-lane invalidation. Sheet-limit signatures are rebuilt only after note identity/count or instrument/limit settings change; scrolling reuses the cached calculation. Updated the density-edit regression to use the actual commit path rather than an unsupported direct in-place timing mutation. Future timing edits must continue replacing the note array, as current editor handlers do.

Changed: new src/music/note-visibility.ts; src/rendering/notes.ts, src/rendering/note-density.ts, src/rendering/sheet-limit.ts, src/geometry.ts; corresponding five dist outputs; new tests/note-visibility.test.mjs, tests/run.cjs, tests/renderer.test.cjs, tests/electron-pitch-layout.cjs; PROJECT_MAP.md, PROGRESS.md.

Actual validation: node tests/run.cjs passed incremental build and all 88 tests. New tests compare indexed queries with brute force over varied pitches/zooms and verify held notes, instruction edges and stable paint order. A 100,000-note fixture returns 7 visible notes with fewer than 150 start-property reads per warm query, instead of a full scan. Existing tests cover edits/undo/scopes/limits/density/selection; native tests/electron-pitch-layout.cjs passes real mouse creation/dragging with 19/14px note heights. build.bat completed executable branding and ZIP generation; both release-content/icon tests passed. This is a verified reduction in rendering work, not a claim that every source of large-project latency has been removed.

Updated release ZIP: releases/MML Music Studio-win32-x64.zip. Transfer patch: mml-studio-draw-culling-patch.zip. Restart with the updated release to load these changes.

## Keep 128th durations explicit in MS2 MML — 2026-09-07

Corrected automatic default-length compaction: MS2 L instructions stop at L64, even though explicit c128 and r128 are valid. The optimizer no longer considers denominators above 64 as default states, so one-unit notes, rests and tied continuations retain their explicit suffix. Legal L64 compaction remains available. Shared generated output feeds channel text, character counts and sheet/export planning. Stored timing, version-2 JSON, grid options and the shared-dialect importer are unchanged.

Changed: src/music/mml-optimizer.ts and dist/music/mml-optimizer.js; tests/mml.test.mjs; MML_GENERATION.md, PROJECT_MAP.md and PROGRESS.md. Existing unrelated workspace changes preserved.

Actual validation: node tests/run.cjs completed the incremental-output build and all 89 tests passed. Initial sandboxed build failed on installed audio dependency directory access; rerunning with approved dependency access succeeded. The independent MML test reader now rejects default lengths above 64. Regression coverage includes repeated 128th notes/rests, mixed L64/128 phrases, tempo-boundary ties, exact generated timing and byte counts, plus exhaustive legal-default cost comparisons. Existing sheet, import and simulated renderer tests passed. No native UI or in-game validation performed.

Transfer patch: mml-studio-explicit-128-patch.zip. Working source/dist updated; run build.bat to regenerate the portable executable release and its ZIP. Next: verify generated short-note passages in MS2 when available.

## Dotted L defaults supported — 2026-09-07

User clarification: L1. is valid and makes an inherited note longer. Extended default-length optimization to distinguish dotted and undotted defaults. Repeated dotted whole notes can now emit l1.ccc; explicit note/rest suffixes override the entire default, and 128 durations remain explicit. L instructions retain the denominator ceiling of 64. The importer already supports dotted L; no import or JSON change needed.

Changed: src/music/mml-optimizer.ts, src/music/mml.ts and both dist outputs; tests/mml.test.mjs and tests/sheets.test.mjs independent decoders; MML_GENERATION.md, PROGRESS.md. PROJECT_MAP.md correction from the preceding patch is included in the combined archive.

Actual validation: node tests/run.cjs passed incremental build and all 90 tests with approved installed dependency access. Added dotted-whole/dotted-64 defaults, explicit undotted/128 overrides, rests, tied tempo changes and generated 192-unit duration coverage. Existing synchronized sheet/export tests pass with dotted-aware independent timing decoding. No native UI or in-game testing performed.

Combined transfer patch: mml-studio-length-defaults-patch.zip (supersedes the explicit-128-only patch). Run build.bat to update the portable release and full release ZIP. Next: in-game playback verification when available.

## Instruction lines, nested loops and translucent regions — 2026-09-07

Instructions now hide Pitch, Length and Volume entirely. Tempo, Time signature, Section and Reset measure remain, with new Loop Entry / Loop Exit flags, conditional Loop Count (Entry only) and Loop Tie (Exit only). Count is total plays, defaults to 1, and accepts positive safe integers. Optional fields preserve version-2 JSON, Undo/Redo and explicit edits reconciled from scoped views. Instructions default to yellow when selected as a preset; existing channel colors drive their lines, captions and backgrounds.

Replaced instruction note blocks with 15-screen-pixel full-height roll lines, painted behind musical notes. Captions below the measure ruler and the lines themselves select the event, including switching from another instrument. Instruction pitches no longer affect viewport pitch bounds, vertical scrolling or line visibility. Completed loop regions paint over the background grid at 10% opacity and under all other roll layers; nested regions accumulate opacity. Unmatched Entries/Exits warn without blocking editing, saving, MML or playback, and complete children inside an unmatched outer loop still work.

New DOM-free music/loops.ts pairs nested global Entry/Exit markers and expands a temporary performance timeline. Original project notes remain unchanged. Repeated clips restore tempo and inherited onset volume, preserve arbitrary integer timing, and shift following material. Exit Loop Tie joins matching instrument/pitch voices one-to-one when the Entry-side note began before Entry or the Exit-side note ends after Exit (the requested A/B/C cases). Exact Entry-start / Exit-end pairs retrigger. Ordinary forward pieces retain continuity. MML/live counts, sheet planning and MIDI playback share expansion; full-loop MML includes trailing rests. Real-time-off MML remains stale until updated. Playback seconds follow expanded time, while the visible playhead returns to source positions on repeats; pause/resume and held-note restoration use the expanded notes. Section-separated exports expand before the existing section slicing; scoped views warn if a partner is outside the view. See LOOPS.md for semantics.

Changed source: new src/music/loops.ts and src/rendering/instructions.ts; src/model/types.ts, src/model/validation.ts, src/model/segment-view.ts; src/music/mml.ts, src/music/sheets.ts; src/playback/midi.ts, src/playback/transport.ts; src/inspector.ts, src/instruments.ts, src/geometry.ts, src/pointer.ts, src/viewport.ts, src/painting.ts, src/export.ts; src/rendering/notes.ts, src/rendering/tempo.ts, src/rendering/sheet-limit.ts; index.html and studio.css; corresponding incremental dist outputs. Tests: new tests/loops.test.mjs and tests/electron-loops.cjs; tests/renderer.test.cjs and tests/run.cjs. Docs: LOOPS.md, PROJECT_MAP.md and PROGRESS.md. Existing unrelated workspace changes retained.

Actual validation: node tests/run.cjs passed the incremental-output build and all 98 tests. Added nested/adjacent/count-one loops, original-data preservation, all tie cases, one-to-one matching, MIDI note-on/off boundary checks, MML reimport timing, trailing silence, tempo/volume restoration, malformed field validation, missing-partner warnings and scoped metadata persistence. Simulated renderer checks cover hidden/conditional fields, edits/Undo, custom colors, exact 15px geometry, layer order, nested alpha, both click targets, frozen/live MML and the looping playhead with pause/resume. Native tests/electron-loops.cjs passes actual mouse selection through lines/captions, computed field visibility and unmatched-loop warning checks. Captured and inspected .validation/electron-loops.png and .validation/electron-loops-night.png; native result .validation/electron-loops.json; warning screenshot .validation/electron-loops-unmatched.png. Tests used isolated native preferences. Initial sandbox build/audio dependency and native GPU startup failures were resolved with approved elevated execution. No physical speaker or in-game MS2 loop verification was performed.

build.bat passed incremental compilation, 85-file runtime staging, executable branding and full portable ZIP generation. Both tests/release.test.cjs checks passed. Updated distribution: releases/MML Music Studio-win32-x64.zip. Extract the complete folder and restart with the updated executable. Next: in-game verification of loop ties and tempo changes when available.

## Behavior audit and confirmed volume/overlap intent — 2026-09-07

User requested testing and a list of suspicious behavior for confirmation. Audited the current working tree without changing production behavior. User confirmed that simultaneous notes must each use their own explicit V, and overlap warnings require the same pitch as well as start and Instrument instance (preset/voice identity is irrelevant). Recorded those requirements in AGENTS.md, PROJECT_MAP.md and BEHAVIOR_AUDIT.md; corrected obsolete overlap rejection/lane-splitting descriptions in README.md and MIDI_IMPORT.md.

Seven reproducible findings are detailed in BEHAVIOR_AUDIT.md: simultaneous V overwrite (confirmed bug); overlap warnings introduced by view/loop clipping; lost inherited volume in Segment views; nested same-pitch MIDI note-offs releasing the wrong voice; silent Piano C-sharp 8 in song playback; unsaved project closing without a prompt (possibly deliberate from the prior close fix); and Segment Return to Project overlapping the transport. Native layout measured a 76.27 by 21.5 pixel intersection at 1304px content width. Decisions beyond the user's confirmed rules remain pending; code/tests alone do not establish intended behavior.

Changed files for this audit: new tests/behavior-audit.mjs, tests/electron-behavior-audit.cjs and BEHAVIOR_AUDIT.md; AGENTS.md, PROJECT_MAP.md, README.md, MIDI_IMPORT.md and PROGRESS.md. No production source changes, no manually edited dist files, no release rebuild. Existing unrelated working changes preserved. Standalone diagnostics intentionally remain outside tests/run.cjs: they compare actual/expected behavior and report differences, rather than endorsing bugs as regression requirements.

Actual validation: node tests/run.cjs passed the incremental-output build and all 98 existing tests. Initial sandboxed audio build failed on installed dependency access; approved rerun succeeded. New diagnostic passed 13 controls and reproduced 12 comparisons covering A1–A5, including correct sequential V ordering, separate same-preset instances, JSON preservation and unchanged parent save from an untouched scope. CPU synthesis with the installed bank confirms wrong nested-note release identity and C-sharp 8 peak PCM 0 against C8 peak 0.03213. Existing native tests/electron-behavior.cjs and tests/electron-segment-view.cjs both passed, covering actual AudioWorklet PCM, transport, view edits, save/export IPC and Undo. New native diagnostic reproduced A1–A3/A6/A7 with programmatic native DOM controls, actual disposable-window close and measured geometry. Screenshots inspected. No physical-speaker listening, actual OS file-picker interaction or in-game testing performed.

Evidence and openable project fixtures: .validation/behavior-audit/; existing native results: .validation/electron-behavior.json and .validation/electron-segment-view.json. Transfer bundle: mml-studio-behavior-audit-2026-09-07.zip (docs, diagnostic scripts and focused evidence; no runtime patch). Next: ask whether findings A2–A7 are intended; record any confirmed exceptions before implementing behavior changes.

## Finding A1 fixed: independent explicit note velocities — 2026-09-08

User requested fixing the audit findings one by one. Confirmed inheritance rule: when several explicit V changes share an onset, unset notes there and afterward inherit the most recently created explicit-V note's value (highest ID). Each explicit note retains its own V. User added that controlling velocities in ambiguous chords is their responsibility; no extra conflict prompt is wanted. Documented the rule in AGENTS.md and the feature docs.

Added shared resolveVolumes in the existing DOM-free music/volume.ts and made volumeAt respect explicit V first. Replaced duplicated onset-group resolution in playback/held-note restoration, MML, loops, sheets, section slicing, Segment projection/reconciliation, merge/split/Drumkit operations and copying. V13/V5 chords now emit velocities 110/42 and retain V13/V5 in separate MML channels, even when IDs or array order differ. Unset inheritance and explicit V0 work consistently. Removed obsolete MML import and merge/split warnings claiming simultaneous volumes must collapse. Existing merge/split result shape retains volumeConflict:false. Version-2 data remains unchanged; import/editing/export limits were not altered.

Changed source (11): src/music/volume.ts, src/music/mml.ts, src/music/loops.ts, src/music/sheets.ts, src/music/structure.ts, src/model/segment-view.ts, src/model/instrument-operations.ts, src/playback/midi.ts, src/note-clipboard.ts, src/instrument-actions.ts, src/import/mml.ts; corresponding 11 dist outputs generated incrementally. Tests: new tests/volume.test.mjs and tests/electron-volume.cjs; tests/run.cjs, tests/renderer.test.cjs, tests/playback.test.mjs, tests/instrument-operations.test.mjs. Docs: AGENTS.md, BEHAVIOR_AUDIT.md, PROJECT_MAP.md, README.md, MIDI_IMPORT.md, MML_IMPORT.md, MML_GENERATION.md, PROGRESS.md. Prior unrelated working changes retained.

Actual validation: four initial focused tests reproduced the old failure before implementation. Final node tests/run.cjs passed incremental-output build and all 104 tests with approved installed dependency access. Six volume regressions cover V0–V15, reordered IDs, unset inheritance/ties, MML import, held restoration, clipped/repeated notes, sheet cuts and instrument operations. Simulated renderer checks cover inspector edits, copy/paste and Undo; existing regression expectation that a held V5 note becomes V9 was corrected. Native tests/electron-volume.cjs passes actual Electron DOM inspector/edit/Undo/clipboard and compiler velocity checks; inspected .validation/electron-volume.png, result .validation/electron-volume.json. No physical-speaker or in-game test. Standalone behavior-audit.mjs now reports zero A1 mismatches while the A2–A5 cases still reproduce. Final suite log: .validation/volume-tests.log. An unrestricted diff whitespace check also reports the pre-existing blank EOF in src/instruments.ts and tests/renderer.test.cjs; no unrelated whitespace cleanup was performed.

Working source/dist updated. Transfer patch: mml-studio-explicit-volume-patch.zip. Run build.bat to refresh the portable executable release and full release ZIP; those were not rebuilt in this step. Next: finding A2 — clarify whether artificial simultaneous starts from Segment clipping / untied loop repeats should preserve original-onset identity for overlap warnings. Findings A2–A7 remain pending the requested one-by-one review.

## Finding A2 confirmed intended: warn on clipped/restarted overlaps — 2026-09-08

User confirmed the warning should exist when Segment clipping or untied loop repeats restart held same-pitch notes together in one Instrument: overlapping input is their responsibility and must be warned about, never automatically repaired. Existing runtime behavior already meets this requirement. Retained the non-blocking Instruments warning and all notes; no trimming, deletion, movement, rejection or original-onset exemption was added. The clarification applies to A2, preserving the previously confirmed same-pitch/owner and full-project onset rule.

Changed: AGENTS.md, BEHAVIOR_AUDIT.md (A2 now intended; A3–A7 pending), PROJECT_MAP.md, SEGMENT_VIEW.md, PROGRESS.md; explanatory comment in src/music/note-density.ts and incremental dist/music/note-density.js; tests/note-density.test.mjs; tests/behavior-audit.mjs now treats A2 as two intended controls. Existing source and unrelated work retained.

Actual validation: node tests/run.cjs passed the incremental-output build and all 105 tests with approved dependency access. New regression checks both Segment clips and loop restarts warn, MML retains two channels, playback and JSON serialization succeed, and the original notes remain identical after view reconciliation/generation. Standalone diagnostic passes 15 controls and reports only unresolved A3/A4/A5 mismatches. No native UI or in-game run was needed or performed for this comment/documentation and regression-only step. Log: .validation/overlap-policy-tests.log.

Transfer bundle: mml-studio-overlap-warning-policy.zip (documentation, tests and comment-only source/dist update). No runtime behavior change or release rebuild. Next: finding A3 — confirm inherited V should remain the same when entering a Segment even when the note carrying the latest V ended before the boundary.

## Finding A3 fixed: carry the last velocity into views — 2026-09-08

User confirmed: copy the last Velocity before entering the view; a note needing another value must explicitly set it. projectSegment now gathers the latest explicit pre-boundary V independently for each Instrument (same-onset ties use highest ID). Implicit crossing notes receive that context; explicit crossing notes retain their own V. Onsets whose inheritance was displaced by clipped held notes receive automatic baseline seeds, while later explicit changes govern inheritance normally. V0 and default V8 work. Clearing an explicit V on an edited crossing fragment restores parent inheritance instead of reasserting the old held-note V. No version-2 format change or synthetic musical note was added.

Automatic seeds are not saved to the parent by entering/saving/returning or by unrelated edits. Explicit V edits remain real edits. Changed: src/model/segment-view.ts and incremental dist/model/segment-view.js; tests/segment-view.test.mjs, tests/electron-segment-view.cjs; AGENTS.md, PROJECT_MAP.md, SEGMENT_VIEW.md, BEHAVIOR_AUDIT.md, PROGRESS.md. Prior working changes retained.

Actual validation: two new tests failed against the previous build, then the incremental-output build and all 107 tests passed via node tests/run.cjs with approved dependency access. Expanded pure tests subsequently passed all 8 Segment tests, covering V0/V5, explicit V13 crossing notes, implicit crossings, creation-ID ties, boundary changes, exact parent save, unrelated pitch edits, explicit clearing and new notes before the original first seed. Existing MML/playback/sheet/loop and simulated renderer tests passed. Extended native tests/electron-segment-view.cjs passes real DOM inspector, save/export IPC to isolated files, pitch edit, Undo, Return and existing view regressions. Initial native addition redeclared a top-level test variable; wrapped that declaration and the rerun passed. Screenshot .validation/electron-segment-velocity.png inspected; result .validation/electron-segment-view.json; full-suite log .validation/segment-velocity-tests.log. Standalone diagnostic passes 15 controls and now reports only A4/A5 mismatches. No physical-speaker, actual OS picker or in-game check performed.

Working source/dist updated. Transfer patch: mml-studio-segment-velocity-patch.zip. Run build.bat to refresh the portable release; release packaging was not rerun here. Next: finding A4 — ask whether preview must honor each original duration for nested same-pitch notes even when their overlap is user error. A4–A7 remain pending one-by-one review.

## Finding A4 fixed: honor every original note duration — 2026-09-08

User confirmed the long and short notes belong in separate MML Channels and preview must honor the original note. Extracted the existing MML min-heap interval partition into DOM-free src/music/channels.ts and reused it for playback. Every overlapping voice receives an isolated MIDI route, including drum voices on separate channel-10 ports. Per-Instrument V inheritance is resolved before partitioning. Held-note restoration now routes by note ID; existing mute/solo loops already apply to all routes belonging to the Instrument. Presets are emitted for every route. Exact source timing, loop expansion, overlap warnings and version-2 project JSON are preserved. The existing MIDI port representability error now describes channels rather than instrument count.

Changed: new src/music/channels.ts and dist/music/channels.js; src/music/mml.ts, src/playback/midi.ts and their incremental dist outputs; tests/playback.test.mjs, tests/renderer.test.cjs, tests/electron-behavior.cjs, tests/behavior-audit.mjs; AGENTS.md, MML_GENERATION.md, PROJECT_MAP.md, BEHAVIOR_AUDIT.md and PROGRESS.md. Existing unrelated changes retained.

Actual validation: node tests/run.cjs completed the incremental-output build and all 109 tests passed with approved installed dependency access. Added actual bundled-synth voice-identity checks at the short and long note ends, exact MIDI on/off/velocity assertions, seek routing, 17 simultaneous melodic/drum routes, preset propagation, channel reuse and unchanged project data. Extended simulated renderer verifies mute/solo on every derived channel. Native tests/electron-behavior.cjs passes with two overlapping same-pitch notes through AudioWorklet section seek, live/paused voice changes, rewind, speed and master gain. Standalone audit passes 15 controls and A4; only A5 remains a diagnostic mismatch. Logs: .validation/note-duration-tests.log, .validation/note-duration-audit.log; native result .validation/electron-behavior.json. No physical-speaker or in-game testing performed.

Working source/dist updated. Transfer patch: mml-studio-note-duration-patch.zip. Portable release was not rebuilt; run build.bat to refresh it. Next: ask whether A5 song playback should use the keyboard preview's high-note fallback. A5–A7 remain pending one-by-one review.

## Finding A5 fixed: full melodic range and MS2 accidental boundaries — 2026-09-08

User confirmed C0–B8 must sound, with B-1/C9 legal via o0c-/o8b+. Both + and - are semitone offsets on every letter. Final clarification: GUI labels use #, importing accepts # as an alias, and generated MML never uses #. Preserved the original GUI labels and import alias. Generator now spells the boundary pitches within O0–O8; optimizer accepts minus accidentals without losing lengths or ties. No import clamp, model pitch rewrite or version-2 schema change.

Added shared sample-pitch fallback for keyboard/song playback. Dry synthesis exposed high, low and interior silent preset ranges. The helper chooses an audible octave-equivalent source from the same GM preset. Fixed tuning groups isolate release tails, use shared monophonic allocation and retain owner mute/solo/presets. Held restoration uses the same sample and tuning. RPN wheel sensitivity and pitch wheel precede note-ons; measured 127/128 synth scaling and whole-cent truncation are compensated. Drum mapping is unchanged.

Changed: new src/playback/sample-pitch.ts and dist/playback/sample-pitch.js; src/playback/midi.ts, src/playback/engine.ts, src/music/mml.ts, src/music/mml-optimizer.ts and their four incremental dist outputs. Tests: tests/playback.test.mjs, tests/preview.test.cjs, tests/mml-import.test.mjs, tests/electron-behavior.cjs, tests/behavior-audit.mjs. Docs: AGENTS.md, PROJECT_MAP.md, MML_GENERATION.md, MML_IMPORT.md, PLAYBACK_UPDATE.md, BEHAVIOR_AUDIT.md, PROGRESS.md. Temporary GUI/split notation edits were undone following clarification; existing unrelated changes retained.

Actual validation: final node tests/run.cjs completed incremental build and all 112 tests passed with approved dependency access. 42,240 actual dry-synth cases cover 128 melodic presets × MIDI11–120 × V1/V8/V15. Tests cover actual octave frequency ratios, fixed tuning routes/controllers, velocities/note ends/seek restoration and original project preservation; all +/- spellings across O0–O8, import # normalization and boundary ties round-trip. Initial test iterations caught missing fake-engine module wiring, a typed-array comparison, and pitch-wheel scaling/truncation; these were corrected. Native tests/electron-behavior.cjs passes with overlapping C#8 notes through section seek, live/paused voices, rewind, speed/master gain and separate keyboard preview with the C#8 GUI label. Original diagnostic now passes 15 controls and all A1–A5 comparisons; A6/A7 are separate pending native/UI findings. Logs: .validation/pitch-range-tests.log, .validation/pitch-range-audit.log; native .validation/electron-behavior.json. No physical-speaker or in-game verification.

Transfer patch: mml-studio-pitch-range-patch.zip. Working source/dist updated; portable release not rebuilt, run build.bat to refresh it. Next: ask whether A6 closing unsaved work should offer Save / Discard / Cancel. A6–A7 remain pending one-by-one review.

## Findings A6 and A7 fixed; audit review complete — 2026-09-08

User approved Save / Discard / Cancel on closing unsaved work, and specified a Segment-only Return to Project button below the measure bar at the right, directly beneath Time signature. Implemented the native close request/response handshake in main/preload and the existing files owner. Repeated X clicks coalesce; only the owning renderer can approve closing. Clean projects close directly; Cancel, cancelled/failed Save and edits occurring while a save is pending retain the window. Shared saveProject captures the snapshot actually written, preventing a later edit from being marked saved. Scoped saves still write the reconciled full project. No beforeunload cancellation was added, preserving close-after-import behavior.

Moved Return to Project from the header into a fixed overlay 6px below the 30px measure ruler, with its right edge aligned under Time signature. It is visible only when the scope kind is Segment. Song View has a File-menu return command so it remains navigable; neither appears in the root project. Scoped names sit beneath the project field and shrink within their header column. A small roll-surface wrapper anchors the control outside the scrolling canvas. No project-format change.

Changed: main.cjs, preload.cjs, src/files.ts, src/segment-view.ts and both generated dist outputs; index.html and studio.css. Tests: new tests/electron-close.cjs; tests/electron-segment-view.cjs and tests/electron-release.cjs (isolated release-test profile). Docs: AGENTS.md, PROJECT_MAP.md, SEGMENT_VIEW.md, BEHAVIOR_AUDIT.md and PROGRESS.md. Existing unrelated changes retained.

Actual validation: node tests/run.cjs passed incremental build and all 112 tests. Five native close cases pass: save, clean, discard, quit and import. They exercise actual BrowserWindow close/app.quit, IPC and isolated filesystem saves with OS dialogs stubbed; coverage includes repeated X, Cancel, cancelled Save, failed write, edits during Save, and boundary-preserving full-project Save from Segment View. Extended native Segment tests pass real mouse Return, Song-menu Return, root/Segment/Song visibility, scrolling, full save/export/Undo and geometry at 1320px/900px. Default button coordinates are 36px below the canvas top and right=1045px, matching the meter; at 900px right=625px, also matching. Header labels do not intersect transport. Initial narrow-width checks exposed a remaining label collision; column layout fixed it. Tests were adjusted to distinguish Song/Segment-only visibility. Sky and Night screenshots inspected; the Night capture waits for repaint. No physical-speaker or in-game validation.

Evidence: .validation/close-layout-tests.log; .validation/electron-close-{save,clean,discard,quit,import}.json; .validation/electron-segment-view.json; .validation/electron-segment-view.png, .validation/electron-segment-return-900.png and .validation/electron-segment-return-night.png.

build.bat passed incremental compilation, guarded staging of 87 runtime files, executable branding and full ZIP creation. Both release content/icon tests pass, and tests/electron-release.cjs passes packaged renderer/audio startup under an isolated profile. Build log: .validation/audit-release-build.log; packaged result: .validation/electron-release.json. Refreshed releases/MML Music Studio-win32-x64.zip includes all A1–A7 fixes, so earlier patch ZIPs are not required when installing this release. Focused source/runtime patch: mml-studio-close-layout-patch.zip. All seven audit findings are reviewed: A2 is documented intended behavior, the other six are fixed. No unanswered findings remain from this audit.

## The section-export checkbox explains itself — 2026-09-08

In the Export panel's Options section, Character limit carried a hint and "Export sections as separate song sheets" carried none, so the only option with a consequence worth knowing was the silent one. It now has the same kind of line beneath it: the export is cut at every section name in Instructions, one numbered file per section, and nothing changes when no section names exist. That last clause matters because the checkbox stays checkable in a project with no markers, where `exportSegments` falls back to a single unnamed segment.

The hint fades with the checkbox when a Segment disables it, which the existing `.export-check:has(input:disabled)` rule did not reach.

Changed: index.html, studio.css. Actual validation: incremental build, node tests/run.cjs 112 passing, and an Electron probe of the rendered hint: 7px below the checkbox, left edge equal to the first hint's, 11px clear of both panel edges, 47px over three lines at 10px in the secondary colour.

## The sheet limit moves beside the roll, and Export becomes a dialog — 2026-09-08

Character limit sat in the Export dropdown, but it is not an export decision: it draws the red cut line on the roll and you watch it while writing. It now occupies the caption strip, in place of the decorative "PIANO ROLL" title, which named the area and did nothing else. The field is styled like the time-signature field beside it and keeps the old explanation as its tooltip. Below 1000px the word is dropped and the number box remains, the way the project name already behaves.

Measured before and after at four widths: identical single-row caption at 1400, 1100 and 1000px. At 900px the strip already wrapped before this change (56px tall), and now wraps 10px lower because a 24px field is taller than a text label; the toolbar already overflows at that width.

Export is no longer a dropdown. It is a button opening a modal dialog that asks how to export: a Format list, the section option with its explanation, then Cancel / Selected instrument / All instruments. One format exists today, MS2MML, and the list is a row per format so adding one adds a row. Measured at 560x410 inside the viewport with its backdrop, Cancel closing it, and the character-limit dialog still opening on top when a sheet runs long.

The divider-drag check in tests/electron-ui.cjs failed about one run in four: a single synthetic mouseMove is sometimes swallowed between the pointer capture and the first handler run, and resending the same coordinate is coalesced away rather than dispatched. Each retry now nudges one pixel, so it is a real move. Six consecutive runs clean.

Two Electron files fail for reasons that predate this work, both verified on a clean tree at b8d7c93: electron-behavior-audit needs fixture JSON under .validation/behavior-audit that the repository does not carry, and electron-timeline reads a canvas pixel expecting the unbound-tempo yellow 244,211,94 and finds 207,203,148.

Changed: index.html, studio.css, themes.css, src/export.ts, src/chrome.ts and their dist outputs. Tests: electron-ui, electron-dialog-focus, electron-segment-view, electron-structure follow the dialog instead of the dropdown; renderer.test.cjs stubs it. Actual validation: incremental build, node tests/run.cjs 112 passing, Electron probes of the caption at four widths and of the dialog geometry, and every Electron file except the two named above.

## Three more export formats, a themed colour picker, and a caption that stops repeating itself — 2026-09-08

The Export dialog now offers four formats, each a row that says what it writes: the MS2MML sheet as before, plain MML text as a .txt, a copy straight to the clipboard, and a MIDI file. The two buttons keep their old job of choosing how much to write. MIDI carries the whole performance including tempo changes, so the character limit does not apply to it; the sheet formats share the planner, the limit and its parts prompt. Text and clipboard separate channels with a blank line, because a channel is what you paste in game, one at a time.

Three IPC handlers were added for this: export-text, export-midi and copy-text. copy-text only answers the editor window, as mml-copy only answers the MML window.

The caption strip no longer names the selected instrument. The instruments panel already shows it, selected, coloured and named, so the label repeated what was two centimetres away.

The colour control was an input[type=color], which opens Chromium's colour dialog: an operating-system window that page CSS cannot reach, so it always looked like it belonged to another program. It is now a rounded swatch opening an in-app panel of twelve colours, the six the project already assigns to new instruments plus six in the same family. A colour arriving from an imported project is kept and shown alongside them, so opening the panel can never lose it. The panel closes on a pick, on Escape, on a click outside, and whenever the instruments list rebuilds under it.

An earlier attempt to verify this failed silently and is worth recording: the probe replaced window.files.exportMml with a stub, but contextBridge objects are frozen, so the assignment did nothing, the real save dialog opened, and every export hung on a native window that was never answered. Stubbing dialog.showSaveDialog in the main process instead exercises the actual IPC path, which is what tests/electron-sheets.cjs already does.

New: tests/electron-export-formats.cjs, covering all four formats through the real handlers, the file that each writes, the clipboard matching the text file, the MThd header on the MIDI, and the colour panel's palette, marking, rounding and three ways of closing. Three consecutive runs clean.

Changed: index.html, studio.css, themes.css, main.cjs, preload.cjs, src/export.ts, src/instruments.ts, new src/color-picker.ts, and their dist outputs. Tests: electron-ui follows the selection through the instrument cards now that the caption label is gone. Actual validation: incremental build, node tests/run.cjs 112 passing, the new native test, and the whole Electron sweep. Failing for reasons that predate this work: electron-timeline (a canvas pixel, verified identical on a clean tree at b8d7c93), electron-behavior-audit (fixture JSON the repository does not carry) and electron-release (needs a packaged build). electron-behavior is timing-flaky on a 100ms playback tick and passed three reruns.

## The key column can look like a piano — 2026-09-08

A toggle in the editor toolbar switches the key column between note names and a piano. The pitch rows were already keyboard-shaped, naturals 20px and sharps 15px from src/music/pitch-layout.ts, so the piano needed different paint rather than a different layout: one white surface, black keys covering the back 38 of the 62px column, the boundary between two white keys drawn through the middle of the black key that separates them, and E|F and B|C meeting at the row edge as they do on an instrument. Only the Cs are labelled; naming every key turns the keyboard back into the list it replaced.

Nothing but drawKeyboard changed. Pitch rows, hit testing, previews and note geometry are shared by both views, verified natively: the same click still previews the same pitch with the piano showing. The choice is stored with the workspace next to the theme and the panel widths. Both themes carry the four new palette entries.

The larger half of the request, flipping the editor so the keyboard sits at the bottom and notes fall from above, was measured and declined. The mapping of x to time is written into 13 source modules and 10 test files, and it governs drawing, the ruler, the playhead, the sheet-cut line, loop regions and every pointer gesture, so a vertical mode is a second editor rather than a view. The site that inspired it is a player, not an editor. If the effect is still wanted, a playback-only falling view costs a fraction of that because it never has to accept a gesture.

The button uses its own class rather than .panel-toggle, which names the pair of side-panel toggles that electron-ui counts.

The divider-drag helper in tests/electron-ui.cjs was hardened again. Nudging each resend by a pixel took it from failing about one run in four to about one in ten; the residue was a press that produced no movement at all, which left nothing to poll for. It now lets go and presses again, up to three times. Eight consecutive runs clean.

Changed: index.html, studio.css, src/appearance.ts, src/rendering/keyboard.ts and their dist outputs. Tests: electron-pitch-layout covers the piano view's pixels, its stored setting and the unchanged preview; electron-ui's divider helper. Actual validation: incremental build, node tests/run.cjs 112 passing, and the whole Electron sweep, everything green except electron-timeline, which fails on a canvas pixel identically on a clean tree at b8d7c93.

## A real colour picker, one Export button, and lists that use the room they have — 2026-09-08

The palette-only colour panel was a mistake: replacing Chromium's dialog was right, taking away every colour that is not a preset was not. The panel is now a picker in the editor's style — a shade square, a hue bar and a hex field, so any colour at all is reachable — with the project's twelve instrument colours kept underneath as one-click presets. Dragging commits on release rather than on every frame, so exploring a colour leaves one entry in the history instead of dozens.

Export now asks its question once. The two buttons at the bottom read as two ways of exporting when they were two quantities, and neither looked like the action. Scope moved up into Options as a choice between all instruments and the selected one, and the bottom carries Cancel and a single Export. A line explains what was never written down: each instrument is its own sheet, because a band loads one file per player, which is the same shape the reference site publishes its parts in.

The rule above those buttons had not gone away when the border-top was removed from .export-dialog-actions, because the row was a <footer> and studio.css styles the bare footer tag for the status bar — padding, 10px text and a top border included. It is a <div> now. Measured: border-top 0px, dialog 560x719 inside the window.

Select lists were capped at 300px regardless of the space beside them. The cap is gone: in a default window the instrument list shows 16 presets instead of 9, and it still shrinks to fit, 305px in a 600px-tall window, always inside the viewport.

The simulated DOM in tests/renderer.test.cjs gained a dataset, which the swatch uses to carry its current colour.

Changed: index.html, studio.css, src/appearance.ts, src/color-picker.ts, src/export.ts and their dist outputs. Tests: electron-export-formats covers the picker's square, bar and hex field and proves a colour outside the presets is reachable both by typing and by dragging; electron-sheets, electron-segment-view, electron-structure and renderer.test.cjs drive the single button with a scope radio. Actual validation: incremental build, node tests/run.cjs 112 passing, Electron probes of the list heights and the dialog, and the full Electron sweep, green except electron-timeline, which fails identically on a clean tree at b8d7c93.

Note for the picker's tests: a synthetic PointerEvent carries no real pointer id, so setPointerCapture rejects it and a dragged control never moves. The drag is driven with sendInputEvent instead.

## The clipboard format leaves Export — 2026-09-08

Copy MML to the clipboard was a worse copy of something the editor already had. In game a score has separate fields for the melody and each chord, so what you paste is one channel; the export joined every channel into one block, which fits no field, and with all instruments selected it joined the whole band. The MML window in Instrument actions already copies exactly one channel, chosen from a tab per channel, which is the shape the game wants. The format is gone, and with it the copy-text IPC handler and its preload binding; the MML window keeps its own mml-copy channel.

Export now writes files only: MS2MML, MML text, MIDI.

tests/electron-export-formats.cjs occasionally timed out on a frame wait, but only when run straight after another Electron test: an unpainted window starves requestAnimationFrame, so the promise never settled. The wait now resolves on the frame or after 150ms, whichever comes first. Three passes of electron-ui followed by this file are clean, and so is the full sweep.

Changed: index.html, main.cjs, preload.cjs, src/export.ts and its dist output. Tests: electron-export-formats drops the clipboard assertions and checks the text file's contents directly. Actual validation: incremental build, node tests/run.cjs 112 passing, and every Electron file passing.

## The strip beside the roll, and a theme menu that shows its choice — 2026-09-08

Closing a side panel left a 6px column behind: fit() wrote the grid as `${l}px 6px minmax(0,1fr) 6px ${r}px`, so the divider kept its track even at zero panel width. The divider columns are 0 when their panel is closed. Measured with both panels shut: the canvas starts at x=0 and the editor reaches the window's full 1304px, where before the roll began at 6.

A closed divider still has to be grabbable, or dragging a panel back out would be gone. It keeps an 8px hit strip over the edge of the roll through a transparent ::before, and needs z-index to get it: the canvas is painted later and was swallowing the press, which the first attempt proved by hit-testing to the canvas at x=1. Verified natively: the press at x=1 now starts a resize and the drag reopens the panel to 240px.

The theme menu set aria-current on the active option and no rule ever painted it, so neither Sky nor Night looked chosen. The current option is now accent-coloured with a dot at the end of its row; measured before and after switching, the mark follows the choice.

Changed: src/appearance.ts, studio.css and the dist output. Tests: electron-ui's dividerBox falls back to the hit strip's width when the divider itself has none. Actual validation: incremental build, node tests/run.cjs 112 passing, an Electron probe of the closed layout, the collapsed drag and the theme marking, and the full Electron sweep. electron-timeline still fails on its canvas pixel, 207,203,148 where it expects the unbound-tempo yellow 244,211,94; it passed once in an earlier sweep today and fails on both reruns now, so it is intermittent as well as pre-existing, and it failed identically on a clean tree at b8d7c93.

## The toolbar puts the modes in the middle — 2026-09-08

The editor toolbar is a three-column grid now: a left group with the panel toggle, the playback settings and Grid; Draw, Select and Spray centred; the history actions and the right panel toggle at the end. Measured at two window widths, the tool group's centre matches the toolbar's exactly, 667 and 565, with nothing overflowing.

Zoom and the keyboard toggle moved down into the caption strip, which is now where the view settings live: keyboard style, character limit, zoom. Both belong beside the roll they act on rather than among the editing commands. The strip stays one row down to about 1085px of window; below 1200px the words "Character limit" and "Zoom" drop and leave their controls, and the gap between items went from 14 to 12 to buy back the two pixels that were making it wrap at 1100.

Mute and Solo were sized to their text; they share the card's width at 34px tall now.

Changed: index.html, studio.css. Actual validation: incremental build, node tests/run.cjs 112 passing, tests/electron-ui.cjs, and an Electron probe of the toolbar centring and the caption strip's contents at three widths. electron-ui failed its Undo-hold check on the first run and passed on the rerun; that check has a history of timing flakiness and the failure is unrelated to the layout.

## A refused time signature says so where you typed it — 2026-09-08

Typing a meter the editor would not take looked like the field ignoring you: the value was replaced with the stored one and the reason went to the status bar at the bottom of the window, where it is easy to miss. The typed text now stays on screen in red until the field is left or a valid value replaces it, and the stored meter is untouched meanwhile. The message names both rules instead of only the denominator: 1-32 beats over 1, 2, 4, 8, 16, 32, 64 or 128.

Beats are capped at 32 on entry. There was no upper bound at all, so 21222/4 was accepted and made a measure 679104 ticks long, which takes the bar lines out of the piece entirely and pins every later meter change to tick 0. The cap is on what may be typed, not on what may be read: validSignature still accepts a wider range, so a project already saved with such a value opens instead of being rejected.

Worth recording, because the field's behaviour is easy to misread: what it shows is the meter at the left edge of the visible roll, or at the playhead during playback, while an edit is written at the start of the measure containing that position. Scrolling therefore changes the reading without anything being edited. The time signature stays visual only, as its tooltip says: notes, playback and generated MML never see it.

The simulated DOM had classList.toggle as an empty function and no add, remove or contains; it keeps a real set of names now.

Changed: src/music/structure.ts, src/toolbar.ts, src/inspector.ts, studio.css and their dist outputs. Tests: renderer.test.cjs covers the marked refusal, the beat cap at 32 and 33, and the restore on blur. Actual validation: incremental build, node tests/run.cjs 112 passing, and electron-structure, electron-behavior and electron-segment-view, the three native files that drive signatures.

## Even spacing for the toolbar icons, and a centred readout — 2026-09-08

The three icon buttons had different gaps and two different sizes, which measuring explained: #toggle-left still carried the negative margins that used to pull it against the toolbar edge, and the buttons had no flex-shrink of their own, so in a grid column with min-width 0 they were being squeezed to 25px while the playback button kept 36. They are one .icon-group now, 6px apart, all three measured at 36px with no margins.

The elapsed time and BPM readout sat between two margin-left:auto neighbours, so it landed near the middle by accident and moved whenever a neighbour changed width. The caption strip is a three-column grid like the header: settings on the left, the readout centred, the time signature on the right. Measured with the panels open, with the left panel closed and at 1100 and 900px, the readout's centre matches the strip's exactly every time.

A grid cannot wrap, so the strip would clip instead of falling to two rows. Below 1200px all three words drop and leave their controls: Character limit, Zoom and now Time signature. Nothing overflows at 900px.

Correction to what this entry first said: the strip measured 47px and I put it down to the zoom slider being taller than a text label. That was wrong. The regrouping had left the markup malformed - the right-hand group was opened inside the still-open playback-position span, so the browser recovered by dropping the left group out of the strip and pushing the time signature onto a second row. The strip was rewritten whole rather than spliced, and measures 40px again, three groups in order, the readout centred and the signature 19px from the right edge at every width tested.

Changed: index.html, studio.css. Actual validation: incremental build, node tests/run.cjs 112 passing, tests/electron-ui.cjs, and Electron probes of the icon geometry and of the readout's centring at four layouts.


## Vertical zoom and a reset for both axes — 2026-09-08

The caption now has stacked horizontal and vertical zoom sliders, marked with direction arrows, and a reset button next to Zoom. Vertical zoom ranges from 50% to 300%; Ctrl + wheel over the roll changes it in 10% steps while preserving the pitch position under the pointer. Ordinary wheel scrolling remains available. Reset restores horizontal zoom to 3 pixels per timing unit and vertical zoom to 100%, retaining the top-left musical position where scrolling bounds allow. Zoom is session view state and does not edit the project, history, or version-2 JSON. Zoom changes are ignored during an active pointer gesture.

A small UI geometry adapter scales the pure pitch layout consistently for notes, grid, piano keys, culling, hit testing, dragging, scroll extent, startup and file-open positioning. The caption hides the Character limit label below 1400px and allows its left controls to wrap when space is tight.

Changed: index.html, studio.css, src/state.ts, src/toolbar.ts, new src/pitch-viewport.ts, src/geometry.ts, src/viewport.ts, src/pointer.ts, src/files.ts, src/instruments.ts, src/renderer.ts, src/rendering/grid.ts, src/rendering/keyboard.ts, src/rendering/notes.ts, and their generated dist outputs; tests/renderer.test.cjs, tests/electron-pitch-layout.cjs, PROJECT_MAP.md, PROGRESS.md.

Actual validation: incremental node build.cjs passed; node tests/run.cjs passed all 112 tests, including renderer integration. Native electron-pitch-layout passed wheel anchoring, ordinary wheel handling, scale limits, reset/slider synchronization, unchanged project data, and real sendInputEvent drawing, selection, dragging, edge resizing, and piano preview at horizontal/vertical combinations 1/0.5, 3/1.7, and 8/3. Click coordinates use the base pitch layout multiplied by the current vertical scale. Native electron-ui passed all 19 checks, including 900px and 1320px overflow checks, on rerun; its first run hit the previously recorded Undo-hold timing failure. Captured native screenshot inspected for caption and piano layout. The first sandboxed build failed on esbuild dependency directory access; the authorized build outside the sandbox passed.

Delivery: focused vertical-zoom-patch.zip with changed source, generated modules, tests and notes. No outstanding task-specific work.

## Give the zoom sliders separate click targets — 2026-09-08

The two zoom rows were only 16px apart, putting the enlarged slider thumbs almost on top of one another. Each row is now 28px tall with an 8px gap, giving the slider centres 36px of separation. The inputs have taller hit areas, and H / V labels accompany the direction arrows. The caption grows to accommodate them.

Changed: index.html, studio.css, PROGRESS.md. Actual validation: incremental node build.cjs passed; renderer integration passed; native electron-pitch-layout passed including real drawing, selection, dragging, resizing and piano previews at multiple zoom scales; native electron-ui passed all 19 checks including narrow-window overflow. Inspected the updated native screenshot. Delivery: zoom-spacing-patch.zip. No outstanding work for this adjustment.

## Audio export renders the current performance — 2026-09-08

Export now offers Audio. The native Save dialog offers WAV, MP3, OGG Vorbis, FLAC, M4A/AAC and Opus. All instruments produce one mixed recording; selected-instrument scope records only that instrument with the global tempo clock retained. Audio reads the active project projection, so an open Segment or Song exports only that view. Section-sheet splitting is hidden for audio.

The offline renderer shares compilePlayback, expanded loops, the bundled sound bank and SpessaSynth core with live playback. It keeps exact note lifetimes and encoded MIDI tempo scheduling, leading/trailing rests, drum mappings, velocities and pitch fallback. It respects snapshotted playback speed/master volume and Instrument mute/solo state. Confirmed to the user during implementation: muted instruments are silent in the recording. Natural release/reverb follows the final note-off; an exceptionally long tail is stopped at 30 seconds and reported, without truncating the musical timeline.

A worker streams PCM into the bundled encoder without blocking the renderer or storing the entire audio file in memory. The progress dialog supports Cancel/Escape. The destination is replaced only after encoding succeeds; cancellation and encoder failure preserve existing files and remove temporary output. Export does not touch project JSON or the live synth. Runtime staging includes the worker, encoder and original license/provenance. See AUDIO_EXPORT.md for codec settings, ownership and limitations.

Changed: new src/audio/render.ts, src/audio/worker.ts and generated dist/audio modules; audio-export.cjs; src/export.ts and dist/export.js; index.html, studio.css, main.cjs, preload.cjs, build-audio.cjs, package-release.ps1; new vendor/audio-worker.cjs, vendor/ffmpeg.exe, vendor/FFmpeg-LICENSE.txt, vendor/FFmpeg-README.txt; tests/audio-export.test.mjs, tests/electron-audio-export.cjs, tests/electron-export-formats.cjs, tests/run.cjs; AUDIO_EXPORT.md, AUDIO_SECURITY.md, PROJECT_MAP.md and PROGRESS.md.

Actual validation: incremental build passed; full node tests/run.cjs passed 116 tests. Native electron-audio-export passed all six actual encode/decode checks, loop onsets/rests, mute, scoped rendering and both cancellation paths; it also passed against staging/app without runtime npm dependencies. Native electron-export-formats, electron-dialog-focus and electron-ui (19 checks) passed. The export-format test had a stale 40px caption-height assertion from before the requested slider spacing; replaced it with a check for separate zoom hit areas. The first Segment duration assertion was too short for the actual flute release/reverb and was corrected to distinguish the clipped Segment from the longer parent note. Inspected the native Audio dialog screenshot. No physical listening or manual native file-picker testing claimed. git diff --check passed.

Delivery: complete mml-studio-audio-export-source.zip, including encoder/runtime assets, because this adds a runtime worker and encoder dependency. No outstanding task-specific work.

## Extra offline channels need a full reset — 2026-09-08

The supplied Touhou project exposed an offline-renderer initialization bug. Its 30,893 notes/instructions allocate 52 melodic routes: 37 for the first instrument, then 15 for the second. Extra synth channels were created after loading the sound bank, so they missed the bank-load reset. They retained zeroed volume/expression controllers and drum mode. Inspection showed first-instrument routes above channel 15 using the Jazz kit and second-instrument routes using the Electronic kit instead of the selected bass/guitar presets. This depends on route count, not duration itself.

The renderer now resets after allocating every channel, explicitly sets each route's melodic/drum role from its owning Instrument, and only then applies mute and scheduled MIDI presets/controllers. Project data and playback routing are unchanged. A sound-level regression compares identical melodic and drum presets on the first port and later ports, including the supplied project's 37-route pattern. It failed before the fix; changing drum roles alone still failed because controllers also needed initialization.

Changed: src/audio/render.ts, dist/audio/render.js, vendor/audio-worker.cjs, tests/audio-export.test.mjs, AUDIO_EXPORT.md, PROGRESS.md. Actual validation: incremental build and all 117 tests pass. Native electron-audio-export passes all six codecs, loop/rest checks, mute, Segment scope and cancellation. The supplied project completed a full FLAC export at 1x speed: 3123.09 seconds of music plus natural release, with no warnings, using 70% master volume for validation. A separate full-length second-instrument render has nonzero signal in every minute containing its notes; its final note-off is 3116.64 seconds, followed by the expected silent ending. Original user JSON was verified byte-for-byte unchanged. Physical listening is not claimed. User music stays in local validation output and is excluded from the patch.

Delivery: audio-channel-fix-patch.zip. No outstanding task-specific work.

## Compact editor bars and a keyboard below the ruler — 2026-09-08

The measure ruler is 24px instead of 30px, with vertically centred numbers. Both keyboard styles clip below it, leaving a clean ruler corner even while scrolling; measure labels also clip outside the keyboard column. Horizontal and vertical zoom now sit side by side with separate hit areas in a 40px caption at normal widths. The editing toolbar is 48px, with equal 76x36px Open Segment / Open Song buttons, 11px type and room for two lines. Kept the direct buttons. Container-based compact layouts accommodate open side panels: narrow captions can use extra rows while the two sliders remain horizontal, and scoped controls wrap without colliding with editing tools. Return to Project stays 6px below the shortened ruler and aligned under Time signature.

Changed: src/constants.ts, src/rendering/keyboard.ts, src/rendering/ruler.ts, their generated dist modules, studio.css; tests/renderer.test.cjs, tests/electron-pitch-layout.cjs, tests/electron-export-formats.cjs, tests/electron-segment-view.cjs; PROGRESS.md. Existing uncommitted work retained.

Actual validation: incremental node build.cjs passed (esbuild requires execution outside the filesystem sandbox); renderer integration passed. Native electron-pitch-layout passed including real note drawing, selection, move/resize and piano preview at multiple zoom settings. Native electron-ui passed all 19 checks, including 900px/1320px overflow. Native electron-export-formats passed including horizontal slider separation. Native electron-segment-view passed scoped editing, export/save and floating return positioning. Updated stale ruler-coordinate/vertical-slider assertions; an initial narrow return alignment failure was fixed and rerun. Inspected final native Sky and Night screenshots. git diff --check passed. No physical listening or manual native UI testing claimed.

Delivery: compact-editor-bars-patch.zip. No outstanding task-specific work.

## Section navigation replaces the toolbar controls — 2026-09-08

Replaced the editing toolbar's Section selector, Open Segment and Open Song with one Section dropdown immediately beside Tools in the header. It uses the shared menu icon/chevron and theme styling. Inside: Go to label and the existing combined Song/Segment selector, separator, Open Segment, separator, Open Song. Action rows have equal dimensions. Existing conditional visibility and scope availability remain; the whole menu hides when none of its controls are available, including a project without sections. Navigation keeps the menu available for opening the chosen scope; action clicks, outside clicks and Escape use the shared menu dismissal. Removed obsolete section-specific toolbar wrapping. At narrow widths with Section visible, the header uses its logo mark and reserves space for transport and menus to prevent overlap.

Changed: index.html, studio.css, src/chrome.ts, src/segment-view.ts and generated dist/chrome.js, dist/segment-view.js; tests/electron-segment-view.cjs; PROGRESS.md.

Actual validation: incremental node build.cjs passed; renderer integration passed; native electron-ui passed all 19 checks. Extended native electron-segment-view passed hidden startup, removal from the editing toolbar, header placement and action row geometry, custom list opening/selection, navigation, Escape dismissal, 900px header non-overlap, and existing scoped editing/save/export/return checks. Inspected native Section menu screenshots in Sky and Night (including 900px). No manual native testing claimed. git diff --check passed.

Delivery: section-menu-patch.zip. No outstanding task-specific work.

## npm start warns when the optional encoder is missing — 2026-09-08

Added npm's prestart hook to run check-ffmpeg.cjs before the existing build/launch command. It resolves vendor/ffmpeg.exe relative to the checkout, checks for a nonempty regular file, and otherwise prints a warning, the Gyan Windows builds URL, extraction instructions and the absolute destination. Startup continues: the encoder is needed for audio export, not editing or preview. No automatic download or browser launch. Existing .gitignore already excludes the executable. AUDIO_EXPORT.md explains fresh-checkout setup and matching downloaded license/provenance; presence checks do not certify newer encoder compatibility.

Changed: new check-ffmpeg.cjs, package.json, AUDIO_EXPORT.md, PROJECT_MAP.md, PROGRESS.md. Actual validation: isolated fixture checks passed for missing, empty and present files, warning URL/destination, local encoder and manifest hook. The npm prestart lifecycle passed via the installed npm-cli.js. The shell's default npm shim failed because it resolved to a missing AppData/Roaming npm-cli.js; no system npm changes made. Renderer integration and incremental node build.cjs passed. No native UI testing needed or claimed for this console-only setup hook. git diff --check passed.

Delivery: ffmpeg-startup-check-patch.zip. No outstanding task-specific work.

## Include Example Project in build staging — 2026-09-08

Packaging now includes every file in the source Example Project folder, preserving its relative path under staging/app/Example Project and the release resources/app/Example Project. The generated release ZIP includes Song of Storms.json. Source example contents remain unchanged.

Changed: package-release.ps1, tests/release.test.cjs, PROGRESS.md. Actual validation: incremental build and full package-release.ps1 passed; both existing release tests passed, with added source-to-stage byte comparison for example files. Confirmed Song of Storms.json is present in the completed release ZIP. No native UI testing claimed. git diff --check passed.

Delivery: updated releases/MML Music Studio-win32-x64.zip and focused example-project-staging-patch.zip. No outstanding task-specific work.
