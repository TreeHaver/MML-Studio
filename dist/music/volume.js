export function volumeAt(project, n) {
    return project.notes.filter(o => o.instrument === n.instrument && o.start <= n.start && o.volume !== null).sort((a, b) => b.start - a.start || b.id - a.id)[0]?.volume ?? 8;
}
