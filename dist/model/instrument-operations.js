import { MS2_DRUMS, drumCategory } from '../playback/drums.js';
import { colors } from './project.js';
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
// Materialize both affected lanes before partitioning to preserve their original V inheritance.
function resolvedNotes(project, lanes) {
    const volumes = new Map();
    for (const lane of lanes) {
        const notes = project.notes.filter(n => n.instrument === lane).sort((a, b) => a.start - b.start || a.id - b.id);
        let v = 8;
        for (let a = 0; a < notes.length;) {
            let b = a;
            while (b < notes.length && notes[b].start === notes[a].start) {
                if (notes[b].volume !== null)
                    v = notes[b].volume;
                b++;
            }
            for (; a < b; a++)
                volumes.set(notes[a].id, v);
        }
    }
    return project.notes.map(n => ({ ...n, ...(volumes.has(n.id) ? { volume: volumes.get(n.id) } : {}) }));
}
export function parseSplitPitch(text) {
    const match = /^([A-Ga-g])(#|b)?(-?\d+)$/.exec(text.trim());
    if (!match)
        throw Error('Enter a note name such as B1 or C#3.');
    const pitch = (Number(match[3]) + 1) * 12 + ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1].toUpperCase()]) + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0);
    if (!Number.isSafeInteger(pitch))
        throw Error('Invalid note octave.');
    return pitch;
}
export function splitNotes(project, source, target, pitch) {
    check(project, source);
    check(project, target);
    if (source === target)
        throw Error('Choose a different destination.');
    if (project.instruments[source].isInstructions || project.instruments[target].isInstructions)
        throw Error('Split notes between musical instruments only.');
    const count = project.notes.filter(n => n.instrument === source && n.pitch === pitch).length;
    if (!count)
        return { project, count, volumeConflict: false };
    const notes = resolvedNotes(project, new Set([source, target])).map(n => n.instrument === source && n.pitch === pitch ? { ...n, instrument: target } : n);
    const volumes = new Map();
    let volumeConflict = false;
    for (const n of notes.filter(n => n.instrument === target)) {
        if (volumes.has(n.start) && volumes.get(n.start) !== n.volume)
            volumeConflict = true;
        volumes.set(n.start, n.volume);
    }
    return { project: { ...project, notes }, count, volumeConflict };
}
export function splitDrumkit(project, source) {
    check(project, source);
    if (!project.instruments[source].isDrum)
        throw Error('Select a Standard Drum Kit.');
    const instruments = [...project.instruments], destinations = new Map();
    let count = 0;
    for (const n of project.notes.filter(n => n.instrument === source)) {
        const key = drumCategory(n.pitch);
        if (!key || destinations.has(key))
            continue;
        destinations.set(key, instruments.length);
        instruments.push({ name: MS2_DRUMS[key].name, color: colors[instruments.length % colors.length], ms2Drum: key });
    }
    if (!destinations.size)
        return { project, count };
    const notes = resolvedNotes(project, new Set([source])).map(n => { const key = n.instrument === source ? drumCategory(n.pitch) : undefined; if (!key)
        return n; count++; return { ...n, instrument: destinations.get(key) }; });
    return { project: { ...project, instruments, notes }, count };
}
