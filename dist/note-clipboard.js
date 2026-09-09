import { importMml } from './import/mml.js';
import { ensureInstructions, hasInstructions } from './model/instructions.js';
import { advancedInstructions } from './advanced-instructions.js';
import { state, isMuted, instrumentSelected } from './state.js';
import { checkpoint } from './history.js';
import { refresh } from './commands.js';
import { status } from './dom.js';
import { valid } from './model/validation.js';
import { fitsCurrentView } from './segment-session.js';
import { resolveVolumes } from './music/volume.js';
let clipboard = null;
let position = null;
export function setPastePosition(tick) { position = tick; status('MML text insertion position set. Copied notes paste after the selection, or at their original position.'); }
export function copyNotes() {
    if (state.gesture)
        return;
    const selected = state.project.notes.filter(n => instrumentSelected(n.instrument) && state.selection.has(n.id));
    if (!selected.length) {
        status('Select notes to copy.');
        return;
    }
    const start = selected.reduce((min, n) => Math.min(min, n.start), Infinity);
    const volumes = resolveVolumes(state.project.notes);
    clipboard = { notes: selected.map(n => ({ ...n, start: n.start - start, volume: volumes.get(n.id) })), instructions: !!state.project.instruments[state.active].isInstructions, start };
    status(`Copied ${selected.length} notes/events. Ctrl+V pastes after the current selection, or at the original copy position when nothing is selected.`);
}
export function pasteNotes() {
    if (state.gesture)
        return;
    if (!clipboard) {
        status('Copy a selection with Ctrl+C first.');
        return;
    }
    if (isMuted(state.active)) {
        status('Unmute this instrument to paste notes.');
        return;
    }
    if (clipboard.instructions !== !!state.project.instruments[state.active].isInstructions) {
        status('Paste musical notes into a musical instrument, or silent events into Instructions.');
        return;
    }
    let id = state.project.notes.reduce((max, n) => Math.max(max, n.id), 0);
    const selected = state.project.notes.filter(n => instrumentSelected(n.instrument) && state.selection.has(n.id));
    const start = selected.length ? selected.reduce((end, n) => Math.max(end, n.start + n.length), 0) : clipboard.start;
    const added = clipboard.notes.map(n => ({ ...n, id: ++id, instrument: state.active, start: start + n.start }));
    const notes = [...state.project.notes, ...added];
    if (!fitsCurrentView({ ...state.project, notes })) {
        status('The pasted notes extend beyond this view. Return to Project to paste across its boundary.');
        return;
    }
    if (!valid(notes)) {
        status('Cannot paste here: the copied tempo instructions conflict with an existing tempo change.');
        return;
    }
    checkpoint();
    state.project.notes = notes;
    state.selection = new Set(added.map(n => n.id));
    refresh();
    status(`Pasted ${added.length} notes/events. Drag the selected group to move it; Undo restores the previous project.`);
}
export function pasteMml(text) {
    if (!text.trim())
        return false;
    try {
        const imported = importMml(text);
        if (state.gesture || isMuted(state.active) || state.project.instruments[state.active].isInstructions) {
            status('Select an unmuted musical instrument to paste MML.');
            return true;
        }
        const project = structuredClone(state.project), start = position ?? 0;
        let id = project.notes.reduce((max, n) => Math.max(max, n.id), 0);
        const added = imported.project.notes.map(n => ({ ...n, id: ++id, start: start + n.start, instrument: imported.project.instruments[n.instrument].isInstructions ? ensureInstructions(project) : state.active }));
        project.notes.push(...added);
        if (!fitsCurrentView(project)) {
            status('The pasted MML extends beyond this view. Return to Project to paste across its boundary.');
            return true;
        }
        if (!valid(project.notes)) {
            status('Cannot paste MML: conflicting global tempo instructions.');
            return true;
        }
        checkpoint();
        state.project = project;
        state.selection = new Set(added.map(n => n.id));
        position = start + imported.span;
        if (hasInstructions(imported.project))
            advancedInstructions.enabled = true;
        refresh();
        status('Pasted ' + imported.noteCount + ' MML notes. ' + imported.warnings.join(' '));
        return true;
    }
    catch (error) {
        status('Text is not supported MML: ' + error);
        return false;
    }
}
