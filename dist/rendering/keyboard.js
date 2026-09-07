import { palette } from '../appearance.js';
import { ctx, view } from '../dom.js';
import { state } from '../state.js';
import { KEY, HEAD } from '../constants.js';
import { pitchTop, pitchAtY, pitchHeight } from '../music/pitch-layout.js';
import { name, sharp } from '../music/pitch.js';
export function drawKeyboard() {
    const firstPitch = pitchAtY(state.topPitch, view.scrollTop), lastPitch = pitchAtY(state.topPitch, view.scrollTop + state.height - HEAD);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, HEAD, KEY, state.height - HEAD);
    ctx.clip();
    ctx.fillStyle = palette.keyLine;
    ctx.fillRect(0, HEAD, KEY, state.height - HEAD);
    for (let p = firstPitch; p >= lastPitch; p--) {
        const y = HEAD + pitchTop(state.topPitch, p) - view.scrollTop, height = pitchHeight(p), active = p === state.previewPitch, isSharp = sharp(p);
        ctx.fillStyle = active ? palette.playhead : isSharp ? palette.keyDark : palette.keyLight;
        ctx.fillRect(0, y, KEY, height - 1);
        if (p % 12 === 0 && !active) {
            ctx.fillStyle = palette.cRow;
            ctx.fillRect(0, y, KEY, height - 1);
        }
        ctx.fillStyle = active ? '#101820' : isSharp ? '#fff' : '#15181b';
        ctx.font = '11px Segoe UI';
        ctx.textBaseline = 'middle';
        ctx.fillText(name(p), 15, y + height / 2);
    }
    ctx.restore();
}
