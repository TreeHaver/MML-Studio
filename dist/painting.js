import { playback } from './playback/transport.js';
import { view } from './dom.js';
import { ctx } from './dom.js';
import { state } from './state.js';
import { KEY, HEAD } from './constants.js';
import { drawGrid } from './rendering/grid.js';
import { drawNotes } from './rendering/notes.js';
import { drawRuler } from './rendering/ruler.js';
import { drawKeyboard } from './rendering/keyboard.js';
import { drawTempoMarkers } from './rendering/tempo.js';
export function draw() {
    const { width, height } = state;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#34373b';
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(KEY, HEAD, width - KEY, height - HEAD);
    ctx.clip();
    drawGrid();
    drawNotes();
    ctx.restore();
    drawRuler();
    drawKeyboard();
    drawTempoMarkers();
    if (playback.tick !== null) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(KEY, HEAD, width - KEY, height - HEAD);
        ctx.clip();
        ctx.fillStyle = '#72ecc8';
        ctx.fillRect(KEY + playback.tick * state.zoom - view.scrollLeft, HEAD, 2, height - HEAD);
        ctx.restore();
    }
}
