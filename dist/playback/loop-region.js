import { state } from '../state.js';
/**
 * A rehearsal loop: the stretch of the roll that playback repeats while you work on it.
 * It belongs to the session, not to the music - nothing is written to the project and
 * nothing reaches an export. The Loop Entry/Exit markers in Instructions are the musical
 * loops that the game plays; this one is only for your own ears, like a work area.
 * Ticks are source ticks, the same ones the playhead and the ruler use.
 */
export const loopRegion = { start: 0, end: 0, on: false };
export const loopSpan = () => Math.max(0, loopRegion.end - loopRegion.start);
export const looping = () => loopRegion.on && loopSpan() > 0;
/** Grid cells, offered while dragging with Ctrl for a loop that should sit on the bar. */
export function snapTick(tick) {
    const step = 128 / (state.project.grid || 4);
    return Math.max(0, Math.round(tick / step) * step);
}
/** Whole ticks, the finest position the editor has: the loop goes exactly where it is put. */
export const freeTick = (tick) => Math.max(0, Math.round(tick));
/**
 * Ends are free by default, so a loop can start and end anywhere in the bar; pass grid to
 * pull them onto the current grid instead. Returns false when both ends land on one tick,
 * which is what clears the loop - a shift-click with no drag, for instance.
 */
export function setLoopRegion(a, b, grid = false) {
    const place = grid ? snapTick : freeTick;
    const start = place(Math.min(a, b)), end = place(Math.max(a, b));
    if (end <= start) {
        clearLoopRegion();
        return false;
    }
    loopRegion.start = start;
    loopRegion.end = end;
    loopRegion.on = true;
    return true;
}
export function clearLoopRegion() { loopRegion.start = 0; loopRegion.end = 0; loopRegion.on = false; }
/** One 4/4 measure, the fallback span when a key marks an end with nothing on the far side. */
const MEASURE = 128;
/**
 * B and N trim the loop at the playhead. A video editor's work area already spans the whole
 * composition, so trimming one end always leaves something visible; with no loop yet, the
 * far end takes the end of the music instead, which keeps that behaviour here.
 */
export function markLoopStart(tick, musicEnd = 0, grid = false) {
    const place = grid ? snapTick : freeTick, start = place(tick);
    const far = loopSpan() > 0 && loopRegion.end > start ? loopRegion.end : Math.max(start + MEASURE, place(musicEnd));
    return setLoopRegion(start, far, grid);
}
export function markLoopEnd(tick, grid = false) {
    const place = grid ? snapTick : freeTick, end = place(tick);
    const near = loopSpan() > 0 && loopRegion.start < end ? loopRegion.start : Math.max(0, end - MEASURE);
    return setLoopRegion(near, end, grid);
}
/** Puts an existing loop onto the current grid. An action you ask for, not a mode. */
export function alignLoopToGrid() {
    if (loopSpan() <= 0)
        return false;
    const on = loopRegion.on, placed = setLoopRegion(loopRegion.start, loopRegion.end, true);
    loopRegion.on = placed && on;
    return placed;
}
/** Keeps the region while it is switched off, so it can be brought back unchanged. */
export function toggleLoop() { if (loopSpan() > 0)
    loopRegion.on = !loopRegion.on; return looping(); }
/** Which end the pointer is on, so an existing loop can be dragged wider or narrower. */
export function loopEdgeAt(tick, tolerance) {
    if (loopSpan() <= 0)
        return null;
    const toStart = Math.abs(tick - loopRegion.start), toEnd = Math.abs(tick - loopRegion.end);
    if (Math.min(toStart, toEnd) > tolerance)
        return null;
    return toStart <= toEnd ? 'start' : 'end';
}
