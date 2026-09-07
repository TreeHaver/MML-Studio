import { layout } from './viewport.js';
import { draw } from './painting.js';
import { $, view, input } from './dom.js';
import { state } from './state.js';
import { checkpoint } from './history.js';
import { stopPlayback } from './playback/transport.js';
import { refresh } from './commands.js';
import { status } from './dom.js';
export function setTool(value) { state.tool = value; for (const id of ['draw', 'select', 'spray'])
    $(id).classList.toggle('active', id === state.tool); }
export function installToolbar() {
    $('draw').onclick = () => setTool('draw');
    $('select').onclick = () => setTool('select');
    $('spray').onclick = () => setTool('spray');
    for (const g of [4, 8, 16, 32, 64, 128]) {
        const option = document.createElement('option');
        option.value = String(g);
        option.textContent = 'L' + g;
        $('grid').append(option);
    }
    $('grid').onchange = () => { state.project.grid = Number(input('grid').value); draw(); };
    $('zoom').oninput = () => { const time = view.scrollLeft / state.zoom; state.zoom = Number(input('zoom').value); layout(); view.scrollLeft = time * state.zoom; draw(); };
    $('clear-all').onclick = () => { const count = state.project.notes.length; if (!count)
        return; if (!confirm(`Delete all ${count} notes and instructions from this project?\nYou can undo this action.`))
        return; stopPlayback(false); checkpoint(); state.project.notes = []; state.selection.clear(); refresh(); status(`Deleted all ${count} notes and instructions.`); };
}
