## Timeline follow and Instructions — 2026-09-06

Playback follows the playhead horizontally when it reaches 75% of the visible roll. Vertical scrolling is preserved. Pause suspends following; Resume continues it. Stop leaves the viewport in place; starting again follows from the beginning.

The instrument preset selector includes Instructions (silent). MIDI tempo events with no note starting at their position are placed there automatically, including changes inside held notes. Tempo-only MIDI files are supported. Select Instructions to see its event row, or add an instrument and choose Instructions to draw new events. Select an event and edit its positive integer Tempo value. Events move horizontally and support deletion/undo; pitch, length and volume controls are disabled. Instructions never produce sound or consume MIDI instrument channels.

Yellow vertical lines and T labels indicate actual global tempo changes, whether attached to audible notes or Instructions. Repeated identical tempos and the implicit default 120 BPM do not add change lines.

Version-2 JSON is preserved with optional instrument.isInstructions boolean. Events retain the existing note-shaped storage (one-unit length, V0 for newly created/imported events). The old importer's specifically named Tempo markers (silent) lane is recognized on loading when all its notes are silent tempo carriers. Other instruments are unaffected. Currently tempo is the supported unbound instruction; unsupported MIDI controls still receive import notices.

Modules: src/model/instructions.ts owns lane creation/legacy recognition; src/playback/follow.ts owns pure scroll calculation; src/rendering/tempo.ts owns yellow markers. Existing owner modules handle import, interaction, inspector and transport. Model/music code remains DOM-free.
