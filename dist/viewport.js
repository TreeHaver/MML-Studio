import { draw } from './painting.js';
import { $, canvas, ctx, view } from './dom.js';
import { state } from './state.js';
import { KEY, HEAD } from './constants.js';
import { pitchTop, pitchHeight } from './music/pitch-layout.js';
import { playheadScroll } from './playback/follow.js';
export function followPlayback(tick) {
    const left = playheadScroll(tick, state.zoom, view.clientWidth, view.scrollLeft, KEY);
    if (left !== view.scrollLeft)
        view.scrollLeft = left;
}
export function layout() {
    const notes = state.project.notes;
    let nt = 127, nb = 0, end = 4096;
    for (const n of notes) {
        nt = Math.max(nt, n.pitch + 12);
        nb = Math.min(nb, n.pitch - 12);
        end = Math.max(end, n.start + n.length + 512);
    }
    if (state.segment)
        end = state.segment.projection.range.end - state.segment.projection.range.start;
    if (nt !== state.topPitch) {
        view.scrollTop += pitchTop(nt, state.topPitch);
        state.topPitch = nt;
    }
    state.bottomPitch = nb;
    state.width = view.clientWidth;
    state.height = view.clientHeight;
    const dpr = devicePixelRatio || 1;
    canvas.width = Math.round(state.width * dpr);
    canvas.height = Math.round(state.height * dpr);
    canvas.style.width = state.width + 'px';
    canvas.style.height = state.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    $('extent').style.width = (KEY + end * state.zoom) + 'px';
    $('extent').style.height = (HEAD + pitchTop(state.topPitch, state.bottomPitch) + pitchHeight(state.bottomPitch)) + 'px';
    draw();
}
