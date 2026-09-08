import { instructionCaptionHit, instructionLineHit } from './rendering/tempo.js';
import { playbackPitch } from './playback/drums.js';
import { anchor, point, musical, hit, edge, boxIds } from './geometry.js';
import { layout } from './viewport.js';
import { draw } from './painting.js';
import { info } from './inspector.js';
import { refresh } from './commands.js';
import { historySnapshot, fitsCurrentView } from './segment-session.js';
import { canvas, status, view } from './dom.js';
import { state, isMuted } from './state.js';
import { KEY, HEAD, threshold } from './constants.js';
import { pitchTop, pitchAtY, pitchHeight } from './pitch-viewport.js';
import { cellStart } from './music/timing.js';
import { valid } from './model/validation.js';
import { move, resize, stretchBack } from './music/note-operations.js';
import { previewNote } from './playback/preview.js';
import { seekToTick } from './playback/transport.js';
import { setPastePosition } from './note-clipboard.js';
let stopEdgeScroll = () => { };
export function endGesture(cancel = false) { stopEdgeScroll(); if (!state.gesture)
    return; if (cancel && state.gesture.before)
    state.project = JSON.parse(state.gesture.before); state.gesture = null; canvas.style.cursor = 'default'; if (state.segment)
    refresh();
else {
    info();
    layout();
} }
export function installPointer() {
    const paint = (from, to) => { const gesture = state.gesture, step = 128 / state.project.grid; if (!gesture || gesture.kind !== 'paint')
        return; const a = Math.floor(Math.max(0, from.tick) / step), b = Math.floor(Math.max(0, to.tick) / step), count = Math.max(Math.abs(b - a), Math.abs(to.pitch - from.pitch)); for (let i = 1; i <= count; i++) {
        const cell = Math.round(a + (b - a) * i / count), pitch = Math.round(from.pitch + (to.pitch - from.pitch) * i / count), start = cell * step, key = `${start}:${pitch}`;
        if (gesture.painted.has(key))
            continue;
        gesture.painted.add(key);
        const next = { id: state.project.notes.reduce((id, n) => Math.max(id, n.id), 0) + 1, instrument: state.active, start, length: step, pitch, volume: null };
        if (valid([...state.project.notes, next])) {
            state.project.notes.push(next);
            state.selection.add(next.id);
        }
    } };
    // Right button erases: a click removes one note, holding it removes everything it crosses.
    const eraseAt = (p) => { let removed = false, note; while ((note = hit(p))) {
        state.project.notes = state.project.notes.filter(o => o.id !== note.id);
        state.selection.delete(note.id);
        removed = true;
    } return removed; };
    // Sample the path so a fast drag cannot jump over a note between two move events.
    const eraseTrail = (from, to) => { const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 4)); let removed = false; for (let i = 1; i <= steps; i++)
        if (eraseAt({ x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps }))
            removed = true; return removed; };
    let keyGesture = null;
    let scrubbing = false;
    // Box selection scrolls both axes; moving notes scrolls horizontally near the roll edges.
    const EDGE = 52, EDGE_SPEED = 20;
    let edgeFrame = 0, edgePoint = null;
    stopEdgeScroll = () => { if (edgeFrame)
        cancelAnimationFrame(edgeFrame); edgeFrame = 0; edgePoint = null; };
    const moveSelection = () => {
        const g = state.gesture;
        const dx = g.current.x - g.start.x + view.scrollLeft - g.scrollLeft;
        const dy = g.current.y - g.start.y + view.scrollTop - g.scrollTop;
        const note = g.base.find((n) => n.id === g.anchor);
        const pitch = pitchAtY(state.topPitch, pitchTop(state.topPitch, note.pitch) + pitchHeight(note.pitch) / 2 + dy);
        state.project.notes = move(g.base, state.selection, g.anchor, dx / state.zoom, state.project.instruments[state.active].isInstructions ? 0 : pitch - note.pitch, state.project.grid);
    };
    const edgeScroll = () => {
        const gesture = state.gesture, p = edgePoint;
        if (!gesture || !['box', 'move'].includes(gesture.kind) || !p) {
            edgeFrame = 0;
            return;
        }
        const speed = (gap) => Math.round(EDGE_SPEED * Math.min(1, Math.max(0, EDGE - gap) / EDGE));
        let dx = 0, dy = 0;
        if (p.x < KEY + EDGE)
            dx = -speed(p.x - KEY);
        else if (p.x > state.width - EDGE)
            dx = speed(state.width - p.x);
        if (gesture.kind === 'box') {
            if (p.y < HEAD + EDGE)
                dy = -speed(p.y - HEAD);
            else if (p.y > state.height - EDGE)
                dy = speed(state.height - p.y);
        }
        if (dx || dy) {
            view.scrollLeft = Math.max(0, view.scrollLeft + dx);
            view.scrollTop = Math.max(0, view.scrollTop + dy);
            if (gesture.kind === 'move') {
                moveSelection();
                layout();
            }
            info();
            draw();
        }
        edgeFrame = requestAnimationFrame(edgeScroll);
    };
    let keyHighlightTimer;
    const previewKey = (p) => { const instrument = state.project.instruments[state.active], pitch = musical(p).pitch; if (pitch < 0 || pitch > 127)
        return; state.previewPitch = pitch; draw(); if (keyHighlightTimer !== undefined)
        window.clearTimeout(keyHighlightTimer); keyHighlightTimer = window.setTimeout(() => { if (state.previewPitch === pitch) {
        state.previewPitch = null;
        draw();
    } }, 500); void previewNote(playbackPitch(instrument, pitch), instrument.midiProgram ?? 0, instrument.isDrum === true || !!instrument.ms2Drum); return pitch; };
    canvas.onpointerdown = e => {
        if (e.button !== 0 && e.button !== 2)
            return;
        const p = point(e);
        if (p.y < HEAD) {
            if (e.button === 0 && p.x >= KEY) {
                e.preventDefault();
                scrubbing = true;
                canvas.setPointerCapture(e.pointerId);
                seekToTick(musical(p).tick);
            }
            return;
        }
        if (p.x < KEY) {
            if (e.button === 0 && p.x >= 0 && !isMuted(state.active)) {
                e.preventDefault();
                canvas.focus();
                const instrument = state.project.instruments[state.active];
                if (instrument.isInstructions) {
                    status('Instructions are silent. Draw a marker in the roll and edit its tempo, time signature or section.');
                    return;
                }
                const pitch = previewKey(p);
                if (pitch === undefined)
                    return;
                keyGesture = { pointerId: e.pointerId, pitch };
            }
            return;
        }
        const marker = instructionCaptionHit(p) ?? (!hit(p) ? instructionLineHit(p) : undefined);
        if (e.button === 0 && marker && marker.instrument !== state.active) {
            state.active = marker.instrument;
            state.selection = new Set([marker.id]);
            refresh();
            draw();
            return;
        }
        if (isMuted(state.active)) {
            status('Unmute this instrument to edit its notes.');
            return;
        }
        e.preventDefault();
        canvas.focus();
        const n = hit(p);
        const add = e.ctrlKey || e.metaKey;
        const before = JSON.stringify(state.project);
        const m = musical(p);
        if (e.button === 2) {
            state.gesture = { kind: 'erase', start: p, current: p, last: p, before };
            canvas.setPointerCapture(e.pointerId);
            eraseAt(p);
            info();
            draw();
            return;
        }
        if (e.shiftKey || (!n && state.tool === 'select'))
            state.gesture = { kind: 'box', start: p, current: p, origin: { x: p.x + view.scrollLeft, y: p.y + view.scrollTop }, music: m, add, before };
        else if (n) {
            const already = state.selection.has(n.id);
            if (state.tool === 'select') {
                if (add) {
                    if (already)
                        state.selection.delete(n.id);
                    else
                        state.selection.add(n.id);
                    info();
                    draw();
                    return;
                }
                if (!already)
                    state.selection = new Set([n.id]);
                if (edge(n, p))
                    state.gesture = { kind: 'resize', start: p, current: p, nid: n.id, base: structuredClone(state.project.notes), length: n.length, before };
                else
                    state.gesture = { kind: 'move', start: p, current: p, base: structuredClone(state.project.notes), anchor: [...state.selection][0], before };
            }
            else {
                if (add) {
                    if (state.selection.has(n.id))
                        state.selection.delete(n.id);
                    else
                        state.selection.add(n.id);
                    info();
                    draw();
                    return;
                }
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
        }
        else {
            const start = Math.max(0, cellStart(m.tick, state.project.grid)), instructions = state.project.instruments[state.active].isInstructions;
            const newNote = { id: state.project.notes.reduce((id, n) => Math.max(id, n.id), 0) + 1, instrument: state.active, start, length: instructions ? 1 : 128 / state.project.grid, pitch: m.pitch, volume: instructions ? 0 : null, ...(instructions ? { tempo: null } : {}) };
            if (!valid([...state.project.notes, newNote]))
                return;
            state.project.notes.push(newNote);
            state.selection = new Set([newNote.id]);
            const spray = state.tool === 'spray' && !instructions;
            state.gesture = { kind: instructions ? 'instruction-create' : spray ? 'paint' : 'resize', start: p, current: p, music: m, nid: newNote.id, before,
                ...(spray ? { painted: new Set([`${start}:${m.pitch}`]) } : { base: structuredClone(state.project.notes), length: newNote.length, cell: start }) };
        }
        if (state.gesture?.kind === 'move') {
            state.gesture.scrollLeft = view.scrollLeft;
            state.gesture.scrollTop = view.scrollTop;
        }
        canvas.setPointerCapture(e.pointerId);
        info();
        draw();
    };
    canvas.onpointermove = e => {
        const p = point(e);
        if (scrubbing) {
            seekToTick(musical(p).tick);
            return;
        }
        if (keyGesture) {
            if (p.x >= 0 && p.x < KEY && p.y >= HEAD) {
                const pitch = musical(p).pitch;
                if (pitch !== keyGesture.pitch && pitch >= 0 && pitch <= 127) {
                    keyGesture.pitch = pitch;
                    previewKey(p);
                }
            }
            return;
        }
        if (!state.gesture) {
            if (p.y < HEAD) {
                canvas.style.cursor = p.x >= KEY ? 'pointer' : 'default';
                return;
            }
            const n = p.x >= KEY ? hit(p) : undefined;
            canvas.style.cursor = n && edge(n, p) ? 'ew-resize' : 'default';
            return;
        }
        state.gesture.current = p;
        if (state.gesture.kind === 'erase') {
            if (eraseTrail(state.gesture.last, p)) {
                info();
                draw();
            }
            state.gesture.last = p;
            return;
        }
        const dx = p.x - state.gesture.start.x, dy = p.y - state.gesture.start.y;
        if (Math.hypot(dx, dy) < threshold && !state.gesture.moved) {
            draw();
            return;
        }
        state.gesture.moved = true;
        if (state.gesture.kind === 'box' || state.gesture.kind === 'move') {
            edgePoint = p;
            if (!edgeFrame)
                edgeFrame = requestAnimationFrame(edgeScroll);
        }
        if (state.gesture.kind === 'paint') {
            paint(state.gesture.music, musical(p));
            state.gesture.music = musical(p);
        }
        if (state.gesture.kind === 'move')
            moveSelection();
        if (state.gesture.kind === 'resize') {
            const g = state.gesture, step = 128 / state.project.grid, tick = musical(p).tick;
            // Only a note being drawn carries a cell: dragging left of it grows the note backwards.
            if (g.cell !== undefined && tick < g.cell)
                state.project.notes = stretchBack(g.base, g.nid, cellStart(Math.max(0, tick), state.project.grid), g.cell + step);
            else
                state.project.notes = resize(g.base, g.nid, g.length + dx / state.zoom, state.project.grid);
        }
        info();
        draw();
    };
    canvas.onpointerup = e => {
        if (scrubbing) {
            scrubbing = false;
            if (canvas.hasPointerCapture(e.pointerId))
                canvas.releasePointerCapture(e.pointerId);
            return;
        }
        if (keyGesture) {
            keyGesture = null;
            if (canvas.hasPointerCapture(e.pointerId))
                canvas.releasePointerCapture(e.pointerId);
            return;
        }
        if (!state.gesture)
            return;
        if (state.gesture.kind === 'box') {
            const ids = boxIds(state.gesture.music, musical(state.gesture.current));
            state.selection = state.gesture.add ? new Set([...state.selection, ...ids]) : new Set(ids);
            if (!state.gesture.moved)
                setPastePosition(Math.max(0, cellStart(state.gesture.music.tick, state.project.grid)));
        }
        if (!fitsCurrentView(state.project)) {
            state.project = JSON.parse(state.gesture.before);
            status('This edit extends beyond the current view. Return to Project to edit across its boundary.');
        }
        if (JSON.stringify(state.project) !== state.gesture.before) {
            state.history.push(historySnapshot(JSON.parse(state.gesture.before)));
            if (state.history.length > 100)
                state.history.shift();
            state.future = [];
            state.dirty = true;
        }
        const erased = state.gesture.kind === 'erase';
        endGesture();
        if (erased && !state.segment)
            refresh();
        if (canvas.hasPointerCapture(e.pointerId))
            canvas.releasePointerCapture(e.pointerId);
    };
    canvas.onpointercancel = () => { keyGesture = null; scrubbing = false; endGesture(true); };
    canvas.onlostpointercapture = () => { keyGesture = null; scrubbing = false; if (state.gesture)
        endGesture(true); };
    canvas.oncontextmenu = e => e.preventDefault();
}
