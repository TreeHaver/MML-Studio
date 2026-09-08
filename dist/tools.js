import { $, input, status } from './dom.js';
import { state } from './state.js';
import { commitNotes } from './commands.js';
import { valid } from './model/validation.js';
import { simplifyTiming } from './music/simplify-timing.js';
import { removeOverlap } from './music/remove-overlap.js';
import { projectVolumes, shiftProjectVolumes, MAX_VOLUME } from './model/instrument-operations.js';
import { checkpoint } from './history.js';
import { refresh } from './commands.js';
/**
 * The whole piece moved by one amount. Doing it instrument by instrument would change the
 * balance between them, which is the arrangement; one amount for everything keeps both the
 * differences inside a part and the distances between the parts. The room available is the
 * room of the loudest instrument, since it reaches the cap first.
 */
export function shiftAllVolumes(delta) {
    const range = projectVolumes(state.project);
    if (!range) {
        status('There are no notes to change.');
        return;
    }
    if (!delta) {
        status('Type how much to move the volume by. Negative numbers lower it.');
        return;
    }
    if (delta > 0 && range.headroom <= 0) {
        status(`“${state.project.instruments[range.loudestInstrument].name}” is already at V${MAX_VOLUME}. Raising further would flatten it against the cap.`);
        return;
    }
    if (delta < 0 && range.min <= 0) {
        status(`“${state.project.instruments[range.quietestInstrument].name}” is already at V0. Lowering further would flatten it against silence.`);
        return;
    }
    const step = delta > 0 ? Math.min(delta, range.headroom) : Math.max(delta, -range.min);
    checkpoint();
    state.project = { ...state.project, notes: shiftProjectVolumes(state.project, step) };
    refresh();
    const after = projectVolumes(state.project);
    status(`Every instrument moved by ${step > 0 ? '+' : ''}${step}${step !== delta ? `, not ${delta > 0 ? '+' : ''}${delta}, which would have pushed “${state.project.instruments[range.loudestInstrument].name}” past the ends` : ''}. The piece now runs V${after.min} to V${after.max}.`);
}
export function installTools() {
    // The reading is refreshed each time the menu is opened, since the notes move underneath it.
    const volumeReading = () => {
        const range = projectVolumes(state.project);
        $('volume-reading').textContent = range
            ? `V${range.min} to V${range.max} of ${MAX_VOLUME}, ${range.headroom} left before “${state.project.instruments[range.loudestInstrument].name}” reaches the cap`
            : 'No notes yet.';
    };
    $('tools-menu').addEventListener('toggle', volumeReading);
    volumeReading();
    $('volume-apply').onclick = () => { shiftAllVolumes(Math.round(Number(input('volume-amount').value) || 0)); volumeReading(); };
    $('volume-max').onclick = () => {
        const range = projectVolumes(state.project);
        if (!range) {
            status('There are no notes to change.');
            return;
        }
        if (range.headroom <= 0) {
            status(`“${state.project.instruments[range.loudestInstrument].name}” is already at V${MAX_VOLUME}: there is no room left.`);
            return;
        }
        shiftAllVolumes(range.headroom);
        volumeReading();
    };
    $('remove-overlap').onclick = () => {
        if (state.project.instruments[state.active].isInstructions) {
            status('Select a musical instrument to remove note overlap.');
            return;
        }
        const result = removeOverlap(state.project, state.active);
        if (result.changed)
            commitNotes(result.notes);
        status(`Remove overlap: ${result.changed} notes shortened.${result.duplicates ? ` ${result.duplicates} simultaneous duplicates kept because cutting them would give zero length.` : ''}`);
    };
    input('simplify-length').value = '64';
    $('simplify-timing').onclick = () => {
        if (state.project.instruments[state.active].isInstructions) {
            status('Select a musical instrument to simplify its notes.');
            return;
        }
        const length = Number(input('simplify-length').value), range = state.segment?.projection.range;
        const result = simplifyTiming(state.project, state.active, length, range ? range.end - range.start : Infinity);
        if (!valid(result.notes)) {
            status('Timing unchanged: rounding would create conflicting instructions.');
            return;
        }
        if (result.changed)
            commitNotes(result.notes);
        status(`Simplify Timing L${length}: ${result.changed} notes changed; ${result.skipped} skipped to preserve notes that cannot fit. Undo restores the original timing.`);
    };
}
