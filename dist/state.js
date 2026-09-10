import { fresh } from './model/project.js';
export const state = { project: fresh(), segment: null, active: 0, selectedInstruments: new Set(), selection: new Set(), tool: 'draw', zoom: 3, verticalZoom: 1, topPitch: 127, bottomPitch: 0, history: [], future: [], gesture: null, dirty: false, saved: '', width: 900, height: 600, previewPitch: null };
export const instrumentView = { vanillaOnly: false, search: '', mmlEpoch: 0, muted: new Set(), collapsed: new Set(), solo: null };
// Solo silences everything else without touching the explicit mutes, so they survive it.
export function isMuted(index) { return !state.project.instruments[index]?.isInstructions && (instrumentView.muted.has(index) || (instrumentView.solo !== null && !state.project.instruments[instrumentView.solo]?.isInstructions && instrumentView.solo !== index)); }
export function resetInstrumentView() { state.selectedInstruments.clear(); instrumentView.mmlEpoch++; instrumentView.muted.clear(); instrumentView.collapsed.clear(); instrumentView.solo = null; }
// The active instrument always participates; additional lanes are session selection only.
export function instrumentSelected(index) { return index === state.active || (!state.project.instruments[state.active]?.isInstructions && state.selectedInstruments.has(index) && !state.project.instruments[index]?.isInstructions); }
/** Promote an existing selection member without removing any selected notes/lanes. */
export function promoteInstrument(index) {
    if (state.gesture || !instrumentSelected(index) || state.project.instruments[index]?.isInstructions)
        return;
    const group = new Set(state.selectedInstruments);
    group.add(state.active);
    group.delete(index);
    group.add(index);
    state.active = index;
    state.selectedInstruments = group.size > 1 ? group : new Set();
}
/** Set insertion order is the selection stack; its last entry is the main lane.
 * An empty set is the existing single-active-lane reset convention. */
export function selectInstrument(index, toggle = false, range = false) {
    if (state.gesture || !state.project.instruments[index])
        return;
    const musical = (lane) => !!state.project.instruments[lane] && !state.project.instruments[lane].isInstructions;
    const group = new Set([...state.selectedInstruments].filter(musical));
    if (musical(state.active)) {
        group.delete(state.active);
        group.add(state.active);
    }
    if ((toggle || range) && musical(state.active) && musical(index)) {
        if (range) {
            const step = index >= state.active ? 1 : -1;
            for (let lane = state.active;; lane += step) {
                if (musical(lane)) {
                    group.delete(lane);
                    group.add(lane);
                }
                if (lane === index)
                    break;
            }
        }
        else if (group.has(index)) {
            if (group.size === 1)
                return;
            group.delete(index);
        }
        else
            group.add(index);
        state.active = [...group].at(-1);
    }
    else {
        group.clear();
        state.active = index;
    }
    state.selectedInstruments = group.size > 1 ? group : new Set();
    state.selection = new Set(state.project.notes.filter(n => state.selection.has(n.id) && instrumentSelected(n.instrument)).map(n => n.id));
}
