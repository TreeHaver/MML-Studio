import { $, input, status } from './dom.js';
import { state } from './state.js';
import { commitNotes } from './commands.js';
import { valid } from './model/validation.js';
import { simplifyTiming } from './music/simplify-timing.js';
import { removeOverlap } from './music/remove-overlap.js';
import { simplifyHeldNotes, simplifyChords } from './music/simplify-polyphony.js';
import { resolveVolumes } from './music/volume.js';
import { detectScale } from './music/scale.js';
import { fullProject } from './segment-session.js';
/** Main instrument first, then down the selection stack; note selections narrow scope. */
export function toolTargets() {
    const selected = state.project.notes.filter(n => state.selection.has(n.id));
    const stack = new Set(state.project.instruments[state.active]?.isInstructions ? [] : state.selectedInstruments);
    stack.delete(state.active);
    stack.add(state.active);
    const order = [...stack].reverse().filter(index => state.project.instruments[index] && !state.project.instruments[index].isInstructions);
    const notes = (selected.length ? selected : state.project.notes.filter(n => stack.has(n.instrument))).filter(n => !state.project.instruments[n.instrument]?.isInstructions);
    const groups = new Map();
    for (const note of notes) {
        const group = groups.get(note.instrument) ?? [];
        group.push(note);
        groups.set(note.instrument, group);
    }
    // Retain explicitly selected notes even if their owner is outside the current stack.
    return [...order, ...[...groups.keys()].filter(index => !stack.has(index))].flatMap(index => groups.get(index) ?? []);
}
function volumeRange() {
    const notes = toolTargets(), volumes = resolveVolumes(state.project.notes);
    if (!notes.length)
        return null;
    let min = 15, max = 0;
    for (const n of notes) {
        const v = volumes.get(n.id);
        min = Math.min(min, v);
        max = Math.max(max, v);
    }
    return { min, max, headroom: 15 - max };
}
export function shiftToolVolumes(delta) {
    const range = volumeRange();
    if (!range) {
        status('Select musical notes or a musical instrument.');
        return;
    }
    const step = delta, clamped = range.min + delta < 0 || range.max + delta > 15;
    if (!step) {
        status('Volume unchanged: choose a nonzero amount.');
        return;
    }
    const ids = new Set(toolTargets().map(n => n.id)), before = resolveVolumes(state.project.notes);
    let notes = state.project.notes.map(n => ids.has(n.id) ? { ...n, volume: Math.max(0, Math.min(15, before.get(n.id) + step)) } : n);
    const after = resolveVolumes(notes);
    // Materialize only when needed to keep untargeted inherited notes unchanged.
    notes = notes.map(n => !ids.has(n.id) && n.volume === null && after.get(n.id) !== before.get(n.id) ? { ...n, volume: before.get(n.id) } : n);
    if (notes.some((n, i) => n.volume !== state.project.notes[i].volume))
        commitNotes(notes);
    status('Volume: target notes moved by ' + (step > 0 ? '+' : '') + step + '.' + (clamped ? ' Warning: volumes were clamped to V0–V15; velocity differences may be flattened.' : ''));
}
function applyTool(label, convert, describe) {
    const selected = toolTargets(), ids = new Set(selected.map(n => n.id));
    if (!ids.size) {
        status('Select musical notes or a musical instrument.');
        return;
    }
    let project = state.project;
    const totals = { changed: 0 };
    for (const index of new Set(selected.map(n => n.instrument))) {
        const result = convert(project, index, ids);
        project = { ...project, notes: result.notes };
        for (const [key, value] of Object.entries(result))
            if (typeof value === 'number')
                totals[key] = (totals[key] ?? 0) + value;
    }
    if (!valid(project.notes)) {
        status(label + ': unchanged because the edit would conflict with instructions.');
        return;
    }
    if (totals.changed)
        commitNotes(project.notes);
    status(label + ': ' + describe(totals));
}
export function installTools() {
    const volumeReading = () => {
        const range = volumeRange(), delta = Math.round(Number(input('volume-amount').value) || 0);
        $('volume-reading').textContent = range ? 'Target notes: V' + range.min + ' to V' + range.max + ', ' + range.headroom + ' left before V15.' + (range.min + delta < 0 || range.max + delta > 15 ? ' Warning: Apply will clamp volumes to V0–V15 and may flatten velocity differences.' : '') : 'No musical target notes.';
    };
    input('volume-amount').oninput = volumeReading;
    $('tools-menu').addEventListener('toggle', volumeReading);
    volumeReading();
    $('volume-apply').onclick = () => { shiftToolVolumes(Math.round(Number(input('volume-amount').value) || 0)); volumeReading(); };
    $('volume-max').onclick = () => { const range = volumeRange(); if (range)
        shiftToolVolumes(range.headroom);
    else
        status('No musical target notes.'); volumeReading(); };
    $('remove-overlap').onclick = () => applyTool('Remove overlap', removeOverlap, r => r.shortened + ' notes shortened.' + (r.duplicates ? ' ' + r.duplicates + ' simultaneous duplicates deleted.' : ''));
    $('simplify-held-notes').onclick = () => applyTool('Held Note Simplifier', simplifyHeldNotes, r => r.changed + ' notes shortened.' + (r.unresolved ? ' ' + r.unresolved + ' onsets remain above 10 notes; fresh or unselected notes were retained.' : ''));
    const scaleReading = () => {
        const scale = detectScale(fullProject());
        $('scale-reading').textContent = scale ? 'Estimated: ' + scale.name + ' (' + Math.round(scale.coverage * 100) + '% weighted pitch fit). Also possible: ' + scale.alternative + '. Estimate only; songs may change key.' : 'No sounding melodic notes to estimate a scale.';
        return scale;
    };
    $('detect-scale').onclick = () => { scaleReading(); };
    input('chord-complexity').value = '2';
    input('chord-use-scale').checked = true;
    $('simplify-chords').onclick = () => {
        const complexity = Number(input('chord-complexity').value);
        if (!Number.isSafeInteger(complexity) || complexity < 2) {
            status('Chord Complexity must be a whole number of at least 2.');
            return;
        }
        const scale = input('chord-use-scale').checked ? scaleReading() : null;
        applyTool('Chord Simplifier', (project, index, ids) => simplifyChords(project, index, ids, complexity, scale?.pitches), r => r.removed + ' interior notes removed; at most ' + complexity + ' notes per chord.' + (r.protected ? ' ' + r.protected + ' instruction carriers retained beyond the limit to preserve conflicting settings.' : ''));
    };
    input('simplify-length').value = '64';
    $('simplify-timing').onclick = () => {
        const length = Number(input('simplify-length').value), range = state.segment?.projection.range;
        applyTool('Simplify Timing L' + length, (project, index, ids) => simplifyTiming(project, index, length, range ? range.end - range.start : Infinity, ids), r => r.changed + ' notes changed; ' + r.skipped + ' skipped to preserve notes that cannot fit. Undo restores the original timing.');
    };
}
