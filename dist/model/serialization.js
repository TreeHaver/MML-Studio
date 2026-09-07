import { valid } from './validation.js';
import { recognizeLegacyInstructions } from './instructions.js';
export function parse(text) {
    const p = JSON.parse(text);
    if (p.format !== 'mml-studio' || p.version !== 2 || ![4, 8, 16, 32, 64, 128].includes(p.grid) || !Array.isArray(p.instruments) || !p.instruments.length || !p.instruments.every((i) => typeof i.name === 'string' && /^#[0-9a-f]{6}$/i.test(i.color)) || !Array.isArray(p.notes))
        throw Error('Expected a version 2 MML Studio project.');
    for (const i of p.instruments) {
        if (i.midiProgram !== undefined && (!Number.isInteger(i.midiProgram) || i.midiProgram < 0 || i.midiProgram > 127))
            throw Error('Invalid General MIDI program.');
        if (i.isDrum !== undefined && typeof i.isDrum !== 'boolean')
            throw Error('Invalid drum kit flag.');
    }
    for (const i of p.instruments) {
        if (i.isInstructions !== undefined && typeof i.isInstructions !== 'boolean')
            throw Error('Invalid Instructions flag.');
        if (i.isInstructions && i.isDrum)
            throw Error('Instructions cannot also be a drum kit.');
    }
    for (const i of p.instruments)
        if (i.ms2Drum !== undefined && (!['snare', 'bass', 'cymbals'].includes(i.ms2Drum) || i.isDrum || i.isInstructions))
            throw Error('Invalid MS2 drum instrument.');
    const ids = new Set();
    for (const n of p.notes) {
        if (!Number.isInteger(n.id) || ids.has(n.id) || !Number.isInteger(n.instrument) || !p.instruments[n.instrument] || !(n.volume === null || (Number.isInteger(n.volume) && n.volume >= 0 && n.volume <= 15)))
            throw Error('Invalid note data.');
        ids.add(n.id);
    }
    if (!valid(p.notes))
        throw Error('Invalid timing or conflicting tempo instructions.');
    recognizeLegacyInstructions(p);
    return p;
}
