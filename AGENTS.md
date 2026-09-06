# Working on this editor

Start with PROJECT_MAP.md and PROGRESS.md. Use the map to identify the smallest relevant set of files; do not routinely read or rewrite the entire project. Keep model/music functions free of DOM dependencies. Add UI handlers in their owner module and wire new modules in src/renderer.ts only if needed. Preserve version-2 project JSON unless a migration is explicitly part of the task.

Edit source, run the incremental-output build, and run the relevant existing tests. Record changed files and actual validation in PROGRESS.md. Do not claim native UI testing when only simulated DOM tests ran. Prefer focused patch ZIPs for small updates and full ZIPs for structural changes. User instructions take precedence.

MapleStory 2 MML supports non-power-of-two note lengths. Do not restrict imported/stored/exported durations to the grid dropdown or conventional power-of-two MML length values. Current version-2 timing stores any positive integer length in 1/128-whole-note units; finer MIDI timing requires reported rounding, not silent grid snapping. See MIDI_IMPORT.md for import behavior and the distinction between model units and MML length denominators.

Import and editing must not enforce export limits. Do not cap file size, note/event/track/instrument counts or clamp imported tempo to MapleStory 2 export ranges. Tempo instructions must be positive integer BPM. Round fractional MIDI tempos to the nearest whole BPM and report that conversion; do not clamp to export ranges. Future export planning should report target-specific limits and let the user decide how to handle them; do not reject or truncate projects during import. Keep malformed-file validation and distinguish actual format/model conversion limitations from export restrictions.

Standard Drum Kit is supported for General MIDI import/editing/preview. Per user request, show a non-blocking warning that it is not a valid MS2 instrument. Keep drum projects editable and saveable; future export planning must offer a way to handle them. See DRUM_KIT.md.

Unbound supported tempo events belong to the silent Instructions instrument (optional isInstructions flag in version-2 JSON). Never synthesize Instructions as notes. Keep note-bound and unbound tempo changes in the same global clock and yellow timeline indicators. See TIMELINE_UPDATE.md.

MS2 MML ties prefix the continued note: emit CT150&C, never C&T150C. Note-bound and unbound global tempo changes must propagate into every generated musical channel through its final note; split held notes at those boundaries and tie their continuations.
