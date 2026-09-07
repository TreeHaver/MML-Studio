/** Per-pitch interval trees retain long held notes crossing the viewport edge. */
export function createNoteVisibility(notes, isInstructions) {
    const pitches = new Map();
    notes.forEach((note, order) => {
        const instructions = isInstructions(note.instrument), entry = { note, order, instructions, end: note.start + (instructions ? 0 : note.length) };
        const list = pitches.get(note.pitch);
        if (list)
            list.push(entry);
        else
            pitches.set(note.pitch, [entry]);
    });
    const build = (entries, low, high) => {
        if (low >= high)
            return null;
        const mid = (low + high) >>> 1, left = build(entries, low, mid), right = build(entries, mid + 1, high), entry = entries[mid];
        return { entry, left, right, maxEnd: Math.max(entry.end, left?.maxEnd ?? -Infinity, right?.maxEnd ?? -Infinity) };
    };
    const roots = new Map();
    for (const [pitch, entries] of pitches) {
        entries.sort((a, b) => a.note.start - b.note.start || a.order - b.order);
        roots.set(pitch, build(entries, 0, entries.length));
    }
    return (from, to, lowPitch, highPitch, instructionWidth) => {
        const visible = [], left = from - instructionWidth;
        const visit = (node) => {
            if (!node || node.maxEnd < left)
                return;
            visit(node.left);
            const entry = node.entry;
            if (entry.note.start > to)
                return;
            if ((entry.instructions ? entry.note.start + instructionWidth : entry.end) >= from)
                visible.push(entry);
            visit(node.right);
        };
        for (let pitch = lowPitch; pitch <= highPitch; pitch++)
            visit(roots.get(pitch) ?? null);
        visible.sort((a, b) => a.order - b.order);
        return visible.map(entry => entry.note);
    };
}
