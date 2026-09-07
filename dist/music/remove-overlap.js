/** Cut held notes at the next distinct onset of the exact same pitch. */
export function removeOverlap(project, index) {
    if (project.instruments[index]?.isInstructions)
        return { notes: project.notes, changed: 0, duplicates: 0 };
    const source = project.notes.filter(n => n.instrument === index).sort((a, b) => a.pitch - b.pitch || a.start - b.start || a.id - b.id);
    const replacements = new Map();
    let duplicates = 0;
    for (let a = 0; a < source.length;) {
        let b = a + 1;
        while (b < source.length && source[b].pitch === source[a].pitch && source[b].start === source[a].start)
            b++;
        // Simultaneous duplicates cannot be cut to positive length; keep them.
        duplicates += b - a - 1;
        const next = b < source.length && source[b].pitch === source[a].pitch ? source[b].start : Infinity;
        for (let i = a; i < b; i++) {
            const note = source[i];
            if (note.start + note.length > next)
                replacements.set(note.id, { ...note, length: next - note.start });
        }
        a = b;
    }
    return { notes: replacements.size ? project.notes.map(n => replacements.get(n.id) ?? n) : project.notes, changed: replacements.size, duplicates };
}
