import { $, status } from '../dom.js';
import { state, isMuted } from '../state.js';
import { draw } from '../painting.js';
import { compilePlayback } from './midi.js';
import { tickAtSeconds, tempoAt } from '../music/tempo.js';
import { getEngine } from './engine.js';
import { followPlayback } from '../viewport.js';
export const playback = { tick: null };
let phase = 'idle', engine = null, plan = null;
let snapshot = null, frame = 0, generation = 0;
export function updatePlaybackMutes(ready = false) { if (phase === 'loading' && !ready)
    return; if (engine && plan)
    for (const item of plan.channels)
        engine.mute(item.channel, isMuted(item.instrument)); }
function buttons() {
    $('play').disabled = phase === 'loading' || phase === 'playing';
    $('play').textContent = phase === 'paused' ? 'Resume' : 'Play';
    $('pause').disabled = phase !== 'playing';
    $('stop').disabled = phase === 'idle';
}
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
    if (!state.project.notes.length) {
        status('Draw some notes before playing.');
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
}
