import { createEdgeScroll } from './edge-scroll.js';
import { instructionCaptionHit, instructionLineHit } from './rendering/tempo.js';
import { playbackPitch } from './playback/drums.js';
import { anchor, point, musical, hit, hits, musicalNoteHit, edge, boxIds } from './geometry.js';
import { layout, extendDragExtent } from './viewport.js';
import { draw } from './painting.js';
import { info } from './inspector.js';
import { refresh, commitNotes } from './commands.js';
import { historySnapshot, fitsCurrentView } from './segment-session.js';
import { canvas, status, view } from './dom.js';
import { state, isMuted, selectInstrument, instrumentSelected, promoteInstrument } from './state.js';
import { instruments } from './instruments.js';
import { KEY, HEAD, threshold } from './constants.js';
import { pitchTop, pitchAtY, pitchHeight } from './pitch-viewport.js';
import { cellStart, snap } from './music/timing.js';
import { valid } from './model/validation.js';
import { move, resize, stretchBack } from './music/note-operations.js';
import { previewNote } from './playback/preview.js';
import { seekToTick } from './playback/transport.js';
import { loopRegion, loopEdgeAt, setLoopRegion, clearLoopRegion, loopSpan, looping, freeTick } from './playback/loop-region.js';
import { setPastePosition } from './note-clipboard.js';
import { advancedInstructions } from './advanced-instructions.js';
let stopEdgeScroll = () => { };
export function endGesture(cancel = false) { stopEdgeScroll(); if (!state.gesture)
    return; if (cancel && state.gesture.before && state.gesture.kind !== 'move')
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
    let scrubbing = false, loopDrag = null;
    // Box selection scrolls both axes; moving notes scrolls horizontally near the roll edges.
    const edgeMotion = createEdgeScroll();
    let edgeFrame = 0, edgePoint = null;
    stopEdgeScroll = () => { if (edgeFrame)
        cancelAnimationFrame(edgeFrame); edgeFrame = 0; edgePoint = null; edgeMotion.reset(); };
    const moveSelection = () => {
        const g = state.gesture;
        const dx = g.current.x - g.start.x + view.scrollLeft - g.scrollLeft;
        const dy = g.current.y - g.start.y + view.scrollTop - g.scrollTop;
        const note = g.anchorNote;
        const pitch = pitchAtY(state.topPitch, pitchTop(state.topPitch, note.pitch) + pitchHeight(note.pitch) / 2 + dy);
        g.movePreview = { dt: snap(note.start + dx / state.zoom, state.project.grid) - note.start, dp: state.project.instruments[state.active].isInstructions ? 0 : pitch - note.pitch };
        extendDragExtent(g.maxEnd + g.movePreview.dt);
    };
    const resizeSelection = () => {
        const g = state.gesture, dx = g.current.x - g.start.x + view.scrollLeft - g.scrollLeft, tick = musical(g.current).tick;
        if (g.cell !== undefined && tick < g.cell)
            state.project.notes = stretchBack(g.base, g.nid, cellStart(Math.max(0, tick), state.project.grid), g.cell + 128 / state.project.grid);
        else
            state.project.notes = resize(g.base, g.nid, g.length + dx / state.zoom, state.project.grid);
        const note = state.project.notes.find(n => n.id === g.nid);
        if (note)
            extendDragExtent(note.start + note.length);
    };
    const edgeScroll = (time) => {
        const gesture = state.gesture, p = edgePoint;
        if (!gesture || !['box', 'move', 'resize'].includes(gesture.kind) || !p) {
            stopEdgeScroll();
            return;
        }
        const { dx, dy } = edgeMotion.step(p, { left: KEY, top: HEAD, right: state.width, bottom: state.height }, gesture.kind === 'box', time);
        if (dx || dy) {
            view.scrollLeft = Math.max(0, view.scrollLeft + dx);
            view.scrollTop = Math.max(0, view.scrollTop + dy);
            if (gesture.kind === 'move')
                moveSelection();
            else {
                if (gesture.kind === 'resize')
                    resizeSelection();
                info();
            }
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
    } }, 500); void previewNote(playbackPitch(instrument, pitch), instrument.midiProgram ?? 0, instrument.isDrum === true || !!instrument.ms2Drum, instrument.volume ?? 100); return pitch; };
    canvas.onpointerdown = e => {
        if (e.button !== 0 && e.button !== 2)
            return;
        const p = point(e);
        if (p.y < HEAD) {
            if (e.button === 0 && p.x >= KEY) {
                e.preventDefault();
                canvas.setPointerCapture(e.pointerId);
                const tick = musical(p).tick, end = loopEdgeAt(tick, threshold / state.zoom);
                // Shift draws the rehearsal loop; taking hold of an end of an existing one needs no key,
                // and a plain drag still moves the playhead, which is what the ruler has always done.
                if (e.shiftKey && !end) {
                    loopDrag = { anchor: freeTick(tick) };
                    clearLoopRegion();
                    draw();
                }
                else if (end) {
                    loopDrag = { anchor: end === 'start' ? loopRegion.end : loopRegion.start };
                }
                else {
                    scrubbing = true;
                    seekToTick(tick);
                }
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
        if (e.button === 0 && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
            e.preventDefault();
            canvas.focus();
            if (state.gesture)
                return;
            if (isMuted(state.active)) {
                status('Unmute this instrument to move its notes.');
                return;
            }
            const notes = state.project.notes, first = notes.filter(n => state.selection.has(n.id)).sort((a, b) => a.start - b.start || a.id - b.id)[0];
            if (!first) {
                status('Select notes, then Alt-click to move them to that time.');
                return;
            }
            const target = cellStart(musical(p).tick, state.project.grid);
            if (target === first.start)
                return;
            const moved = move(notes, state.selection, first.id, target - first.start, 0, state.project.grid);
            if (moved === notes) {
                status('Cannot move the selection there because its instructions would conflict.');
                return;
            }
            commitNotes(moved);
            draw();
            return;
        }
        const caption = instructionCaptionHit(p);
        let stackNote;
        if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !caption && (state.tool === 'select' || state.project.instruments[state.active]?.isInstructions || state.selectedInstruments.size > 1)) {
            const note = musicalNoteHit(p);
            if (note && instrumentSelected(note.instrument) && state.selectedInstruments.size > 1) {
                stackNote = note;
                promoteInstrument(note.instrument);
                state.selection.add(note.id);
                instruments();
            }
            else if (note && note.instrument !== state.active && (state.tool === 'select' || state.project.instruments[state.active]?.isInstructions)) {
                e.preventDefault();
                canvas.focus();
                selectInstrument(note.instrument);
                state.selection = new Set([note.id]);
                refresh();
                draw();
                return;
            }
        }
        const marker = caption ?? (!hit(p) ? instructionLineHit(p) : undefined);
        if (e.button === 0 && marker && marker.instrument !== state.active) {
            advancedInstructions.enabled = true;
            state.active = marker.instrument;
            state.selectedInstruments.clear();
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
        const candidates = hits(p), plain = e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey;
        const selected = plain ? candidates.find(n => state.selection.has(n.id)) : undefined;
        const n = stackNote ?? selected ?? candidates[0];
        // Resolve a repeated click on release, so dragging still moves/resizes the selected note.
        const cycle = !stackNote && plain && selected && state.selection.size === 1 && candidates.length > 1 && !state.project.instruments[selected.instrument]?.isInstructions
            ? candidates[(candidates.indexOf(selected) + 1) % candidates.length].id : undefined;
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
        if (state.gesture)
            state.gesture.cycle = cycle;
        if (state.gesture?.kind === 'resize')
            state.gesture.scrollLeft = view.scrollLeft;
        if (state.gesture?.kind === 'move') {
            const g = state.gesture;
            g.scrollLeft = view.scrollLeft;
            g.scrollTop = view.scrollTop;
            g.anchorNote = g.base.find((n) => n.id === g.anchor);
            g.maxEnd = g.base.reduce((end, n) => state.selection.has(n.id) ? Math.max(end, n.start + n.length) : end, 0);
        }
        canvas.setPointerCapture(e.pointerId);
        info();
        draw();
    };
    canvas.onpointermove = e => {
        // A loop lands exactly where it is drawn. G puts it on the grid afterwards, if wanted.
        const p = point(e);
        if (loopDrag) {
            setLoopRegion(loopDrag.anchor, musical(p).tick);
            draw();
            return;
        }
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
                canvas.style.cursor = p.x < KEY ? 'default' : loopEdgeAt(musical(p).tick, threshold / state.zoom) ? 'ew-resize' : 'pointer';
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
        if (['box', 'move', 'resize'].includes(state.gesture.kind)) {
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
        if (state.gesture.kind === 'resize')
            resizeSelection();
        if (state.gesture.kind !== 'move')
            info();
        draw();
    };
    canvas.onpointerup = e => {
        if (loopDrag) {
            loopDrag = null;
            if (canvas.hasPointerCapture(e.pointerId))
                canvas.releasePointerCapture(e.pointerId);
            // A shift-click with no drag has both ends on one cell, which is how the loop is cleared.
            status(loopSpan() > 0 ? `Repeating ticks ${loopRegion.start}-${loopRegion.end}. G puts the ends on the grid, L switches the loop off.` : 'Loop cleared.');
            draw();
            return;
        }
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
        if (state.gesture.kind === 'move' && state.gesture.moved) {
            const g = state.gesture;
            g.current = point(e);
            moveSelection();
            state.project.notes = move(g.base, state.selection, g.anchor, g.movePreview.dt, g.movePreview.dp, state.project.grid);
        }
        if (!state.gesture.moved && state.gesture.cycle !== undefined)
            state.selection = new Set([state.gesture.cycle]);
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
