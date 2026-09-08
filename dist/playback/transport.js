import { $, status } from '../dom.js';
import { state, isMuted } from '../state.js';
import { draw } from '../painting.js';
import { compilePlayback, heldPlaybackNotes } from './midi.js';
import { tickAtSeconds, tempoAt, secondsAtTick, tempoMap } from '../music/tempo.js';
import { volumeAt } from '../music/volume.js';
import { getEngine, setMasterVolume } from './engine.js';
import { followPlayback } from '../viewport.js';
import { loopRegion, looping } from './loop-region.js';
let position = null;
export const playback = { get tick() { return position === null ? null : phase === 'idle' || !plan ? position : plan.sourceTick(position); }, set tick(value) { position = value; } };
export const playbackSettings = { speed: 1, volume: 1 };
let phase = 'idle', engine = null, plan = null;
let snapshot = null, frame = 0, generation = 0, voiceRevision = 0, loadedVoiceRevision = 0;
/**
 * The loop cannot ride on the animation frame. Chromium stops painting a window that is
 * behind another application, so the frame callback stops with it while the audio thread
 * plays straight on - which is why the whole song went past the loop as soon as the editor
 * lost focus. This timer reads the sequencer's own clock instead, and keeps the loop honest
 * whether or not anything is being drawn.
 */
let rewinding = false;
/**
 * Taking the loop back to its start. A sequencer that has reached the end of the song is
 * finished for good: putting its clock back is not enough, it has to be told to play again,
 * or the position freezes at the start with the last notes still held down - which is the
 * crackle that was reported when a loop reached past the end of the music.
 */
async function rewindLoop() {
    if (rewinding || !engine || !plan)
        return;
    rewinding = true;
    try {
        const finished = engine.seq.isFinished;
        seekToTick(loopRegion.start);
        if (!finished)
            return;
        const token = generation;
        await engine.play();
        if (token !== generation || phase !== 'playing')
            return;
        seekToTick(loopRegion.start);
        restoreHeld();
    }
    finally {
        rewinding = false;
    }
}
function loopGuard() {
    if (phase !== 'playing' || !looping() || !engine || !plan)
        return;
    const heard = plan.sourceTick(tickAtSeconds(plan.map, Math.max(0, engine.seq.currentHighResolutionTime)));
    if (heard >= loopRegion.end || engine.seq.isFinished)
        void rewindLoop();
}
// Recompile only the playback snapshot's voices. Other song edits keep their
// existing Stop/Play semantics. Re-trigger held notes with their remaining time.
async function loadSnapshot(token) {
    engine = await getEngine();
    while (token === generation) {
        const revision = voiceRevision, from = position ?? 0;
        snapshot.instruments = structuredClone(state.project.instruments);
        const range = state.segment?.projection.range;
        // A loop drawn past the end of the music still has to be played to its end, so the
        // performance is compiled at least that long; without it the song simply stops early.
        const next = compilePlayback(snapshot, Math.max(range ? range.end - range.start : 0, looping() ? loopRegion.end : 0));
        await engine.load(next.binary);
        if (token !== generation)
            return false;
        if (revision !== voiceRevision || from !== (position ?? 0))
            continue;
        if (!plan)
            position = next.performanceTick(position ?? 0);
        plan = next;
        engine.seq.playbackRate = playbackSettings.speed;
        engine.seq.currentTime = Math.min(plan.duration, secondsAtTick(plan.map, position ?? 0));
        loadedVoiceRevision = revision;
        updatePlaybackMutes(true);
        return true;
    }
    return false;
}
async function preparePlayback(token, resume) {
    do {
        if (!await loadSnapshot(token))
            return false;
        if (!resume)
            return true;
        await engine.play();
        if (token !== generation) {
            engine.stop();
            return false;
        }
        if (loadedVoiceRevision !== voiceRevision) {
            engine.pause();
            continue;
        }
        // Set again after unpausing: the sequencer's paused seek may advance to the
        // next MIDI event. Playing seeks preserve leading rests and held-note time.
        engine.seq.currentTime = Math.min(plan.duration, secondsAtTick(plan.map, position ?? 0));
        restoreHeld();
        return true;
    } while (token === generation);
    return false;
}
export async function updatePlaybackVoices() {
    voiceRevision++;
    if (phase !== 'playing' && phase !== 'paused')
        return;
    const resume = phase === 'playing', token = ++generation;
    if (resume)
        position = tickAtSeconds(plan.map, Math.max(0, engine.seq.currentHighResolutionTime));
    cancelAnimationFrame(frame);
    engine.pause();
    phase = 'loading';
    buttons();
    try {
        if (!await preparePlayback(token, resume))
            return;
        phase = resume ? 'playing' : 'paused';
        buttons();
        if (resume)
            animate();
        else
            draw();
    }
    catch (error) {
        phase = 'idle';
        position = null;
        engine?.stop();
        status('Voice update failed: ' + error);
    }
    finally {
        if (token !== generation || phase === 'loading')
            phase = 'idle';
        buttons();
    }
}
export function updatePlaybackMutes(ready = false) { if (phase === 'loading' && !ready)
    return; if (engine && plan)
    for (const item of plan.channels)
        engine.mute(item.channel, isMuted(item.instrument)); }
const playable = () => state.project.notes.some(n => !state.project.instruments[n.instrument]?.isInstructions && n.pitch >= 0 && n.pitch <= 127 && volumeAt(state.project, n) > 0);
function restoreHeld() { engine.restoreNotes(heldPlaybackNotes(plan.project, plan.channels, position ?? 0)); }
function buttons() {
    const canPlay = playable();
    const play = $('play');
    const playing = phase === 'playing';
    play.classList.toggle('is-playing', playing);
    play.disabled = phase === 'loading' || (!playing && !canPlay);
    play.title = playing ? 'Pause' : phase === 'paused' ? 'Resume' : 'Play';
    play.setAttribute('aria-label', play.title);
    $('stop').disabled = phase === 'idle';
    $('clear-all').disabled = !state.project.notes.length;
    for (const id of ['start', 'rewind', 'forward'])
        $(id).disabled = phase === 'idle' || phase === 'loading';
}
function positionLabel() {
    const tick = position ?? 0, project = phase === 'idle' ? state.project : plan?.project ?? snapshot ?? state.project;
    const bpm = tempoAt(project.notes, tick), effective = bpm * playbackSettings.speed;
    $('playback-bpm').textContent = `${bpm} BPM`;
    $('playback-time').textContent = position === null ? '' : `${secondsAtTick(phase === 'idle' ? tempoMap(state.project.notes) : plan?.map ?? tempoMap(state.project.notes), tick).toFixed(1)} s · `;
    const label = $('effective-bpm');
    label.hidden = playbackSettings.speed === 1;
    // Reads as part of the line, not a footnote: whole numbers, same size, same baseline.
    label.textContent = ` · ${Math.round(effective)} effective${effective < 32 || effective > 255 ? ' (out of bounds!)' : ''}`;
    label.classList.toggle('out-of-bounds', effective < 32 || effective > 255);
}
export function syncPlaybackControls() { buttons(); positionLabel(); }
function setPosition(seconds) { if (!engine || !plan)
    return; const time = Math.max(0, Math.min(plan.duration, seconds)); engine.seq.currentTime = time; position = tickAtSeconds(plan.map, time); if (phase === 'playing')
    restoreHeld(); followPlayback(playback.tick); draw(); }
// Idle seeks park the playhead so the next play() starts from there.
export function seekToTick(tick) {
    const range = state.segment?.projection.range, target = Math.max(0, Math.min(tick, range ? range.end - range.start : Infinity));
    if (engine && plan && (phase === 'playing' || phase === 'paused')) {
        setPosition(secondsAtTick(plan.map, plan.performanceTick(target)));
        return;
    }
    position = target;
    draw();
}
function animate() {
    if (phase !== 'playing')
        return;
    const time = engine.seq.currentHighResolutionTime;
    position = Math.min(plan.end, tickAtSeconds(plan.map, Math.max(0, time)));
    // The rehearsal loop is measured in the ticks the user sees, so it is checked here
    // rather than in the compiled performance, and simply seeks back when it runs past.
    if (looping() && playback.tick !== null && playback.tick >= loopRegion.end) {
        void rewindLoop();
        frame = requestAnimationFrame(animate);
        return;
    }
    followPlayback(playback.tick);
    draw();
    if (engine.seq.isFinished) {
        if (looping()) {
            void rewindLoop();
            frame = requestAnimationFrame(animate);
            return;
        }
        stopPlayback(false);
        return;
    }
    frame = requestAnimationFrame(animate);
}
export function stopPlayback(message = true) {
    generation++;
    cancelAnimationFrame(frame);
    engine?.stop();
    position = null;
    // Retain the loading lock until an in-flight initialization completes.
    if (phase !== 'loading')
        phase = 'idle';
    buttons();
    draw();
    if (message)
        status('Playback stopped.');
}
export async function play() {
    if (phase === 'loading' || phase === 'playing')
        return;
    if (phase === 'paused') {
        const token = generation, time = secondsAtTick(plan.map, position ?? 0);
        updatePlaybackMutes(true);
        await engine.play();
        if (token !== generation) {
            engine.stop();
            return;
        }
        phase = 'playing';
        setPosition(time);
        buttons();
        animate();
        return;
    }
    if (!playable()) {
        status('Draw a playable note before playing.');
        return;
    }
    const section = $('section-nav').value;
    if (position === null && section !== '')
        position = Number(section);
    // Starting outside the loop would play on and never come round, so it starts inside it.
    if (looping() && (position === null || position < loopRegion.start || position >= loopRegion.end))
        position = loopRegion.start;
    const token = ++generation;
    phase = 'loading';
    buttons();
    status('Preparing General MIDI playback…');
    try {
        snapshot = structuredClone(state.project);
        plan = null;
        if (!await preparePlayback(token, true))
            return;
        phase = 'playing';
        buttons();
        status('Playing unmuted instruments. ' + plan.warnings.join(' ') + (plan.skipped ? ` ${plan.skipped} notes outside MIDI pitches 0–127 are silent.` : ''));
        animate();
    }
    catch (error) {
        phase = 'idle';
        position = null;
        engine?.stop();
        status('Playback failed: ' + error);
    }
    finally {
        if (token !== generation || phase === 'loading')
            phase = 'idle';
        buttons();
    }
}
export function installPlayback() {
    const speed = $('playback-speed'), volume = $('playback-volume');
    let draggingSpeed = false;
    speed.value = '100';
    volume.value = '100';
    speed.onpointerdown = () => { draggingSpeed = true; };
    speed.onpointerup = () => { draggingSpeed = false; };
    speed.onpointercancel = () => { draggingSpeed = false; };
    speed.onkeydown = () => { draggingSpeed = false; };
    speed.oninput = () => {
        let percent = Math.max(25, Math.min(400, Number(speed.value) || 100));
        if (draggingSpeed)
            for (const snap of [50, 200])
                if (Math.abs(percent - snap) <= 3)
                    percent = snap;
        speed.value = String(percent);
        playbackSettings.speed = percent / 100;
        $('playback-speed-value').textContent = `${percent}% (${percent / 100}x)`;
        if (engine)
            engine.seq.playbackRate = playbackSettings.speed;
        positionLabel();
    };
    volume.oninput = () => { const percent = Math.max(0, Math.min(100, Number(volume.value) || 0)); volume.value = String(percent); playbackSettings.volume = percent / 100; $('playback-volume-value').textContent = `${percent}%`; setMasterVolume(playbackSettings.volume); };
    $('play').onclick = () => { if (phase === 'playing') {
        position = tickAtSeconds(plan.map, Math.max(0, engine.seq.currentHighResolutionTime));
        engine.pause();
        phase = 'paused';
        cancelAnimationFrame(frame);
        buttons();
        status('Playback paused.');
    }
    else
        void play(); };
    $('stop').onclick = () => stopPlayback();
    buttons();
    // 40ms is far below the shortest loop worth rehearsing and costs nothing while idle.
    setInterval(loopGuard, 40);
    $('start').onclick = () => setPosition(0);
    $('rewind').onclick = () => setPosition((engine?.seq.currentHighResolutionTime ?? 0) - 5);
    $('forward').onclick = () => setPosition((engine?.seq.currentHighResolutionTime ?? 0) + 5);
}
