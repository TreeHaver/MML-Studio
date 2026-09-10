import { ctx, view } from '../dom.js';
import { state } from '../state.js';
import { KEY, HEAD } from '../constants.js';
import { palette } from '../appearance.js';
/** Events and warnings share collision-free space immediately below the ruler. */
export function layoutCaptions(entries) {
    const result = [];
    ctx.font = '11px Segoe UI';
    for (const entry of entries.sort((a, b) => a.start - b.start)) {
        const onset = KEY + entry.start * state.zoom - view.scrollLeft;
        if (onset < KEY || onset >= state.width - 12)
            continue;
        const x = entry.wrap ? Math.max(KEY, Math.min(onset, state.width - 360)) : onset;
        const maxWidth = Math.min(entry.wrap ? 680 : 320, state.width - x - 8), lines = [];
        let text = entry.text;
        if (entry.wrap) {
            let line = '';
            for (const word of text.split(' ')) {
                const next = line ? `${line} ${word}` : word;
                if (line && ctx.measureText(next).width + 12 > maxWidth) {
                    lines.push(line);
                    line = word;
                }
                else
                    line = next;
            }
            lines.push(line);
        }
        else {
            if (ctx.measureText(text).width + 12 > maxWidth) {
                while (text.length && ctx.measureText(text + '…').width + 12 > maxWidth)
                    text = text.slice(0, -1);
                text += '…';
            }
            lines.push(text);
        }
        const w = Math.min(maxWidth, Math.max(...lines.map(line => ctx.measureText(line).width)) + 12), h = 20 + (lines.length - 1) * 16;
        let y = HEAD + 4;
        let collision;
        while ((collision = result.find(c => x + 3 < c.x + c.w + 8 && x + 3 + w + 8 > c.x && y < c.y + c.h + 4 && y + h + 4 > c.y)))
            y = collision.y + collision.h + 4;
        result.push({ ...entry, x: x + 3, y, w, h, lines });
    }
    return result;
}
export function drawCaptions(captions) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(KEY, HEAD, state.width - KEY, state.height - HEAD);
    ctx.clip();
    ctx.font = '11px Segoe UI';
    ctx.textBaseline = 'middle';
    for (const c of captions) {
        ctx.fillStyle = palette.ruler;
        ctx.fillRect(c.x, c.y, c.w, c.h);
        ctx.strokeStyle = c.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(c.x + .5, c.y + .5, c.w - 1, c.h - 1);
        ctx.fillStyle = palette.text;
        ctx.save();
        ctx.beginPath();
        ctx.rect(c.x, c.y, c.w, c.h);
        ctx.clip();
        c.lines.forEach((line, i) => ctx.fillText(line, c.x + 6, c.y + 10 + i * 16));
        ctx.restore();
    }
    ctx.restore();
}
