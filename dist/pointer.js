import { anchor, point, musical, hit, edge, boxIds } from './geometry.js';
import { layout } from './viewport.js';
import { draw } from './painting.js';
import { info } from './inspector.js';
import { commitNotes } from './commands.js';
import { canvas, status } from './dom.js';
import { state, isMuted } from './state.js';
import { KEY, HEAD, ROW, threshold } from './constants.js';
import { snap } from './music/timing.js';
import { valid } from './model/validation.js';
import { move, resize } from './music/note-operations.js';
import { previewNote } from './playback/preview.js';
import { tempoAt } from './music/tempo.js';
export function endGesture(cancel = false) { if (!state.gesture)
    return; if (cancel && state.gesture.before)
    state.project = JSON.parse(state.gesture.before); state.gesture = null; canvas.style.cursor = 'default'; info(); layout(); }
export function installPointer() {
    canvas.onpointerdown = e => {
        if (e.button !== 0 && e.button !== 2)
            return;
        const p = point(e);
        if (p.y < HEAD)
            return;
        if (p.x < KEY) {
            if (e.button === 0 && p.x >= 0 && !isMuted(state.active)) {
                e.preventDefault();
                canvas.focus();
                const instrument = state.project.instruments[state.active];
                if (instrument.isInstructions) {
                    status('Instructions are silent. Draw a marker in the roll and set its tempo.');
                    return;
                }
                void previewNote(musical(p).pitch, instrument.midiProgram ?? 0, instrument.isDrum === true);
            }
            return;
        }
        if (isMuted(state.active)) {
            status('Unmute this instrument to edit its notes.');
            return;
        }
        e.preventDefault();
        canvas.focus();
        const n = hit(p);
        if (e.button === 2) {
            if (n)
                commitNotes(state.project.notes.filter(o => o.id !== n.id));
            state.selection.delete(n?.id ?? -1);
            info();
            return;
        }
        const add = e.ctrlKey || e.metaKey;
        const before = JSON.stringify(state.project);
        const m = musical(p);
        if (e.shiftKey || (!n && state.tool === 'select'))
            state.gesture = { kind: 'box', start: p, current: p, music: m, add, before };
        else if (n) {
            if (add) {
                if (state.selection.has(n.id))
                    state.selection.delete(n.id);
                else
                    state.selection.add(n.id);
                info();
                draw();
                return;
            }
            const already = state.selection.has(n.id);
            if (!already) {
                state.selection = new Set([n.id]);
            }
            if (edge(n, p))
                state.gesture = { kind: 'resize', start: p, current: p, nid: n.id, base: structuredClone(state.project.notes), length: n.length, before };
            else if (already)
                state.gesture = { kind: 'move', start: p, current: p, base: structuredClone(state.project.notes), anchor: [...state.selection][0], before };
            else
                state.gesture = { kind: 'click', start: p, current: p, before };
        }
        else {
            const start = Math.max(0, snap(m.tick, state.project.grid)), instructions = state.project.instruments[state.active].isInstructions;
            const newNote = { id: state.project.notes.reduce((id, n) => Math.max(id, n.id), 0) + 1, instrument: state.active, start, length: instructions ? 1 : 128 / state.project.grid, pitch: m.pitch, volume: instructions ? 0 : null, ...(instructions ? { tempo: tempoAt(state.project.notes, start) } : {}) };
            if (!valid([...state.project.notes, newNote]))
                return;
            state.project.notes.push(newNote);
            state.selection = new Set([newNote.id]);
            state.gesture = { kind: instructions ? 'instruction-create' : 'create', start: p, current: p, nid: newNote.id, before };
        }
        canvas.setPointerCapture(e.pointerId);
        info();
        draw();
    };
    canvas.onpointermove = e => {
        const p = point(e);
        if (!state.gesture) {
            const n = p.x >= KEY && p.y >= HEAD ? hit(p) : undefined;
            canvas.style.cursor = n && edge(n, p) ? 'ew-resize' : 'default';
            return;
        }
        state.gesture.current = p;
        const dx = p.x - state.gesture.start.x, dy = p.y - state.gesture.start.y;
        if (Math.hypot(dx, dy) < threshold && !state.gesture.moved) {
            draw();
            return;
        }
        state.gesture.moved = true;
        if (state.gesture.kind === 'move')
            state.project.notes = move(state.gesture.base, state.selection, state.gesture.anchor, dx / state.zoom, state.project.instruments[state.active].isInstructions ? 0 : Math.round(-dy / ROW), state.project.grid);
        if (state.gesture.kind === 'resize')
            state.project.notes = resize(state.gesture.base, state.gesture.nid, state.gesture.length + dx / state.zoom, state.project.grid);
        if (state.gesture.kind === 'create') {
            const n = state.project.notes.find(n => n.id === state.gesture.nid);
            const len = Math.max(128 / state.project.grid, snap(musical(p).tick - n.start, state.project.grid));
            const next = state.project.notes.map(o => o === n ? { ...n, length: len } : o);
            if (valid(next))
                state.project.notes = next;
        }
        info();
        draw();
    };
    canvas.onpointerup = e => {
        if (!state.gesture)
            return;
        if (state.gesture.kind === 'box') {
            const ids = boxIds(state.gesture.music, musical(state.gesture.current));
            state.selection = state.gesture.add ? new Set([...state.selection, ...ids]) : new Set(ids);
        }
        if (JSON.stringify(state.project) !== state.gesture.before) {
            state.history.push(state.gesture.before);
            state.future = [];
            state.dirty = true;
        }
        endGesture();
        if (canvas.hasPointerCapture(e.pointerId))
            canvas.releasePointerCapture(e.pointerId);
    };
    canvas.onpointercancel = () => endGesture(true);
    canvas.onlostpointercapture = () => { if (state.gesture)
        endGesture(true); };
    canvas.oncontextmenu = e => e.preventDefault();
}
