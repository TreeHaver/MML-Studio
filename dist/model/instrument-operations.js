import { fresh } from './project.js';
function check(project, index) {
    if (!Number.isInteger(index) || !project.instruments[index])
        throw Error('Choose an existing instrument.');
}
export function deleteInstrument(project, index) {
    check(project, index);
    const instruments = project.instruments.filter((_, i) => i !== index);
    return { ...project, instruments: instruments.length ? instruments : fresh().instruments,
        notes: project.notes.filter(n => n.instrument !== index).map(n => ({ ...n, instrument: n.instrument > index ? n.instrument - 1 : n.instrument })) };
}
export function mergeInstruments(project, source, target) {
    check(project, source);
    check(project, target);
    if (source === target)
        throw Error('Choose a different destination.');
    if (!!project.instruments[source].isInstructions !== !!project.instruments[target].isInstructions)
        throw Error('Merge silent Instructions with another Instructions instrument; merge musical instruments with musical instruments.');
    // Resolve each original lane before combining, so interleaved notes retain V inheritance.
    const volumes = new Map();
    for (const index of [source, target]) {
        const notes = project.notes.filter(n => n.instrument === index).sort((a, b) => a.start - b.start || a.id - b.id);
        let volume = 8;
        for (let a = 0; a < notes.length;) {
            let b = a;
            while (b < notes.length && notes[b].start === notes[a].start) {
                if (notes[b].volume !== null)
                    volume = notes[b].volume;
                b++;
            }
            for (; a < b; a++)
                volumes.set(notes[a].id, volume);
        }
    }
    const simultaneous = new Map();
    let volumeConflict = false;
    const notes = project.notes.map(n => {
        if (!volumes.has(n.id))
            return { ...n, instrument: n.instrument > source ? n.instrument - 1 : n.instrument };
        const volume = volumes.get(n.id);
        if (simultaneous.has(n.start) && simultaneous.get(n.start) !== volume)
            volumeConflict = true;
        simultaneous.set(n.start, volume);
        return { ...n, volume, instrument: target > source ? target - 1 : target };
    });
    return { project: { ...project, instruments: project.instruments.filter((_, i) => i !== source), notes }, volumeConflict };
}
