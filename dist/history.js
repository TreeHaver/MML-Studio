import { refresh } from './commands.js';
import { $ } from './dom.js';
import { state } from './state.js';
export function checkpoint() { state.history.push(JSON.stringify(state.project)); if (state.history.length > 100)
    state.history.shift(); state.future = []; state.dirty = true; }
export function undo(redo = false) { const src = redo ? state.future : state.history, dst = redo ? state.history : state.future; if (!src.length)
    return; dst.push(JSON.stringify(state.project)); state.project = JSON.parse(src.pop()); state.active = Math.min(state.active, state.project.instruments.length - 1); state.selection.clear(); state.dirty = true; refresh(); }
export function installHistory() {
    $('undo').onclick = () => undo();
    $('redo').onclick = () => undo(true);
}
