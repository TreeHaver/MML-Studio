import { state, instrumentView, resetInstrumentView } from './state.js';
import { checkpoint } from './history.js';
import { refresh } from './commands.js';
import { status } from './dom.js';
import { stopPlayback } from './playback/transport.js';
import { deleteInstrument, mergeInstruments } from './model/instrument-operations.js';
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
    state.project = project;
    state.active = active;
    state.selection.clear();
    state.gesture = null;
    refresh();
}
export function removeInstrument(index) {
    const instrument = state.project.instruments[index];
    if (!instrument)
        return;
    const notes = state.project.notes.filter(n => n.instrument === index), tempos = notes.filter(n => n.tempo != null).length;
    const contents = `${notes.length} notes/events${tempos ? `, including ${tempos} global tempo instructions` : ''}`, last = state.project.instruments.length === 1;
    if (notes.length && !confirm(last
        ? `“${instrument.name}” is the only instrument, so it cannot be deleted — it will be emptied instead.\nIts ${contents} will be cleared and it will be reset to an empty Piano.\nYou can undo this.`
        : `Delete “${instrument.name}” and its ${contents}?\nYou can undo this.`))
        return;
    const active = state.active === index ? Math.max(0, Math.min(index, state.project.instruments.length - 2)) : state.active > index ? state.active - 1 : state.active;
    apply(deleteInstrument(state.project, index), index, active);
    status(`${last ? 'Emptied' : 'Deleted'} “${instrument.name}”. Undo to restore it.`);
}
export function mergeInstrument(source, target) {
    try {
        const result = mergeInstruments(state.project, source, target), from = state.project.instruments[source], to = state.project.instruments[target];
        const count = state.project.notes.filter(n => n.instrument === source).length;
        const warning = result.volumeConflict ? '\nSome simultaneous notes have different volumes. After merging, they will share one volume at each position, so their loudness may change.' : '';
        if (!confirm(`Move all ${count} notes/events and their tempo instructions from “${from.name}” into “${to.name}”, then delete “${from.name}”?\nThe destination keeps its name, color, playback preset and mute state.${warning}\nYou can undo this.`))
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
        if (other === index || !!instrument.isInstructions !== !!state.project.instruments[index].isInstructions)
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
    body.append(destination, merge);
    box.append(summary, body);
    row.append(box);
}
