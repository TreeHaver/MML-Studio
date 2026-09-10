import { resolveVolumes } from './volume.js';
/** Cut held notes at the next distinct onset of the exact same pitch. */
export function removeOverlap(project, index, ids) {
    if (project.instruments[index]?.isInstructions)
        return { notes: project.notes, changed: 0, shortened: 0, duplicates: 0 };
    const source = project.notes.filter(n => n.instrument === index && (!ids || ids.has(n.id))).sort((a, b) => a.pitch - b.pitch || a.start - b.start || a.id - b.id);
    const replacements = new Map(), removed = new Set(), volumes = resolveVolumes(project.notes);
    for (let a = 0; a < source.length;) {
        let b = a + 1;
        while (b < source.length && source[b].pitch === source[a].pitch && source[b].start === source[a].start)
            b++;
        // Pick the longest note within two V steps of the loudest. This also
        // makes groups of three or more independent of source-array order.
        let loudest = 0;
        for (let i = a; i < b; i++)
            loudest = Math.max(loudest, volumes.get(source[i].id));
        let winner;
        for (let i = a; i < b; i++) {
            const n = source[i], v = volumes.get(n.id);
            if (v < loudest - 2)
                continue;
            if (!winner || n.length > winner.length || n.length === winner.length && v > volumes.get(winner.id))
                winner = n;
        }
        const next = b < source.length && source[b].pitch === source[a].pitch ? source[b].start : Infinity;
        for (let i = a; i < b; i++) {
            const note = source[i];
            if (note !== winner) {
                removed.add(note.id);
                continue;
            }
            if (note.start + note.length > next)
                replacements.set(note.id, { ...note, length: next - note.start });
        }
        a = b;
    }
    let notes = project.notes.filter(n => !removed.has(n.id)).map(n => replacements.get(n.id) ?? n);
    if (removed.size) {
        const after = resolveVolumes(notes);
        notes = notes.map(n => n.instrument === index && n.volume === null && after.get(n.id) !== volumes.get(n.id) ? { ...n, volume: volumes.get(n.id) } : n);
    }
    const originals = new Map(project.notes.map(n => [n.id, n]));
    const changed = removed.size + notes.reduce((count, n) => count + (n !== originals.get(n.id) ? 1 : 0), 0);
    return { notes: changed ? notes : project.notes, changed, shortened: replacements.size, duplicates: removed.size };
}
