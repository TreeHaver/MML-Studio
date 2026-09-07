import { valid } from '../model/validation.js';
import { snap } from './timing.js';
export function move(notes, ids, anchor, dt, dp, grid) {
    const a = notes.find(n => n.id === anchor);
    const delta = snap(a.start + dt, grid) - a.start;
    const result = notes.map(n => ids.has(n.id) ? { ...n, start: n.start + delta, pitch: n.pitch + dp } : n);
    return valid(result) ? result : notes;
}
/** A new note may also be drawn backwards: its end stays in the cell the drag started in. */
export function stretchBack(notes, id, start, end) {
    const result = notes.map(n => n.id === id ? { ...n, start, length: end - start } : n);
    return valid(result) ? result : notes;
}
export function resize(notes, id, length, grid) {
    const result = notes.map(n => n.id === id ? { ...n, length: Math.max(128 / grid, snap(length, grid)) } : n);
    return valid(result) ? result : notes;
}
