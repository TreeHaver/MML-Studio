/** Import-only normalization. Musical note-bound settings and JSON loading are
 * untouched; silent records at one timestamp share one payload and surviving ID. */
export function condenseImportInstructions(project, warnings = []) {
    const at = new Map(), aliases = new Map(), notes = [];
    const fields = ['tempo', 'timeSignature', 'section', 'resetMeasures', 'loopEntry', 'loopExit', 'loopTie', 'loopCount', 'speedEntry', 'speedExit', 'speedMultiplier'];
    for (const note of project.notes) {
        if (!project.instruments[note.instrument]?.isInstructions) {
            notes.push(note);
            continue;
        }
        const existing = at.get(note.start);
        if (!existing) {
            at.set(note.start, note);
            notes.push(note);
            continue;
        }
        for (const field of fields) {
            const value = note[field];
            if (value == null)
                continue;
            if (existing[field] != null && existing[field] !== value)
                warnings.push(`Imported ${field} at tick ${note.start} replaced a conflicting instruction value; the last encountered value wins.`);
            existing[field] = value;
        }
        aliases.set(note.id, existing.id);
    }
    project.notes = notes;
    return aliases;
}
