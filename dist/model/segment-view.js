import { ensureInstructions } from './instructions.js';
import { seedSpeedContext } from '../music/speed.js';
import { tempoAt } from '../music/tempo.js';
import { signatureAt } from '../music/structure.js';
import { valid } from './validation.js';
import { resolveVolumes } from '../music/volume.js';
export function projectEnd(project) { return project.notes.reduce((end, n) => Math.max(end, n.start + n.length), 0); }
export function sectionMarkers(project) {
    const markers = new Map();
    for (const n of project.notes)
        if (project.instruments[n.instrument].isInstructions && n.section?.trim()) {
            const previous = markers.get(n.start);
            markers.set(n.start, { start: n.start, name: n.section.trim(), song: !!n.resetMeasures || !!previous?.song });
        }
    return [...markers.values()].sort((a, b) => a.start - b.start);
}
export function rangeAt(project, tick, kind, lastEnd = projectEnd(project)) {
    const markers = sectionMarkers(project).filter(m => kind === 'segment' || m.song);
    const index = markers.findLastIndex(m => m.start <= tick);
    if (index < 0)
        return null;
    const marker = markers[index], end = markers[index + 1]?.start ?? lastEnd;
    return end > marker.start && tick < end ? { kind, name: marker.name, start: marker.start, end } : null;
}
/** Editable local projection. Baseline remembers every automatic clip/context value. */
export function projectSegment(root, range) {
    const { start, end } = range, volumes = resolveVolumes(root.notes), project = { ...root, instruments: root.instruments.map(i => ({ ...i })), notes: [] };
    // A setting still applies after the note carrying it has ended. Keep this
    // boundary inheritance separate from explicit V on older held notes.
    const prior = new Map();
    for (const n of root.notes)
        if (n.start < start && n.volume !== null) {
            const previous = prior.get(n.instrument);
            if (!previous || n.start > previous.start || n.start === previous.start && n.id > previous.id)
                prior.set(n.instrument, n);
        }
    for (const n of root.notes) {
        if (root.instruments[n.instrument].isInstructions) {
            if (n.start >= start && n.start < end)
                project.notes.push({ ...n, start: n.start - start, length: Math.min(n.length, end - n.start) });
        }
        else if (n.start < end && n.start + n.length > start)
            project.notes.push({ ...n, start: Math.max(n.start, start) - start, length: Math.min(n.start + n.length, end) - Math.max(n.start, start), ...(n.start < start ? { tempo: null, volume: n.volume ?? prior.get(n.instrument)?.volume ?? 8 } : {}) });
    }
    // Seed only unset onsets whose inheritance was changed by clipping. These
    // automatic values belong to the projection baseline, not the saved parent.
    for (let instrument = 0; instrument < project.instruments.length; instrument++) {
        if (project.instruments[instrument].isInstructions)
            continue;
        const lane = project.notes.filter(n => n.instrument === instrument).sort((a, b) => a.start - b.start || a.id - b.id);
        if (!lane.length)
            continue;
        let inherited = 8;
        for (let a = 0; a < lane.length;) {
            let b = a;
            while (b < lane.length && lane[b].start === lane[a].start) {
                if (lane[b].volume !== null)
                    inherited = lane[b].volume;
                b++;
            }
            for (let i = a; i < b; i++) {
                const n = lane[i], expected = volumes.get(n.id) ?? 8;
                if (n.volume === null && inherited !== expected)
                    n.volume = expected;
            }
            for (; a < b; a++)
                if (lane[a].volume !== null)
                    inherited = lane[a].volume;
        }
    }
    let context = project.notes.find(n => project.instruments[n.instrument].isInstructions && n.start === 0);
    if (!context) {
        context = { id: root.notes.reduce((max, n) => Math.max(max, n.id), 0) + 1, instrument: ensureInstructions(project), start: 0, length: 1, pitch: 60, volume: 0 };
        project.notes.push(context);
    }
    if (!project.notes.some(n => n.start === 0 && n.tempo != null))
        context.tempo = tempoAt(root.notes, start, false);
    if (!project.notes.some(n => n.start === 0 && project.instruments[n.instrument].isInstructions && n.timeSignature))
        context.timeSignature = signatureAt(root, start);
    seedSpeedContext(root, project.notes, start, context.instrument);
    return { project, baseline: structuredClone(project), range: { ...range } };
}
export function fitsSegment(project, range) {
    const duration = range.end - range.start;
    return project.notes.every(n => n.start >= 0 && n.start < duration && (project.instruments[n.instrument].isInstructions || n.start + n.length <= duration));
}
/** A newly explicit boundary tempo supersedes view-only inherited context. */
export function replaceInheritedTempo(root, projection, notes) {
    const baseline = new Map(projection.baseline.notes.map(n => [n.id, n]));
    if (!notes.some(n => n.start === 0 && n.tempo != null && (baseline.get(n.id)?.tempo !== n.tempo || baseline.get(n.id)?.start !== 0)))
        return notes;
    const originals = new Map(root.notes.map(n => [n.id, n]));
    return notes.map(n => {
        const base = baseline.get(n.id), original = originals.get(n.id);
        const automatic = base?.start === 0 && base.tempo != null && !(original?.start === projection.range.start && original.tempo != null);
        return automatic && n.start === 0 && n.tempo === base.tempo ? { ...n, tempo: null } : n;
    });
}
const keys = ['start', 'length', 'pitch', 'volume', 'tempo', 'timeSignature', 'section', 'resetMeasures', 'loopEntry', 'loopExit', 'loopTie', 'loopCount', 'speedEntry', 'speedExit', 'speedMultiplier'];
/** Apply explicit view changes to the parent, preserving untouched source notes verbatim. */
export function mergeSegment(root, projection, edited, sourceIndices, ids = new Map()) {
    if (!fitsSegment(edited, projection.range))
        throw Error('This edit extends beyond the current view. Return to Project to edit across its boundary.');
    const { start, end } = projection.range, baseline = new Map(projection.baseline.notes.map(n => [n.id, n])), current = new Map(edited.notes.map(n => [n.id, n]));
    const originals = new Map(root.notes.map(n => [n.id, n])), volumes = resolveVolumes(root.notes);
    const instruments = root.instruments.map(i => ({ ...i })), routing = edited.instruments.map((instrument, index) => {
        const source = sourceIndices[index] ?? -1;
        if (source >= 0) {
            instruments[source] = { ...instrument };
            return source;
        }
        instruments.push({ ...instrument });
        return instruments.length - 1;
    });
    let id = Math.max(root.notes.reduce((max, n) => Math.max(max, n.id), 0), edited.notes.reduce((max, n) => Math.max(max, n.id), 0));
    const notes = [];
    const clearedContext = (base, n) => base.start === 0 && base.tempo != null && n.tempo == null && !(originals.get(base.id)?.start === start && originals.get(base.id)?.tempo != null);
    const changed = (base, n) => keys.some(key => base[key] !== n[key] && !(key === 'tempo' && clearedContext(base, n))) || routing[n.instrument] !== base.instrument;
    for (const original of root.notes) {
        const base = baseline.get(original.id);
        if (!base) {
            notes.push({ ...original });
            continue;
        }
        const n = current.get(original.id);
        if (n && !changed(base, n)) {
            notes.push({ ...original });
            ids.set(n.id, original.id);
            continue;
        }
        const musical = !root.instruments[original.instrument].isInstructions;
        const left = musical && original.start < start, right = musical && original.start + original.length > end;
        if (left)
            notes.push({ ...original, length: start - original.start });
        if (n) {
            const updated = { ...original };
            for (const key of keys)
                if (base[key] !== n[key] && !(key === 'tempo' && clearedContext(base, n))) {
                    if (n[key] === undefined)
                        delete updated[key];
                    else
                        updated[key] = n[key];
                }
            updated.id = left ? ++id : original.id;
            updated.instrument = routing[n.instrument];
            updated.start = n.start + start;
            updated.length = n.length;
            if (left) {
                updated.tempo = n.tempo;
                updated.volume = n.volume;
            }
            notes.push(updated);
            ids.set(n.id, updated.id);
        }
        if (right)
            notes.push({ ...original, id: left || n ? ++id : original.id, start: end, length: original.start + original.length - end, tempo: null, volume: volumes.get(original.id) });
    }
    for (const n of edited.notes)
        if (!originals.has(n.id) || !baseline.has(n.id)) {
            const base = baseline.get(n.id);
            if (base && !changed(base, n))
                continue; // automatic inherited context is view-only
            const added = { ...n, id: ++id, start: n.start + start, instrument: routing[n.instrument] };
            if (base) {
                for (const key of ['tempo', 'timeSignature', 'section', 'resetMeasures', 'loopEntry', 'loopExit', 'loopTie', 'loopCount', 'speedEntry', 'speedExit', 'speedMultiplier'])
                    if (base[key] === n[key])
                        delete added[key];
            }
            notes.push(added);
            ids.set(n.id, added.id);
        }
    // Removed view lanes remain in the parent for any music outside the view.
    const result = { ...root, name: edited.name, grid: edited.grid, instruments, notes };
    if (!valid(result.notes))
        throw Error('The edit conflicts with an instruction in the full project.');
    return result;
}
