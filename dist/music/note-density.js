/** Warning definition: identical onset, pitch and owner, regardless of length. */
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
    const events = new Map();
    for (const n of notes) {
        events.set(n.start, (events.get(n.start) ?? 0) + 1);
        const end = n.start + n.length;
        events.set(end, (events.get(end) ?? 0) - 1);
    }
    const regions = [];
    let count = 0, start;
    for (const [tick, delta] of [...events].sort((a, b) => a[0] - b[0])) {
        const next = count + delta;
        if (count <= limit && next > limit)
            start = tick;
        if (count > limit && next <= limit && start !== undefined) {
            regions.push({ start, end: tick });
            start = undefined;
        }
        count = next;
    }
    return regions;
}
