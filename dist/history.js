import { refresh } from './commands.js';
import { $ } from './dom.js';
import { state, resetInstrumentView } from './state.js';
import { stopPlayback, updatePlaybackVoices, updatePlaybackMutes } from './playback/transport.js';
import { historySnapshot, restoreProject } from './segment-session.js';
export function checkpoint() { state.history.push(historySnapshot()); if (state.history.length > 100)
    state.history.shift(); state.future = []; state.dirty = true; }
export function undo(redo = false) { const src = redo ? state.future : state.history, dst = redo ? state.history : state.future; if (!src.length)
    return; dst.push(historySnapshot()); const restored = JSON.parse(src.pop()); if (state.segment || restored.instruments.length !== state.project.instruments.length) {
    stopPlayback(false);
    resetInstrumentView();
} const voicesChanged = restored.instruments.some((i, index) => ["midiProgram", "isDrum", "ms2Drum", "isInstructions"].some(key => i[key] !== state.project.instruments[index]?.[key])); restoreProject(restored); updatePlaybackMutes(); if (voicesChanged)
    void updatePlaybackVoices(); state.active = Math.min(state.active, state.project.instruments.length - 1); state.selection.clear(); state.gesture = null; state.dirty = true; refresh(); }
export function installHistory() {
    const repeat = (id, action) => {
        const button = $(id);
        let delay, interval, held = false;
        const stop = () => { held = false; if (delay !== undefined) {
            clearTimeout(delay);
            delay = undefined;
        } if (interval !== undefined) {
            clearInterval(interval);
            interval = undefined;
        } };
        button.onpointerdown = e => { if (e.button !== 0)
            return; button.setPointerCapture(e.pointerId); held = true; action(); delay = window.setTimeout(() => { if (!held)
            return; action(); interval = window.setInterval(action, 85); }, 420); };
        button.onpointerup = stop;
        button.onpointercancel = stop;
        button.onlostpointercapture = stop;
        button.onclick = e => { if (e.detail === 0)
            action(); };
    };
    repeat('undo', () => undo());
    repeat('redo', () => undo(true));
}
