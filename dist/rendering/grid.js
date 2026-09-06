import { ctx, view } from '../dom.js';
import { state } from '../state.js';
import { KEY, HEAD, ROW } from '../constants.js';
import { sharp } from '../music/pitch.js';
export function drawGrid() {
    const step = 128 / state.project.grid, first = Math.floor(view.scrollLeft / (step * state.zoom));
    for (let i = first; i < (view.scrollLeft + state.width) / (step * state.zoom); i++) {
        ctx.fillStyle = i % 2 ? '#3b3e42' : '#33363a';
        ctx.fillRect(KEY + i * step * state.zoom - view.scrollLeft, HEAD, step * state.zoom, state.height);
    }
    const startRow = Math.floor(view.scrollTop / ROW), endRow = Math.ceil((view.scrollTop + state.height) / ROW);
    for (let row = startRow; row <= endRow; row++) {
        const pitch = state.topPitch - row, y = HEAD + row * ROW - view.scrollTop;
        if (sharp(pitch)) {
            ctx.fillStyle = '#00000024';
            ctx.fillRect(KEY, y, state.width, ROW);
        }
        ctx.fillStyle = '#ffffff0d';
        ctx.fillRect(KEY, y + ROW - 1, state.width, 1);
    }
    for (let t = Math.floor(view.scrollLeft / state.zoom / 32) * 32; t < (view.scrollLeft + state.width) / state.zoom; t += 32) {
        ctx.fillStyle = t % 128 === 0 ? '#8d96915c' : '#80889026';
        ctx.fillRect(KEY + t * state.zoom - view.scrollLeft, HEAD, 1, state.height);
    }
}
