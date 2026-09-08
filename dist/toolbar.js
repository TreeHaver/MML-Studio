import { sections, signatureAt, signatureChangeTick, typedSignature } from './music/structure.js';
import { ensureInstructions } from './model/instructions.js';
import { layout } from './viewport.js';
import { draw } from './painting.js';
import { $, view, input } from './dom.js';
import { state } from './state.js';
import { checkpoint } from './history.js';
import { stopPlayback, seekToTick, playback } from './playback/transport.js';
import { refresh } from './commands.js';
import { status } from './dom.js';
import { sectionMarkers } from './model/segment-view.js';
export function setTool(value) { state.tool = value; for (const id of ['draw', 'select', 'spray'])
    $(id).classList.toggle('active', id === state.tool); }
const signatureTick = () => Math.max(0, Math.floor(playback.tick ?? view.scrollLeft / state.zoom));
export function refreshSignature() {
    const field = input('current-signature');
    if (document.activeElement !== field)
        field.value = signatureAt(state.project, signatureTick());
}
export function refreshStructure() {
    const list = $('section-nav'), previous = list.value, markers = sections(state.project);
    list.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Go to section';
    list.append(placeholder);
    for (const marker of markers) {
        const option = document.createElement('option');
        option.value = String(marker.start);
        option.textContent = marker.name;
        list.append(option);
    }
    list.value = markers.some(m => String(m.start) === previous) ? previous : '';
    $('section-control').hidden = state.segment ? state.segment.projection.range.kind === 'segment' || !sectionMarkers(state.project).some(m => !m.song && m.start > 0) : !markers.length;
    if ($('section-control').hidden)
        list.value = '';
}
export function installToolbar() {
    $('section-nav').onchange = () => { const value = input('section-nav').value; if (value === '')
        return; seekToTick(Number(value)); view.scrollLeft = Number(value) * state.zoom; draw(); };
    let editTick = 0;
    $('current-signature').onfocus = () => { editTick = signatureTick(); $('current-signature').classList.remove('invalid'); };
    $('current-signature').onchange = () => {
        const field = input('current-signature'), value = field.value.trim();
        if (state.segment && editTick >= state.segment.projection.range.end - state.segment.projection.range.start) {
            status('Choose a position inside the current view.');
            field.value = signatureAt(state.project, 0);
            return;
        }
        if (!typedSignature(value)) {
            field.classList.add('invalid');
            status('Use a time signature such as 3/4 or 6/8: 1–32 beats over 1, 2, 4, 8, 16, 32, 64 or 128.');
            return;
        }
        field.classList.remove('invalid');
        if (value === signatureAt(state.project, editTick)) {
            field.value = value;
            return;
        }
        const target = signatureChangeTick(state.project, editTick);
        checkpoint();
        const existing = state.project.notes.filter(n => state.project.instruments[n.instrument].isInstructions && n.start === target);
        if (existing.length) {
            for (const n of existing)
                n.timeSignature = value;
        }
        else
            state.project.notes.push({ id: state.project.notes.reduce((id, n) => Math.max(id, n.id), 0) + 1, instrument: ensureInstructions(state.project), start: target, length: 1, pitch: 60, volume: 0, timeSignature: value });
        refresh();
        status(`Time signature ${value} at measure start ${target}.`);
    };
    $('current-signature').onblur = () => { $('current-signature').classList.remove('invalid'); refreshSignature(); };
    $('draw').onclick = () => setTool('draw');
    $('select').onclick = () => setTool('select');
    $('spray').onclick = () => setTool('spray');
    for (const g of [4, 8, 16, 32, 64, 128]) {
        const option = document.createElement('option');
        option.value = String(g);
        option.textContent = 'L' + g;
        $('grid').append(option);
    }
    $('grid').onchange = () => { state.project.grid = Number(input('grid').value); draw(); };
    $('zoom').oninput = () => { const time = view.scrollLeft / state.zoom; state.zoom = Number(input('zoom').value); layout(); view.scrollLeft = time * state.zoom; draw(); };
    $('clear-all').onclick = () => { const count = state.project.notes.length; if (!count)
        return; if (!confirm(`Delete all ${count} notes and instructions from this project?\nYou can undo this action.`))
        return; stopPlayback(false); checkpoint(); state.project.notes = []; state.selection.clear(); refresh(); status(`Deleted all ${count} notes and instructions.`); };
}
