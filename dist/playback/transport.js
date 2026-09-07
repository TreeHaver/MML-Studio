import { $, status } from '../dom.js';
import { state, isMuted } from '../state.js';
import { draw } from '../painting.js';
import { compilePlayback } from './midi.js';
import { tickAtSeconds, tempoAt } from '../music/tempo.js';
import { volumeAt } from '../music/volume.js';
import { getEngine } from './engine.js';
import { followPlayback } from '../viewport.js';
export const playback = { tick: null };
let phase = 'idle', engine = null, plan = null;
let snapshot = null, frame = 0, generation = 0;
export function updatePlaybackMutes(ready = false) { if (phase === 'loading' && !ready)
    return; if (engine && plan)
    for (const item of plan.channels)
        engine.mute(item.channel, isMuted(item.instrument)); }
const playable = () => state.project.notes.some(n => !state.project.instruments[n.instrument]?.isInstructions && n.pitch >= 0 && n.pitch <= 127 && volumeAt(state.project, n) > 0);
function buttons() {
    const canPlay = playable();
    const play = $('play');
    play.disabled = !canPlay || phase === 'loading' || phase === 'playing';
    play.title = phase === 'paused' ? 'Resume' : 'Play';
    play.setAttribute('aria-label', play.title);
    $('pause').disabled = phase !== 'playing';
    $('stop').disabled = phase === 'idle';
    $('clear-all').disabled = !state.project.notes.length;
    for (const id of ['start', 'rewind', 'forward'])
        $(id).disabled = phase === 'idle' || phase === 'loading';
}
export function syncPlaybackControls() { buttons(); }
function setPosition(seconds) { if (!engine || !plan)
    return; const time = Math.max(0, Math.min(plan.duration, seconds)); engine.seq.currentTime = time; playback.tick = tickAtSeconds(plan.map, time); followPlayback(playback.tick); $('playback-position').textContent = `${time.toFixed(1)} s · ${tempoAt(snapshot.notes, playback.tick)} BPM`; draw(); }
function animate() {
    if (phase !== 'playing')
        return;
    const time = engine.seq.currentHighResolutionTime;
    playback.tick = Math.min(plan.end, tickAtSeconds(plan.map, Math.max(0, time)));
    followPlayback(playback.tick);
    $('playback-position').textContent = `${time.toFixed(1)} s · ${tempoAt(snapshot.notes, playback.tick)} BPM`;
    draw();
    if (engine.seq.isFinished) {
        stopPlayback(false);
        return;
    }
    frame = requestAnimationFrame(animate);
}
export function stopPlayback(message = true) {
    generation++;
    cancelAnimationFrame(frame);
    engine?.stop();
    playback.tick = null;
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
        updatePlaybackMutes(true);
        await engine.play();
        phase = 'playing';
        buttons();
        animate();
        return;
    }
    if (!playable()) {
        status('Draw a playable note before playing.');
        return;
    }
    const token = ++generation;
    phase = 'loading';
    buttons();
    status('Preparing General MIDI playback…');
    try {
        snapshot = structuredClone(state.project);
        plan = compilePlayback(snapshot);
        engine = await getEngine();
        if (token !== generation)
            return;
        await engine.load(plan.binary);
        if (token !== generation)
            return;
        updatePlaybackMutes(true);
        await engine.play();
        phase = 'playing';
        buttons();
        status('Playing unmuted instruments.' + (plan.skipped ? ` ${plan.skipped} notes outside MIDI pitches 0–127 are silent.` : ''));
        animate();
    }
    catch (error) {
        phase = 'idle';
        playback.tick = null;
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
    $('play').onclick = () => void play();
    $('pause').onclick = () => { if (phase === 'playing') {
        engine.pause();
        phase = 'paused';
        cancelAnimationFrame(frame);
        buttons();
        status('Playback paused.');
    } };
    $('stop').onclick = () => stopPlayback();
    buttons();
    $('start').onclick = () => setPosition(0);
    $('rewind').onclick = () => setPosition((engine?.seq.currentHighResolutionTime ?? 0) - 5);
    $('forward').onclick = () => setPosition((engine?.seq.currentHighResolutionTime ?? 0) + 5);
}
