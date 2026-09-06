import { layout } from './viewport.js';
import { draw } from './painting.js';
import { $, view, input } from './dom.js';
import { state } from './state.js';
export function setTool(value) { state.tool = value; for (const id of ['draw', 'select'])
    $(id).classList.toggle('active', id === state.tool); }
export function installToolbar() {
    $('draw').onclick = () => setTool('draw');
    $('select').onclick = () => setTool('select');
    for (const g of [4, 8, 16, 32, 64, 128]) {
        const option = document.createElement('option');
        option.value = String(g);
        option.textContent = 'L' + g;
        $('grid').append(option);
    }
    $('grid').onchange = () => { state.project.grid = Number(input('grid').value); draw(); };
    $('zoom').oninput = () => { const time = view.scrollLeft / state.zoom; state.zoom = Number(input('zoom').value); layout(); view.scrollLeft = time * state.zoom; draw(); };
}
