import { $, status } from '../dom.js';
import { state, isMuted } from '../state.js';
import { draw } from '../painting.js';
import { compilePlayback, heldPlaybackNotes } from './midi.js';
import { tickAtSeconds, tempoAt, secondsAtTick, tempoMap } from '../music/tempo.js';
import { volumeAt } from '../music/volume.js';
import { getEngine, setMasterVolume } from './engine.js';
import { followPlayback } from '../viewport.js';
export const playback = { tick: null };
export const playbackSettings = { speed: 1, volume: 1 };
let phase = 'idle', engine = null, plan = null;
let snapshot = null, frame = 0, generation = 0, voiceRevision = 0, loadedVoiceRevision = 0;
// Recompile only the playback snapshot's voices. Other song edits keep their
// existing Stop/Play semantics. Re-trigger held notes with their remaining time.
async function loadSnapshot(token) {
    engine = await getEngine();
    while (token === generation) {
        const revision = voiceRevision, from = playback.tick ?? 0;
        snapshot.instruments = structuredClone(state.project.instruments);
        const range = state.segment?.projection.range;
        const next = compilePlayback(snapshot, range ? range.end - range.start : 0);
        await engine.load(next.binary);
        if (token !== generation)
            return false;
        if (revision !== voiceRevision || from !== (playback.tick ?? 0))
            continue;
        plan = next;
        engine.seq.playbackRate = playbackSettings.speed;
        engine.seq.currentTime = Math.min(plan.duration, secondsAtTick(plan.map, from));
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
        engine.seq.currentTime = Math.min(plan.duration, secondsAtTick(plan.map, playback.tick ?? 0));
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
        playback.tick = tickAtSeconds(plan.map, Math.max(0, engine.seq.currentHighResolutionTime));
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
        playback.tick = null;
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
function restoreHeld() { engine.restoreNotes(heldPlaybackNotes(snapshot, plan.channels, playback.tick ?? 0)); }
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
    const tick = playback.tick ?? 0, project = phase === 'idle' ? state.project : snapshot ?? state.project;
    const bpm = tempoAt(project.notes, tick), effective = bpm * playbackSettings.speed;
    $('playback-bpm').textContent = `${bpm} BPM`;
    $('playback-time').textContent = playback.tick === null ? '' : `${secondsAtTick(phase === 'idle' ? tempoMap(state.project.notes) : plan?.map ?? tempoMap(state.project.notes), tick).toFixed(1)} s · `;
    const label = $('effective-bpm');
    label.hidden = playbackSettings.speed === 1;
    // Reads as part of the line, not a footnote: whole numbers, same size, same baseline.
    label.textContent = ` · ${Math.round(effective)} effective${effective < 32 || effective > 255 ? ' (out of bounds!)' : ''}`;
    label.classList.toggle('out-of-bounds', effective < 32 || effective > 255);
}
export function syncPlaybackControls() { buttons(); positionLabel(); }
function setPosition(seconds) { if (!engine || !plan)
    return; const time = Math.max(0, Math.min(plan.duration, seconds)); engine.seq.currentTime = time; playback.tick = tickAtSeconds(plan.map, time); if (phase === 'playing')
    restoreHeld(); followPlayback(playback.tick); draw(); }
// Idle seeks park the playhead so the next play() starts from there.
export function seekToTick(tick) {
    const range = state.segment?.projection.range, target = Math.max(0, Math.min(tick, range ? range.end - range.start : Infinity));
    if (engine && plan && (phase === 'playing' || phase === 'paused')) {
        setPosition(secondsAtTick(plan.map, target));
        return;
    }
    playback.tick = target;
    draw();
}
function animate() {
    if (phase !== 'playing')
        return;
    const time = engine.seq.currentHighResolutionTime;
    playback.tick = Math.min(plan.end, tickAtSeconds(plan.map, Math.max(0, time)));
    followPlayback(playback.tick);
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
        const token = generation, time = secondsAtTick(plan.map, playback.tick ?? 0);
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
    if (playback.tick === null && section !== '')
        playback.tick = Number(section);
    const token = ++generation;
    phase = 'loading';
    buttons();
    status('Preparing General MIDI playback…');
    try {
        snapshot = structuredClone(state.project);
        if (!await preparePlayback(token, true))
            return;
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
        playback.tick = tickAtSeconds(plan.map, Math.max(0, engine.seq.currentHighResolutionTime));
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
    $('start').onclick = () => setPosition(0);
    $('rewind').onclick = () => setPosition((engine?.seq.currentHighResolutionTime ?? 0) - 5);
    $('forward').onclick = () => setPosition((engine?.seq.currentHighResolutionTime ?? 0) + 5);
}
