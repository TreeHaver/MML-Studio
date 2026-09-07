# MML Music Studio v0.3.0 — GM playback + T instructions

## Apply this patch

Close the editor. Extract this ZIP directly into your existing modular project folder (where package.json lives), preserving subfolders and allowing replacements. This patch targets modular v0.2.2; it also includes the new build.cjs but assumes the previous Node 22 patch/transpile.cjs is already installed.

Run:

```
npm install
npm start
```

Keep assets/ and vendor/ alongside index.html. The bank is bundled; no MIDI device or internet connection is needed for playback after installation.

## Playback

Standard Drum Kit is now available at the end of the instrument preset selector. It uses General MIDI channel-10 percussion for song playback and piano-key previews; imported channel-10 notes select it automatically. A persistent warning identifies it as not valid in MS2, as requested, without blocking editing or saving. See DRUM_KIT.md for note assignments and compatibility.

Local update (2026-09-06): click a piano key on the left to preview that pitch for 500 ms with the active instrument's GM preset. Rapid clicks replace the preceding preview. Preview uses a separate synthesizer so it does not change song playback or add notes. Reinstall dependencies with `npm ci` after applying this update: the flagged upstream Vorbis decoder has been removed from both generated audio bundles. See AUDIO_SECURITY.md. Compressed SF3 banks are unsupported; the bundled SF2 bank is unaffected.

Every instrument now has one General MIDI preset selector, numbered 1–128, underneath its name. Defaults to 1. Acoustic Grand Piano. Program values in JSON are zero-based 0–127. These preview sounds are independent of the eventual MapleStory 2 export instrument.

Play starts all drawn notes together from the beginning, including initial rests. Pause/Resume preserves position; Stop silences all voices and resets. A mint-colored playhead marks time and the header shows seconds/BPM. Playback uses a snapshot: use Stop then Play to hear edits made while playing. V0 is silent; V1–V15 map to MIDI velocity. Notes outside MIDI pitch 0–127 remain editable but are skipped during playback, with a status message.

## T instructions

Select a note and enter a positive integer BPM value in Tempo. Clear it to inherit. The default tempo before any T is 120 BPM. Export tempo restrictions are deferred to future export planning; MIDI import rounds fractional BPM to integer instructions with a conversion notice, without export-range clamping. T applies to every instrument from that note's start onward, including any held notes. Moving/deleting its note moves/removes the instruction; Undo restores it. The note label includes T when the note is wide enough.

Different T values at one simultaneous position are rejected. Matching T values at that position are allowed. Editing a multiple-note selection applies T to every selected note. Tempo changes and GM assignments save in JSON; previous version-2 projects open with defaults for missing fields.

## Verification

Build and 12 automated tests pass on Node 24.19.0, using the Node-22-compatible TypeScript build. Native Electron launch and audio output to a physical device were not verified. Audio synthesis itself was tested: all 128 included GM presets rendered non-silent PCM. Timing tests cover default tempo, limits, conflicts, held notes across tempo changes, leading rests, program/velocity messages and more than 15 instruments using MIDI ports.

## Audio components and licenses

Playback integrates [SpessaSynth's documented WorkletSynthesizer/Sequencer setup](https://spessasus.github.io/spessasynth_lib/getting-started/simple-example/). The build bundles the library and copies its matching audio processor. SpessaSynth's Apache-2.0 license is included under vendor/.

TimGM6mb.sf2 by Tim Brechbill/David Bolton is distributed unchanged. Its GPL-2 license/attribution and license text are included in assets/. The supplied SF2 is the editable sound-bank data itself. Provenance and source link are recorded in assets/TimGM6mb-LICENSE.txt. This sound bank is separate from the editor source.

Current timeline update: horizontal playback following, silent Instructions lanes and yellow tempo-change lines are implemented. See TIMELINE_UPDATE.md. Local validation now passes 34 automated tests plus native Electron timeline rendering/follow/pause/resume checks; physical speaker output is not a listening test.

## Live playback controls — 2026-09-07

Selecting a section sets the playback start/seek position. Preset changes refresh the current playback snapshot's instrument settings, retaining position and playing/paused state. This includes GM, Standard Kit, fixed MS2 drums and silent Instructions, plus voice undo/redo. Rapid changes are coalesced, Stop cancels pending loads, and held notes are restored with their original inherited velocity and remaining duration. A voice refresh briefly pauses while the sequence reloads and re-attacks sustained notes; it does not promise seamless timbre morphing. Other note/tempo edits retain Stop/Play snapshot behavior.

Playback speed is a session-only 25–400% multiplier (default 100%). Pointer dragging snaps within three percentage points of 50% and 200%; keyboard arrows can step out of snap positions. It changes the sequencer clock without editing tempo instructions, note timing, exports or saved JSON. At non-100% speed, the current source BPM is followed by smaller raised Effective BPM text, calculated from source BPM × speed. Effective values below 32 or above 255 display “Out of bounds!” without clamping playback or project data. Exact boundary values are allowed.

Playback Volume is a session-only 0–100% master gain (default 100%) shared by song playback and piano-key previews. Gain changes apply to existing/future synths and do not alter note V instructions or per-instrument mutes. Both controls work during playback and survive voice reloads, pause/resume and Stop/Play within the session.

Current validation: all 67 automated tests and the incremental build pass. tests/electron-behavior.cjs verifies native section positions, editable signature, live/paused voice changes, held-note AudioWorklet PCM, rewind, 400% clock advance, 0% master silence/50% output and responsive control bounds at 900px. Screenshot inspected. No physical-speaker listening or in-game MS2 test was performed.
