import { state, instrumentView, resetInstrumentView } from './state.js';
import { checkpoint } from './history.js';
import { refresh } from './commands.js';
import { status } from './dom.js';
import { stopPlayback } from './playback/transport.js';
import { deleteInstrument, mergeInstruments, splitNotes, splitDrumkit, parseSplitPitch } from './model/instrument-operations.js';
import { removeSegmentInstrument } from './segment-session.js';
function apply(project, source, active) {
    stopPlayback(false);
    checkpoint();
    const muted = [...instrumentView.muted], collapsed = [...instrumentView.collapsed], solo = instrumentView.solo;
    resetInstrumentView();
    if (state.project.instruments.length > 1) {
        for (const [values, set] of [[muted, instrumentView.muted], [collapsed, instrumentView.collapsed]])
            for (const index of values)
                if (index !== source)
                    set.add(index > source ? index - 1 : index);
        if (solo !== null && solo !== source)
            instrumentView.solo = solo > source ? solo - 1 : solo;
    }
    removeSegmentInstrument(source);
    state.project = project;
    state.active = active;
    state.selection.clear();
    state.gesture = null;
    refresh();
}
export function removeInstrument(index) {
    const instrument = state.project.instruments[index];
    if (!instrument || instrument.isInstructions)
        return;
    const notes = state.project.notes.filter(n => n.instrument === index), tempos = notes.filter(n => n.tempo != null).length;
    const contents = `${notes.length} notes/events${tempos ? `, including ${tempos} global tempo instructions` : ''}`, last = state.project.instruments.filter(i => !i.isInstructions).length === 1;
    if (state.segment) {
        if (!notes.length) {
            status('This instrument has no notes in the current view.');
            return;
        }
        if (!confirm(`Remove ${contents} from “${instrument.name}” in this view?\nThe shared instrument and notes outside this view remain. You can undo this.`))
            return;
        stopPlayback(false);
        checkpoint();
        state.project.notes = state.project.notes.filter(n => n.instrument !== index);
        state.selection.clear();
        state.gesture = null;
        refresh();
        status(`Cleared “${instrument.name}” inside this view. Undo to restore.`);
        return;
    }
    if (notes.length && !confirm(last
        ? `“${instrument.name}” is the only instrument, so it cannot be deleted — it will be emptied instead.\nIts ${contents} will be cleared and it will be reset to an empty Piano.\nYou can undo this.`
        : `Delete “${instrument.name}” and its ${contents}?\nYou can undo this.`))
        return;
    if (last) {
        stopPlayback(false);
        checkpoint();
        state.project = deleteInstrument(state.project, index);
        instrumentView.muted.delete(index);
        instrumentView.collapsed.delete(index);
        if (instrumentView.solo === index)
            instrumentView.solo = null;
        state.selection.clear();
        state.gesture = null;
        refresh();
        status(`Emptied “${instrument.name}”. Undo to restore it.`);
        return;
    }
    const active = state.active === index ? Math.max(0, Math.min(index, state.project.instruments.length - 2)) : state.active > index ? state.active - 1 : state.active;
    apply(deleteInstrument(state.project, index), index, active);
    status(`${last ? 'Emptied' : 'Deleted'} “${instrument.name}”. Undo to restore it.`);
}
export function mergeInstrument(source, target) {
    try {
        const result = mergeInstruments(state.project, source, target), from = state.project.instruments[source], to = state.project.instruments[target];
        const count = state.project.notes.filter(n => n.instrument === source).length;
        const scope = state.segment ? ' inside this view? Notes outside the view and the shared source instrument remain.' : `, then delete “${from.name}”?`;
        if (!confirm(`Move all ${count} notes/events and their tempo instructions from “${from.name}” into “${to.name}”${scope}\nThe destination keeps its name, color, playback preset and mute state.\nYou can undo this.`))
            return;
        apply(result.project, source, target > source ? target - 1 : target);
        status(`Merged “${from.name}” into “${to.name}”. Undo to restore both.`);
    }
    catch (error) {
        status(String(error));
    }
}
export function instrumentActions(row, index) {
    const box = document.createElement('details');
    box.className = 'instrument-actions';
    const summary = document.createElement('summary');
    summary.textContent = 'Instrument actions';
    const body = document.createElement('div');
    body.className = 'instrument-action-body';
    const destination = document.createElement('select');
    destination.className = 'instrument-destination';
    destination.setAttribute('aria-label', 'Merge destination for ' + state.project.instruments[index].name);
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Merge into…';
    destination.append(placeholder);
    state.project.instruments.forEach((instrument, other) => {
        if (other === index || instrument.isInstructions)
            return;
        const option = document.createElement('option');
        option.value = String(other);
        option.textContent = `${other + 1}. ${instrument.name}`;
        destination.append(option);
    });
    destination.value = '';
    destination.disabled = destination.children.length === 1;
    destination.title = destination.disabled ? 'Add another instrument of the same kind to merge.' : 'Destination keeps its sound and settings.';
    const merge = document.createElement('button');
    merge.textContent = 'Merge';
    merge.disabled = true;
    merge.onclick = () => { if (destination.value !== '')
        mergeInstrument(index, Number(destination.value)); };
    destination.onchange = () => { merge.disabled = destination.value === ''; };
    if (!state.project.instruments[index].isInstructions) {
        const label = document.createElement('label');
        label.className = 'instrument-split-label';
        label.textContent = 'Split Notes';
        const pitch = document.createElement('input');
        pitch.type = 'text';
        pitch.placeholder = 'B1';
        pitch.setAttribute('aria-label', 'Note to split');
        label.append(pitch);
        const target = document.createElement('select');
        target.setAttribute('aria-label', 'Split destination instrument');
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = 'Instruments…';
        target.append(empty);
        state.project.instruments.forEach((instrument, other) => { if (other === index || instrument.isInstructions)
            return; const option = document.createElement('option'); option.value = String(other); option.textContent = instrument.name; target.append(option); });
        target.value = '';
        const split = document.createElement('button');
        split.textContent = 'Split';
        split.onclick = () => { if (target.value === '') {
            status('Choose a destination instrument.');
            return;
        } splitInstrumentNote(index, Number(target.value), pitch.value); };
        body.append(label, target, split);
        if (state.project.instruments[index].isDrum) {
            const kit = document.createElement('button');
            kit.className = 'instrument-split-kit';
            kit.textContent = 'Split Drumkit';
            kit.onclick = () => splitKitInstrument(index);
            body.append(kit);
        }
    }
    body.append(destination, merge);
    box.append(summary, body);
    row.append(box);
    return body;
}
function applySplit(project, count) {
    if (!count) {
        status('No matching notes to split.');
        return;
    }
    stopPlayback(false);
    checkpoint();
    state.project = project;
    state.selection.clear();
    state.gesture = null;
    refresh();
    status('Moved ' + count + ' notes. Undo to restore.');
}
export function splitInstrumentNote(source, target, text) {
    try {
        const result = splitNotes(state.project, source, target, parseSplitPitch(text));
        applySplit(result.project, result.count);
    }
    catch (error) {
        status(String(error));
    }
}
export function splitKitInstrument(source) {
    try {
        const result = splitDrumkit(state.project, source);
        applySplit(result.project, result.count);
    }
    catch (error) {
        status(String(error));
    }
}
