import { layout } from './viewport.js';
import { instruments } from './instruments.js';
import { info } from './inspector.js';
import { checkpoint } from './history.js';
import { input, status } from './dom.js';
import { state } from './state.js';
import { valid } from './model/validation.js';
import { syncSegment, fitsCurrentView } from './segment-session.js';
export function refresh() { syncSegment(); input('project-name').value = state.project.name || 'Untitled'; input('grid').value = String(state.project.grid); instruments(); info(); layout(); }
export function commitNotes(notes) { if (!fitsCurrentView({ ...state.project, notes })) {
    status('This edit extends beyond the current view. Return to Project to edit across its boundary.');
    info();
    return;
} if (!valid(notes)) {
    status('That edit would create invalid timing or conflicting tempo, time signature or section instructions.');
    info();
    return;
} checkpoint(); state.project.notes = notes; refresh(); }
