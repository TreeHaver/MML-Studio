import { ensureInstructions } from '../model/instructions.js';
import { tempoMap } from '../music/tempo.js';
import { condenseImportInstructions } from './instructions.js';
const outsideTarget = (bpm) => bpm < 32 || bpm > 255;
export const hasOutOfRangeTempo = (project) => project.notes.some(n => n.tempo != null && outsideTarget(n.tempo));
/** Remove T without removing musical notes or other instruction payloads. */
export function withoutImportedTempos(project) {
    const result = structuredClone(project);
    result.notes = result.notes.filter(n => !(n.tempo != null && result.instruments[n.instrument].isInstructions &&
        !n.timeSignature && !n.section && !n.resetMeasures && !n.loopEntry && !n.loopExit && !n.loopTie && n.loopCount == null && !n.speedEntry && !n.speedExit && n.speedMultiplier == null));
    for (const note of result.notes)
        delete note.tempo;
    return result;
}
function targetTempo(bpm) {
    if (!outsideTarget(bpm))
        return { base: bpm, multiplier: 1 };
    if (bpm < 32) {
        const multiplier = bpm >= 16 ? 0.5 : bpm >= 8 ? 0.25 : 1;
        return { base: bpm / multiplier, multiplier };
    }
    // Keep the closest result within two BPM, preferring ×2 on ties. Never
    // introduce ×3, higher powers or a large tempo clamp to force a conversion.
    const candidates = [2, 4].map(multiplier => ({ base: Math.min(255, Math.round(bpm / multiplier)), multiplier }));
    candidates.sort((a, b) => Math.abs(a.base * a.multiplier - bpm) - Math.abs(b.base * b.multiplier - bpm));
    const best = candidates[0];
    return Math.abs(best.base * best.multiplier - bpm) <= 2 ? best : { base: bpm, multiplier: 1 };
}
/** Explicit import conversion only; parsers and JSON loading preserve source BPM. */
export function applyImportSpeedMultipliers(project, warnings = []) {
    if (!hasOutOfRangeTempo(project))
        return project;
    const clock = tempoMap(project.notes, false);
    const settings = new Map(clock.map(({ bpm }) => [bpm, targetTempo(bpm)]));
    for (const [bpm, { base, multiplier }] of settings) {
        if (outsideTarget(base))
            warnings.push(`Tempo ${bpm} BPM was left unchanged: it cannot fit T32–T255 using ×2/×4 (within 2 BPM), or exact ÷2/÷4 for slow tempos.`);
        else if (base * multiplier !== bpm)
            warnings.push(`Tempo ${bpm} BPM was approximated as ${base * multiplier} BPM (T${base} ×${multiplier}; error ${Math.abs(base * multiplier - bpm)} BPM).`);
    }
    if ([...settings.values()].every(s => s.multiplier === 1))
        return project;
    const converted = structuredClone(project), instrument = ensureInstructions(converted);
    let id = converted.notes.reduce((max, n) => Math.max(max, n.id), 0) + 1, previous = 1;
    for (const note of converted.notes)
        if (note.tempo != null)
            note.tempo = settings.get(note.tempo).base;
    for (const { tick, bpm } of clock) {
        const { multiplier } = settings.get(bpm);
        if (multiplier === previous)
            continue;
        converted.notes.push({ id: id++, instrument, start: tick, length: 1, pitch: 60, volume: 0,
            ...(previous !== 1 ? { speedExit: true } : {}),
            ...(multiplier !== 1 ? { speedEntry: true, speedMultiplier: multiplier } : {}) });
        previous = multiplier;
    }
    condenseImportInstructions(converted, warnings);
    return converted;
}
