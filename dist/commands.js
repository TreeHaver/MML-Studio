import { layout } from './viewport.js';
import { instruments } from './instruments.js';
import { info } from './inspector.js';
import { checkpoint } from './history.js';
import { input, status } from './dom.js';
import { state } from './state.js';
import { valid } from './model/validation.js';
export function refresh() { input('grid').value = String(state.project.grid); instruments(); info(); layout(); }
export function commitNotes(notes) { if (!valid(notes)) {
    status('That edit would create invalid timing or conflicting T instructions.');
    info();
    return;
} checkpoint(); state.project.notes = notes; refresh(); }
