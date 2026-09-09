import { partitionChannels } from './channels.js';
import { expandLoops } from './loops.js';
import { generateMml } from './mml.js';
import { resolveVolumes } from './volume.js';
import { tempoMap } from './tempo.js';
import { speedMap } from './speed.js';
const CHANNELS = 10, PLAYERS = 10;
/** Simultaneously started sheets for one sound. Never cut/restart a held note.
 * Try chronological and voice-first packing, then coalesce fitting sheets.
 * This is a verified heuristic, not an exhaustive minimum-score search.
 */
export function createLazyEnsemble(source, indexes = source.instruments.map((_, i) => i), minimumEnd = 0, extremeCompression = false, limit = 10000) {
    if (!Number.isSafeInteger(limit) || limit < 1)
        throw Error('Character limit must be a positive whole number.');
    const expanded = expandLoops(source, minimumEnd), project = expanded.project;
    const volumes = resolveVolumes(project.notes), selected = new Set(indexes);
    const notes = project.notes.filter(n => selected.has(n.instrument) && !project.instruments[n.instrument]?.isInstructions)
        .map(n => ({ ...n, instrument: 0, volume: volumes.get(n.id) ?? 8, tempo: null }));
    const merged = { ...project, instruments: [{ name: 'Lazy Ensemble', color: '#abcdef' }], notes: [] };
    const tempos = tempoMap(project.notes, false), speeds = speedMap(project.notes);
    const render = (notes, warnings = false) => generateMml(merged, 0, notes, tempos, { endTick: expanded.end, speeds, extremeCompression, compactRests: true, skipWarnings: !warnings });
    const fits = (result) => result.channels.length <= CHANNELS && result.bytes <= limit;
    const tooMany = () => Error(`Lazy Ensemble could not fit the music on 10 players with ${limit.toLocaleString()} characters per player. No files were saved.`);
    if (!notes.length)
        return { parts: [], end: expanded.end, warnings: expanded.warnings };
    const voices = partitionChannels(notes);
    if (voices.length > CHANNELS * PLAYERS)
        throw tooMany();
    const whole = render(notes, true);
    if (fits(whole))
        return { parts: [whole], end: expanded.end, warnings: [...new Set([...expanded.warnings, ...whole.warnings])] };
    const pack = (ordered) => {
        const bins = [];
        let start = 0;
        while (start < ordered.length) {
            let count = 1, result = render(ordered.slice(start, start + 1));
            if (!fits(result))
                throw Error(`A complete note and its synchronized rests cannot fit within ${limit.toLocaleString()} characters. Lazy Ensemble cannot split held notes without changing their sound.`);
            // Exponential growth bounds work on long scores; binary refinement always
            // retains a measured fitting candidate despite non-monotonic text lengths.
            let high = 2;
            while (start + high <= ordered.length) {
                const next = render(ordered.slice(start, start + high));
                if (!fits(next))
                    break;
                count = high;
                result = next;
                high *= 2;
            }
            let low = count + 1;
            high = Math.min(high, ordered.length - start);
            while (low <= high) {
                const mid = Math.floor((low + high) / 2), next = render(ordered.slice(start, start + mid));
                if (fits(next)) {
                    count = mid;
                    result = next;
                    low = mid + 1;
                }
                else
                    high = mid - 1;
            }
            bins.push({ notes: ordered.slice(start, start + count), result });
            start += count;
        }
        // Re-encode unions so disjoint passages reuse channels and controller state.
        for (let i = 0; i < bins.length; i++)
            for (let j = i + 1; j < bins.length;) {
                const union = [...bins[i].notes, ...bins[j].notes], result = render(union);
                if (fits(result)) {
                    bins[i] = { notes: union, result };
                    bins.splice(j, 1);
                    j = i + 1;
                }
                else
                    j++;
            }
        return bins;
    };
    const chronological = [...notes].sort((a, b) => a.start - b.start || a.id - b.id);
    const candidates = [pack(chronological), pack(voices.flat())];
    candidates.sort((a, b) => a.length - b.length || a.reduce((s, b) => s + b.result.bytes, 0) - b.reduce((s, b) => s + b.result.bytes, 0));
    if (candidates[0].length > PLAYERS)
        throw tooMany();
    const parts = candidates[0].map(bin => render(bin.notes, true));
    if (parts.some(part => !fits(part)))
        throw Error('Lazy Ensemble sheet verification failed.');
    return { parts, end: expanded.end, warnings: [...new Set([...expanded.warnings, ...parts.flatMap(part => part.warnings)])] };
}
