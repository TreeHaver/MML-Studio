import { resolveVolumes } from './volume.js';
const names = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const pitchClass = (pitch) => ((pitch % 12) + 12) % 12;
/** Whole-project major/natural-minor estimate, weighted by duration and onset V.
 * Coverage is pitch membership, not a probability of the song's key. */
export function detectScale(project) {
    const weights = Array(12).fill(0), volumes = resolveVolumes(project.notes);
    for (const n of project.notes) {
        const instrument = project.instruments[n.instrument];
        if (!instrument || instrument.isInstructions || instrument.isDrum || instrument.ms2Drum)
            continue;
        weights[pitchClass(n.pitch)] += n.length * (volumes.get(n.id) ?? 8);
    }
    const total = weights.reduce((a, b) => a + b, 0);
    if (!total)
        return null;
    const candidates = [];
    for (let root = 0; root < 12; root++)
        for (const [mode, steps] of [['major', [0, 2, 4, 5, 7, 9, 11]], ['minor', [0, 2, 3, 5, 7, 8, 10]]]) {
            const pitches = steps.map(step => (root + step) % 12), coverage = pitches.reduce((sum, p) => sum + weights[p], 0) / total;
            const score = coverage + 0.05 * weights[root] / total + 0.02 * weights[(root + 7) % 12] / total;
            candidates.push({ name: names[root] + ' ' + mode, pitches, coverage, score });
        }
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    return { name: best.name, pitches: best.pitches, coverage: best.coverage, alternative: candidates[1].name };
}
