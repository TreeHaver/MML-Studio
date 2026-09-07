/** Explicit, undoable timing conversion; never part of import or MML optimization. */
export function simplifyTiming(project, index, denominator, end = Infinity) {
    if (![4, 8, 16, 32, 64].includes(denominator))
        throw Error('Choose L4, L8, L16, L32 or L64.');
    if (project.instruments[index]?.isInstructions)
        return { notes: project.notes, changed: 0, skipped: 0 };
    const step = 128 / denominator, down = (tick) => Math.floor(tick / step) * step;
    const source = project.notes.filter(n => n.instrument === index).sort((a, b) => a.start - b.start || a.id - b.id);
    const endings = [...source].sort((a, b) => (a.start + a.length) - (b.start + b.length));
    const results = new Map();
    let changed = 0, skipped = 0, ended = 0, priorEnd = 0;
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
        let stop = Math.ceil(oldEnd / step) * step;
        if (low < source.length && stop > down(source[low].start))
            stop = down(oldEnd);
        if (stop > end)
            stop = down(end);
        const start = down(note.start);
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
        if (edited)
            changed++;
    }
    return { notes: changed ? project.notes.map(n => results.get(n.id) ?? n) : project.notes, changed, skipped };
}
