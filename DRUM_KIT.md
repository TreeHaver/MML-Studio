# Standard Drum Kit

General MIDI defines percussion on MIDI channel 10 (zero-based channel 9). Each note number selects a percussion sound instead of a pitched rendition of one melodic program. GM1 defines 47 percussion keys, numbered 35–81. This is separate from the 128 melodic GM presets. Sources: [MIDI Association percussion-map discussion](https://midi.org/community/midi-specifications/question-about-general-midi-percussion-map) and [MIDI Association drum-map profile](https://midi.org/midi-ci-profile-for-default-drum-note-map).

## Using it

Choose **Standard Drum Kit (not valid in MS2)** at the end of an instrument's preset dropdown. Draw notes normally or click the left keyboard to preview sounds. Preview status shows the percussion name. The keyboard keeps its pitch labels; the MIDI note number is authoritative because octave labels vary between applications.

Some useful keys:

| MIDI note | Editor pitch label | Sound |
| --- | --- | --- |
| 36 | C2 | Bass Drum 1 |
| 38 | D2 | Acoustic Snare |
| 42 | F#2 | Closed Hi-Hat |
| 46 | A#2 | Open Hi-Hat |
| 49 | C#3 | Crash Cymbal 1 |
| 51 | D#3 | Ride Cymbal 1 |

Scroll the left keyboard down to reach kick/snare notes when necessary. Keys outside 35–81 are not assigned by the GM1 standard; the bank may provide extensions or silence, and they remain editable.

The persistent warning reads **“Not a valid MS2 instrument. Available for editing and preview.”** The MS2 incompatibility is an explicit user requirement. It is informational: importing, saving, editing and previewing drum parts remain allowed. A future MS2 export-planning workflow must flag those parts and offer handling choices; do not silently delete or convert them.

## Import, persistence and playback

GM1 channel-10 MIDI notes import as drum instruments. Source track/port separation and overlap lanes are retained. Nonzero/alternate drum programs use Standard Kit with a notice; GM2 or SysEx drum routing on other channels remains unsupported. Selecting a melodic preset switches the instrument back and removes its drum warning without changing its notes.

Version-2 JSON adds optional `instrument.isDrum: true`. Missing or false retains melodic playback, so existing projects load unchanged. A non-boolean flag is rejected. Drum playback uses program 0 regardless of a stored melodic program. Older builds that do not understand the flag may play saved drum parts melodically.

Song playback uses channel 10 on a separate MIDI port per drum instrument, preventing same-key note-offs in one lane from stopping notes in another. Melodic lanes continue to avoid channel 10. Keyboard previews use the independent preview synthesizer's drum channel, preserving song playback. The bundled TimGM6mb SF2 supplies the Standard Kit; no new sound-bank or decoder dependency is added.

## Validation

Automated tests cover selection/warning visibility, melodic/drum switching, preview note-on/off routing, JSON validation/round trips, MIDI import and distinct drum ports. The bank renders non-silent PCM for all 47 GM percussion keys. The native Electron smoke test verifies the warning, actual key-click kick preview, and sequenced kick/snare AudioWorklet output. Physical speaker output is not independently verified by listening.
