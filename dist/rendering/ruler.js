import { measureLines } from '../music/structure.js';
import { palette } from '../appearance.js';
import { ctx, view } from '../dom.js';
import { state } from '../state.js';
import { KEY, HEAD } from '../constants.js';
export function drawRuler() {
    ctx.fillStyle = palette.ruler;
    ctx.fillRect(0, 0, state.width, HEAD);
    ctx.save();
    ctx.beginPath();
    ctx.rect(KEY, 0, state.width - KEY, HEAD);
    ctx.clip();
    for (const line of measureLines(state.project, view.scrollLeft / state.zoom, (view.scrollLeft + state.width) / state.zoom)) {
        if (!line.major)
            continue;
        const x = KEY + line.tick * state.zoom - view.scrollLeft;
        ctx.fillStyle = palette.bar;
        ctx.fillRect(x, 0, 1, HEAD);
        ctx.fillStyle = palette.text;
        ctx.font = '12px Segoe UI';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(line.bar), x + 9, HEAD / 2);
    }
    ctx.restore();
}
