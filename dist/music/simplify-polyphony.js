import { resolveVolumes } from './volume.js';
import { pitchClass } from './scale.js';
/** Trim only already-held, sounding notes at an onset that exceeds ten voices. */
export function simplifyHeldNotes(project, index, ids) {
    const replacements = new Map(), volumes = resolveVolumes(project.notes);
    const source = project.instruments[index]?.isInstructions ? [] : project.notes.filter(n => n.instrument === index && (volumes.get(n.id) ?? 8) > 0).sort((a, b) => a.start - b.start || a.id - b.id);
    let held = [], unresolved = 0;
    for (let a = 0; a < source.length;) {
        const tick = source[a].start;
        let b = a + 1;
        while (b < source.length && source[b].start === tick)
            b++;
        const fresh = source.slice(a, b), pitches = new Set(fresh.map(n => n.pitch));
        held = held.filter(n => n.start + n.length > tick);
        const excess = Math.max(0, held.length + fresh.length - 10);
        if (excess) {
            held.sort((x, y) => Number(pitches.has(y.pitch)) - Number(pitches.has(x.pitch)) || (volumes.get(x.id) - volumes.get(y.id)) || x.start - y.start || x.id - y.id);
            const cut = held.filter(n => !ids || ids.has(n.id)).slice(0, excess);
            const cutIds = new Set(cut.map(n => n.id));
            held = held.filter(n => !cutIds.has(n.id));
            for (const n of cut)
                replacements.set(n.id, { ...n, length: tick - n.start });
            if (held.length + fresh.length > 10)
                unresolved++;
        }
        held.push(...fresh);
        a = b;
    }
    return { notes: replacements.size ? project.notes.map(n => replacements.get(n.id) ?? n) : project.notes, changed: replacements.size, unresolved };
}
const instructions = ['tempo', 'timeSignature', 'section', 'resetMeasures', 'loopEntry', 'loopExit', 'loopTie', 'loopCount', 'speedEntry', 'speedExit', 'speedMultiplier'];
/** Exact onset/duration groups retain their outer pitches, regardless of density. */
export function simplifyChords(project, index, ids, complexity = 2, scale) {
    if (!Number.isSafeInteger(complexity) || complexity < 2)
        throw Error('Chord Complexity must be a whole number of at least 2.');
    if (project.instruments[index]?.isInstructions)
        return { notes: project.notes, changed: 0, removed: 0, protected: 0 };
    const groups = new Map(), removed = new Set(), replacements = new Map();
    let protectedCount = 0;
    for (const n of project.notes)
        if (n.instrument === index && (!ids || ids.has(n.id))) {
            const key = `${n.start}:${n.length}`, group = groups.get(key) ?? [];
            group.push(n);
            groups.set(key, group);
        }
    for (const group of groups.values()) {
        group.sort((a, b) => a.pitch - b.pitch || a.id - b.id);
        if (group.length <= complexity)
            continue;
        const low = group[0], high = group.at(-1);
        const keep = new Set([low.id, high.id]);
        // Dynamic programming chooses ordered interior notes nearest evenly spaced
        // pitch targets. A modest penalty favors scale tones without repitching.
        const width = Math.max(1, high.pitch - low.pitch), parents = [];
        let costs = group.map((_, i) => i === 0 ? 0 : Infinity);
        for (let slot = 1; slot < complexity - 1; slot++) {
            const next = group.map(() => Infinity), parent = group.map(() => -1);
            let best = Infinity, bestIndex = -1;
            for (let i = 1; i < group.length - 1; i++) {
                if (costs[i - 1] < best) {
                    best = costs[i - 1];
                    bestIndex = i - 1;
                }
                const target = low.pitch + width * slot / (complexity - 1);
                next[i] = best + Math.abs(group[i].pitch - target) / width + (scale && !scale.includes(pitchClass(group[i].pitch)) ? 0.15 : 0);
                parent[i] = bestIndex;
            }
            parents.push(parent);
            costs = next;
        }
        if (complexity > 2) {
            let last = 1;
            for (let i = 2; i < group.length - 1; i++)
                if (costs[i] < costs[last])
                    last = i;
            for (let slot = parents.length - 1; slot >= 0; slot--) {
                keep.add(group[last].id);
                last = parents[slot][last];
            }
        }
        for (const n of group) {
            if (keep.has(n.id))
                continue;
            const target = replacements.get(low.id) ?? low;
            // Onset instructions survive on an outer note at the exact same position.
            // Preserve a carrier if unusual conflicting payloads cannot be combined.
            if (instructions.some(key => n[key] != null && target[key] != null && n[key] !== target[key])) {
                protectedCount++;
                continue;
            }
            const payload = Object.fromEntries(instructions.filter(key => n[key] != null).map(key => [key, n[key]]));
            if (Object.keys(payload).length)
                replacements.set(low.id, { ...target, ...payload });
            removed.add(n.id);
        }
    }
    if (!removed.size)
        return { notes: project.notes, changed: 0, removed: 0, protected: protectedCount };
    const before = resolveVolumes(project.notes);
    let notes = project.notes.filter(n => !removed.has(n.id)).map(n => replacements.get(n.id) ?? n);
    const after = resolveVolumes(notes);
    notes = notes.map(n => n.instrument === index && n.volume === null && after.get(n.id) !== before.get(n.id) ? { ...n, volume: before.get(n.id) } : n);
    const originals = new Map(project.notes.map(n => [n.id, n]));
    return { notes, changed: removed.size + notes.filter(n => n !== originals.get(n.id)).length, removed: removed.size, protected: protectedCount };
}
