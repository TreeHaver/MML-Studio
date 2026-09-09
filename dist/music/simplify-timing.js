import { resolveVolumes } from './volume.js';
const instructed = (n) => n.tempo != null || n.timeSignature !== undefined || n.section !== undefined || n.resetMeasures || n.loopEntry || n.loopExit || n.loopTie || n.loopCount !== undefined || n.speedEntry || n.speedExit || n.speedMultiplier !== undefined;
const overlaps = (a, b) => a.start < b.start + b.length && b.start < a.start + a.length;
function lowerBound(notes, tick, edge) {
    let low = 0, high = notes.length;
    while (low < high) {
        const mid = (low + high) >>> 1;
        if (edge(notes[mid]) < tick)
            low = mid + 1;
        else
            high = mid;
    }
    return low;
}
/** Detect ornaments from original timing, before rounding can create a pattern. */
function condense(source, step, end) {
    const removed = new Set(), replacements = new Map();
    const counts = new Map();
    for (const n of source)
        counts.set(n.start, (counts.get(n.start) ?? 0) + 1);
    const joins = (a, b) => counts.get(a.start) === 1 && counts.get(b.start) === 1 && b.start >= a.start + a.length && b.start <= a.start + a.length + 1;
    // A grace note at most L32 long leading directly into a held note.
    for (let i = 0; i + 1 < source.length; i++) {
        const a = source[i], b = source[i + 1];
        if (a.length <= 4 && b.length > 6 * a.length && a.pitch !== b.pitch && joins(a, b) && !instructed(a))
            removed.add(a.id);
    }
    const byEnd = [...source].sort((a, b) => a.start + a.length - b.start - b.length);
    const short = (n) => n.length <= 4 && n.length < step && !removed.has(n.id) && !instructed(n);
    for (let i = 0; i < source.length;) {
        let j = i + 1;
        if (short(source[i]))
            while (j < source.length && short(source[j]) && joins(source[j - 1], source[j]))
                j++;
        // Rapid repeats and pitch runs both keep the first note in each tile.
        // Longer notes still use the shared-window coverage rule below.
        if (j - i >= 2) {
            for (let a = i; a < j;) {
                const start = Math.floor(source[a].start / step) * step;
                let b = a + 1;
                while (b < j && source[b].start < start + step)
                    b++;
                if (b - a >= 2 && start + step <= end) {
                    const group = source.slice(a, b), ids = new Set(group.map(n => n.id));
                    const first = { ...group[0], start, length: step };
                    // Do not expand a condensed window into unrelated, previously separate notes.
                    const nearby = source.slice(lowerBound(source, start, n => n.start), lowerBound(source, start + step, n => n.start));
                    nearby.push(...byEnd.slice(lowerBound(byEnd, start + 1, n => n.start + n.length), lowerBound(byEnd, group[0].start + 1, n => n.start + n.length)));
                    const collision = nearby.some(n => !ids.has(n.id) && !removed.has(n.id) && overlaps(first, n) && !group.some(member => overlaps(member, n)));
                    if (!collision) {
                        replacements.set(first.id, first);
                        for (const n of group.slice(1))
                            removed.add(n.id);
                    }
                }
                a = b;
            }
        }
        i = j;
    }
    return { source: source.filter(n => !removed.has(n.id)).map(n => replacements.get(n.id) ?? n).sort((a, b) => a.start - b.start || a.id - b.id), removed };
}
/** Explicit, undoable timing conversion; never part of import or MML optimization. */
export function simplifyTiming(project, index, denominator, end = Infinity) {
    if (![4, 8, 16, 32, 64].includes(denominator))
        throw Error('Choose L4, L8, L16, L32 or L64.');
    if (project.instruments[index]?.isInstructions)
        return { notes: project.notes, changed: 0, skipped: 0 };
    const step = 128 / denominator, down = (tick) => Math.floor(tick / step) * step;
    const original = project.notes.filter(n => n.instrument === index).sort((a, b) => a.start - b.start || a.id - b.id);
    const condensed = condense(original, step, end);
    // Extend into an edge window only when its actual coverage exceeds 40%.
    const roundedStart = (n) => n.start === down(n.start) || 5 * Math.min(n.length, down(n.start) + step - n.start) > 2 * step ? down(n.start) : down(n.start) + step;
    const roundedEnd = (n) => {
        const stop = n.start + n.length, base = down(stop);
        return base + (5 * (stop - Math.max(base, n.start)) > 2 * step ? step : 0);
    };
    const starts = new Map(), stops = new Map();
    const candidates = condensed.source, orderedEnds = [...candidates].sort((a, b) => a.start + a.length - b.start - b.length);
    // Two sequential notes sharing a window compete by coverage inside that
    // window, not by their total held lengths. Existing polyphony is not a contest.
    for (let i = 0; i + 1 < candidates.length; i++) {
        const a = candidates[i], b = candidates[i + 1], aEnd = a.start + a.length, bEnd = b.start + b.length;
        const window = down(b.start), finish = window + step;
        if (aEnd > b.start || down(aEnd - 1) !== window || finish > end || instructed(a) || instructed(b))
            continue;
        const sounding = lowerBound(candidates, finish, n => n.start) - lowerBound(orderedEnds, window + 1, n => n.start + n.length);
        if (sounding !== 2)
            continue;
        const left = aEnd - Math.max(a.start, window), right = Math.min(bEnd, finish) - b.start, total = left + right;
        const balanced = 5 * Math.min(left, right) >= 2 * total;
        const boundary = balanced ? window + step / 2 : left > right ? finish : window;
        starts.set(a.id, starts.get(a.id) ?? (a.start >= window ? window : roundedStart(a)));
        stops.set(a.id, boundary);
        starts.set(b.id, boundary);
        stops.set(b.id, bEnd <= finish ? finish : roundedEnd(b));
    }
    for (const n of candidates)
        if ((stops.get(n.id) ?? roundedEnd(n)) <= (starts.get(n.id) ?? roundedStart(n)) && (starts.has(n.id) || stops.has(n.id)))
            condensed.removed.add(n.id);
    const source = candidates.filter(n => !condensed.removed.has(n.id));
    const endings = [...source].sort((a, b) => (a.start + a.length) - (b.start + b.length));
    const results = new Map();
    let skipped = 0, ended = 0, priorEnd = 0;
    for (const note of source) {
        const oldEnd = note.start + note.length;
        // Only prevent NEW overlap: existing chords/sustained overlaps are retained.
        let low = 0, high = source.length;
        while (low < high) {
            const mid = (low + high) >>> 1;
            if (source[mid].start < oldEnd)
                low = mid + 1;
            else
                high = mid;
        }
        let stop = stops.get(note.id) ?? roundedEnd(note);
        if (!stops.has(note.id) && low < source.length && stop > (starts.get(source[low].id) ?? down(source[low].start)))
            stop = down(oldEnd);
        if (stop > end)
            stop = down(end);
        const start = starts.get(note.id) ?? roundedStart(note);
        // Previously skipped notes retain their exact edges. Do not round the next
        // note backwards into them; preserve that note too when necessary.
        while (ended < endings.length && endings[ended].start + endings[ended].length <= note.start) {
            const previous = results.get(endings[ended++].id);
            priorEnd = Math.max(priorEnd, previous.start + previous.length);
        }
        if (stop <= start || start < priorEnd) {
            results.set(note.id, note);
            skipped++;
            continue;
        }
        const edited = start !== note.start || stop !== oldEnd;
        results.set(note.id, edited ? { ...note, start, length: stop - start } : note);
    }
    // Removing a V carrier must not change surviving notes' inherited velocities.
    const volumes = resolveVolumes(project.notes);
    let notes = project.notes.filter(n => !condensed.removed.has(n.id)).map(n => results.get(n.id) ?? n);
    if (condensed.removed.size) {
        const after = resolveVolumes(notes);
        notes = notes.map(n => n.instrument === index && n.volume === null && after.get(n.id) !== volumes.get(n.id) ? { ...n, volume: volumes.get(n.id) } : n);
    }
    const byId = new Map(notes.map(n => [n.id, n]));
    const changed = project.notes.reduce((count, n) => count + (byId.get(n.id) !== n ? 1 : 0), 0);
    return { notes: changed ? notes : project.notes, changed, skipped };
}
