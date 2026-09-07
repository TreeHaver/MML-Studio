import { palette } from '../appearance.js';
import { ctx, view } from '../dom.js';
import { state } from '../state.js';
import { KEY, HEAD, ROW } from '../constants.js';
import { name, sharp } from '../music/pitch.js';
export function drawKeyboard() {
    const startRow = Math.floor(view.scrollTop / ROW), endRow = Math.ceil((view.scrollTop + state.height) / ROW);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, HEAD, KEY, state.height - HEAD);
    ctx.clip();
    ctx.fillStyle = palette.keyLine;
    ctx.fillRect(0, HEAD, KEY, state.height - HEAD);
    for (let row = startRow; row <= endRow; row++) {
        const p = state.topPitch - row, y = HEAD + row * ROW - view.scrollTop, active = p === state.previewPitch;
        ctx.fillStyle = active ? palette.playhead : sharp(p) ? palette.keyDark : palette.keyLight;
        ctx.fillRect(0, y, KEY, ROW - 1);
        ctx.fillStyle = active ? '#101820' : sharp(p) ? '#fff' : '#15181b';
        ctx.font = '11px Segoe UI';
        ctx.textBaseline = 'middle';
        ctx.fillText(name(p), 15, y + ROW / 2);
    }
    ctx.restore();
}
