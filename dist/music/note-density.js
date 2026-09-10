import { expandLoops } from './loops.js';
/** Exact shared lifetimes of same-pitch notes with distinct onsets, per owner.
 * Same-start duplicates retain their separate onset warning. No notes are edited. */
export function sustainedOverlapSpans(notes) {
    const groups = new Map(), spans = [];
    for (const n of notes) {
        const key = `${n.instrument}:${n.pitch}`, group = groups.get(key) ?? [];
        group.push(n);
        groups.set(key, group);
    }
    for (const group of groups.values()) {
        group.sort((a, b) => a.start - b.start);
        let earlierEnd = -Infinity, last;
        for (let i = 0; i < group.length;) {
            const { start, instrument, pitch } = group[i];
            let end = start;
            while (i < group.length && group[i].start === start) {
                end = Math.max(end, group[i].start + group[i].length);
                i++;
            }
            const sharedEnd = Math.min(earlierEnd, end);
            if (sharedEnd > start) {
                if (last && last.end >= start)
                    last.end = Math.max(last.end, sharedEnd);
                else {
                    last = { instrument, pitch, start, end: sharedEnd };
                    spans.push(last);
                }
            }
            earlierEnd = Math.max(earlierEnd, end);
        }
    }
    return spans;
}
/** Editable locations for the same overlaps reported by MML, including repeat
 * restarts. Expanded IDs are temporary, so select the original sounding notes. */
export function overlapLocations(project, instrument) {
    if (instrument !== undefined && project.instruments[instrument]?.isInstructions)
        return [];
    const expanded = expandLoops(project), groups = new Map();
    for (const n of expanded.project.notes)
        if (!project.instruments[n.instrument]?.isInstructions && (instrument === undefined || n.instrument === instrument)) {
            const key = `${n.instrument}:${n.start}:${n.pitch}`, group = groups.get(key) ?? [];
            group.push(n);
            groups.set(key, group);
        }
    const result = [], seen = new Set();
    for (const group of [...groups.values()].filter(g => g.length > 1).sort((a, b) => a[0].start - b[0].start || a[0].pitch - b[0].pitch)) {
        const first = group[0], start = expanded.sourceTick(first.start), key = `${first.instrument}:${start}:${first.pitch}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        const ids = expanded.project === project ? group.map(n => n.id) : project.notes.filter(n => n.instrument === first.instrument && n.pitch === first.pitch && n.start <= start && n.start + n.length > start).map(n => n.id);
        result.push({ start, pitch: first.pitch, ids });
    }
    return result;
}
/** Warning definition: identical onset, pitch and owner, regardless of length.
 * Use current view/performance onsets: clipped or restarted continuations
 * are intentionally not exempt. Report only; never alter the notes. */
export function hasOverlappingNotes(notes) {
    const seen = new Set();
    for (const n of notes) {
        const key = `${n.instrument}:${n.start}:${n.pitch}`;
        if (seen.has(key))
            return true;
        seen.add(key);
    }
    return false;
}
/** Half-open intervals: a note ending at t does not overlap one starting at t. */
export function crowdedRegions(notes, limit = 10) {
    return crowdedRegionCounts(notes, limit).map(({ start, end }) => ({ start, end }));
}
/** Peak simultaneous notes within each continuous over-limit area. */
export function crowdedRegionCounts(notes, limit = 10) {
    const events = new Map();
    for (const n of notes) {
        events.set(n.start, (events.get(n.start) ?? 0) + 1);
        const end = n.start + n.length;
        events.set(end, (events.get(end) ?? 0) - 1);
    }
    const regions = [];
    let count = 0, start, peak = 0;
    for (const [tick, delta] of [...events].sort((a, b) => a[0] - b[0])) {
        const next = count + delta;
        if (count <= limit && next > limit) {
            start = tick;
            peak = next;
        }
        if (start !== undefined)
            peak = Math.max(peak, next);
        if (count > limit && next <= limit && start !== undefined) {
            regions.push({ start, end: tick, peak });
            start = undefined;
        }
        count = next;
    }
    return regions;
}
