import { refreshHorizontalScroll } from './horizontal-scroll.js';
import { refreshScrollMarkers } from './scroll-markers.js';
import { drawCrowdedRegions, drawCrowdedMarkers, drawOverlapMarkers } from './rendering/note-density.js';
import { refreshSignature } from './toolbar.js';
import { refreshSegmentControls, drawSegmentBoundary } from './segment-view.js';
import { drawSheetLimit } from './rendering/sheet-limit.js';
import { palette } from './appearance.js';
import { playback, syncPlaybackControls } from './playback/transport.js';
import { view } from './dom.js';
import { ctx } from './dom.js';
import { state } from './state.js';
import { KEY, HEAD } from './constants.js';
import { drawGrid } from './rendering/grid.js';
import { drawNotes } from './rendering/notes.js';
import { drawRuler } from './rendering/ruler.js';
import { drawLoopSpan, drawLoopBar } from './rendering/loop-region.js';
import { drawKeyboard } from './rendering/keyboard.js';
import { drawInstructionLines, drawLoopRegions, drawTempoMarkers } from './rendering/tempo.js';
export function draw() {
    refreshHorizontalScroll();
    const moving = !!state.gesture?.movePreview;
    if (!moving) {
        syncPlaybackControls();
        refreshSignature();
        refreshSegmentControls();
        refreshScrollMarkers();
    }
    const { width, height } = state;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(KEY, HEAD, width - KEY, height - HEAD);
    ctx.clip();
    drawGrid();
    drawLoopSpan();
    if (!moving)
        drawLoopRegions();
    drawInstructionLines();
    if (!moving)
        drawCrowdedRegions();
    drawNotes();
    if (!moving)
        drawOverlapMarkers();
    ctx.restore();
    drawRuler();
    drawLoopBar();
    if (!moving)
        drawCrowdedMarkers();
    drawKeyboard();
    if (!moving)
        drawTempoMarkers();
    drawSegmentBoundary();
    if (!moving)
        drawSheetLimit();
    if (playback.tick !== null) {
        const x = KEY + playback.tick * state.zoom - view.scrollLeft;
        ctx.save();
        ctx.beginPath();
        ctx.rect(KEY, HEAD, width - KEY, height - HEAD);
        ctx.clip();
        ctx.fillStyle = palette.playhead;
        ctx.fillRect(x, HEAD, 2, height - HEAD);
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.rect(KEY, 0, width - KEY, HEAD);
        ctx.clip();
        ctx.fillStyle = palette.playhead;
        ctx.fillRect(x, 0, 2, HEAD);
        ctx.beginPath();
        ctx.moveTo(x - 5, 0);
        ctx.lineTo(x + 7, 0);
        ctx.lineTo(x + 1, 10);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}
