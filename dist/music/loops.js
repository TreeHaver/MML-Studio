import { tempoMap } from './tempo.js';
import { resolveVolumes } from './volume.js';
import { ensureInstructions } from '../model/instructions.js';
export function validLoops(notes) {
    return notes.every(n => ['loopEntry', 'loopExit', 'loopTie'].every(k => n[k] === undefined || typeof n[k] === 'boolean') &&
        (n.loopCount === undefined || Number.isSafeInteger(n.loopCount) && n.loopCount > 0));
}
/** A temporary performance timeline. The editable version-2 project is untouched. */
export function loopRegions(source) {
    const warnings = [], stack = [], roots = [];
    const markers = source.notes.filter(n => source.instruments[n.instrument]?.isInstructions && (n.loopEntry || n.loopExit)).sort((a, b) => a.start - b.start || Number(!!b.loopExit) - Number(!!a.loopExit) || a.id - b.id);
    for (const n of markers) {
        if (n.loopExit) {
            const open = stack.pop();
            if (!open)
                warnings.push(`Loop Exit at ${n.start} has no Entry; ignored.`);
            else if (n.start <= open.note.start) {
                warnings.push(`Loop at ${n.start} has no duration; ignored.`);
                (stack.at(-1)?.children ?? roots).push(...open.children);
            }
            else
                (stack.at(-1)?.children ?? roots).push({ start: open.note.start, end: n.start, count: open.note.loopCount ?? 1, tie: !!n.loopTie, instrument: open.note.instrument, children: open.children });
        }
        if (n.loopEntry)
            stack.push({ note: n, children: [] });
    }
    while (stack.length) {
        const open = stack.pop();
        warnings.push(`Loop Entry at ${open.note.start} has no Exit; ignored.`);
        (stack.at(-1)?.children ?? roots).push(...open.children);
    }
    return { roots, warnings };
}
export function expandLoops(source, minimumEnd = 0) {
    const { roots, warnings } = loopRegions(source);
    const end = source.notes.reduce((end, n) => Math.max(end, n.start + (source.instruments[n.instrument]?.isInstructions ? 0 : n.length)), minimumEnd);
    // Check arithmetic before allocating repeated spans (no export-size caps).
    const duration = (start, end, loops) => { let total = end - start; for (const loop of loops) {
        total += duration(loop.start, loop.end, loop.children) * loop.count - (loop.end - loop.start);
        if (!Number.isSafeInteger(total))
            throw Error('Expanded loop timing exceeds the integer timing range.');
    } return total; };
    duration(0, end, roots);
    const spans = [];
    let tick = 0, pending;
    const append = (start, end) => { if (end <= start)
        return; spans.push({ start, end, tick, jump: pending }); pending = undefined; tick += end - start; if (!Number.isSafeInteger(tick))
        throw Error('Expanded loop timing exceeds the integer timing range.'); };
    const visit = (start, end, loops) => { let cursor = start; for (const loop of loops) {
        append(cursor, loop.start);
        for (let pass = 0; pass < loop.count; pass++) {
            if (pass)
                pending = { entry: loop.start, exit: loop.end, tie: loop.tie };
            visit(loop.start, loop.end, loop.children);
        }
        cursor = loop.end;
    } append(cursor, end); };
    if (!validLoops(source.notes))
        throw Error('Loop Count must be a positive whole number.');
    visit(0, end, roots);
    const sourceTick = (position) => { const span = spans.findLast(s => s.tick <= position); return span ? Math.min(span.end, span.start + position - span.tick) : position; };
    const performanceTick = (position) => { const span = spans.find(s => s.start <= position && position < s.end); return span ? span.tick + position - span.start : tick; };
    if (!roots.length)
        return { project: source, end: Math.max(end, minimumEnd), warnings, spans, sourceTick, performanceTick };
    const project = { ...source, instruments: source.instruments.map(i => ({ ...i })), notes: [] }, instruction = ensureInstructions(project);
    const sorted = [...source.notes].sort((a, b) => a.start - b.start || a.id - b.id), effective = resolveVolumes(sorted);
    const clock = tempoMap(source.notes);
    let id = 0;
    let previous = [];
    for (const span of spans) {
        const current = [], used = new Set();
        for (const n of sorted) {
            const silent = source.instruments[n.instrument]?.isInstructions;
            if (silent) {
                if (n.start >= span.start && n.start < span.end)
                    project.notes.push({ ...n, id: ++id, start: span.tick + n.start - span.start, tempo: null, loopEntry: undefined, loopExit: undefined, loopTie: undefined, loopCount: undefined });
                continue;
            }
            if (n.start >= span.end || n.start + n.length <= span.start)
                continue;
            const start = Math.max(n.start, span.start), stop = Math.min(n.start + n.length, span.end);
            const note = { ...n, id: ++id, start: span.tick + start - span.start, length: stop - start, volume: effective.get(n.id), tempo: null };
            const match = start === span.start ? previous.find(p => !used.has(p) && p.note.start + p.note.length === span.tick && p.original.instrument === n.instrument && p.original.pitch === n.pitch &&
                (span.jump ? span.jump.tie && (n.start < span.jump.entry || p.original.start + p.original.length > span.jump.exit) : p.original.id === n.id)) : undefined;
            if (match) {
                used.add(match);
                match.note.length += note.length;
                current.push({ note: match.note, original: n });
            }
            else {
                project.notes.push(note);
                current.push({ note, original: n });
            }
        }
        let bpm = 120;
        for (const t of clock) {
            if (t.tick > span.start)
                break;
            bpm = t.bpm;
        }
        const events = [{ tick: span.start, bpm }, ...clock.filter(t => t.tick > span.start && t.tick < span.end)];
        for (const t of events)
            project.notes.push({ id: ++id, instrument: instruction, start: span.tick + t.tick - span.start, length: 1, pitch: 60, volume: 0, tempo: t.bpm });
        previous = current;
    }
    return { project, end: tick, warnings, spans, sourceTick, performanceTick };
}
