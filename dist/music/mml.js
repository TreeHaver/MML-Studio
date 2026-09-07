import { partitionChannels } from './channels.js';
import { hasOverlappingNotes } from './note-density.js';
import { resolveVolumes } from './volume.js';
import { expandLoops } from './loops.js';
import { DRUM_KIT_NAME, DRUM_MS2_WARNING } from '../playback/drums.js';
import { tempoMap } from './tempo.js';
import { optimizeInstructions } from './mml-optimizer.js';
const pitches = ['c', 'c+', 'd', 'd+', 'e', 'f', 'f+', 'g', 'g+', 'a', 'a+', 'b'];
// Every stored integer duration is exact. Ties are duration decomposition,
// not snapping to the editor grid. The optimizer may use dotted L defaults.
const lengths = Array.from({ length: 8 }, (_, i) => 2 ** i).flatMap(d => [
    { units: 128 / d, text: String(d) }, ...(d < 128 ? [{ units: 192 / d, text: d + '.' }] : [])
]).sort((a, b) => b.units - a.units);
function duration(symbol, units) {
    const parts = [];
    for (const l of lengths)
        while (units >= l.units) {
            parts.push(symbol + l.text);
            units -= l.units;
        }
    return parts.join(symbol === 'r' ? '' : '&');
}
function voice(notes, tempos, volumes, endTick) {
    const parts = [];
    let tick = 0, event = 0, octave = -99, volume = -1;
    const tempo = () => { while (event < tempos.length && tempos[event].tick === tick)
        parts.push('t' + tempos[event++].bpm); };
    const span = (symbol, end) => {
        let continuation = false;
        while (tick < end) {
            tempo();
            const stop = Math.min(end, tempos[event]?.tick ?? Infinity);
            // & prefixes the continued note, after any tempo instruction at this tick.
            if (continuation && symbol !== 'r')
                parts.push('&');
            parts.push(duration(symbol, stop - tick));
            tick = stop;
            continuation = true;
        }
    };
    for (const n of notes) {
        span('r', n.start);
        tempo();
        const o = n.pitch === 11 ? 0 : n.pitch === 120 ? 8 : Math.floor(n.pitch / 12) - 1, v = volumes.get(n.id) ?? 8;
        if (o !== octave) {
            parts.push('o' + o);
            octave = o;
        }
        if (v !== volume) {
            parts.push('v' + v);
            volume = v;
        }
        span(n.pitch === 11 ? 'c-' : n.pitch === 120 ? 'b+' : pitches[((n.pitch % 12) + 12) % 12], n.start + n.length);
    }
    if (endTick !== undefined)
        span('r', endTick);
    return optimizeInstructions(parts.join(''));
}
export function generateMml(project, index, source = project.notes.filter(n => n.instrument === index), tempos = tempoMap(project.notes), options = {}) {
    if (project.notes.some(n => project.instruments[n.instrument]?.isInstructions && (n.loopEntry || n.loopExit))) {
        const expanded = expandLoops(project);
        if (expanded.project !== project) {
            const result = generateMml(expanded.project, index, undefined, undefined, { endTick: expanded.end });
            result.warnings.push(...expanded.warnings);
            return result;
        }
        const clean = { ...project, notes: project.notes.map(n => ({ ...n, loopEntry: undefined, loopExit: undefined })) };
        const result = generateMml(clean, index, source, tempos, options);
        result.warnings.push(...expanded.warnings);
        return result;
    }
    const instrument = project.instruments[index], warnings = [];
    if (instrument.isInstructions)
        return { channels: [], bytes: 0, warnings: ['Global tempo instructions are included in every musical channel.'] };
    const overlap = !options.skipWarnings && hasOverlappingNotes(source);
    if (instrument.ms2Drum)
        source = source.map(n => ({ ...n, pitch: 60 }));
    if (instrument.isDrum)
        warnings.push(`${DRUM_KIT_NAME}: ${DRUM_MS2_WARNING}`);
    if (tempos.some(t => t.bpm < 32 || t.bpm > 255))
        warnings.push('Tempo outside MS2 T32–T255: retained unchanged; resolve before export.');
    if (source.some(n => n.pitch < 11 || n.pitch > 120))
        warnings.push('Pitch outside MS2 O0–O8 including C-/B+ boundaries: retained unchanged; resolve before export.');
    const notes = [...source].sort((a, b) => a.start - b.start || a.id - b.id), volumes = options.volumes ?? resolveVolumes(notes);
    const lanes = partitionChannels(notes);
    if (!lanes.length && options.endTick)
        lanes.push([]);
    const channels = lanes.map(lane => voice(lane, tempos, volumes, options.endTick));
    if (overlap)
        warnings.push('Overlapping notes: same start time and pitch in this instrument; MS2 may produce strange behavior.');
    if (channels.length > 10)
        warnings.push(`Over 10 Channels: ${channels.length} required. All instructions are retained.`);
    // Generated syntax is ASCII only: one character is exactly one UTF-8 byte.
    const bytes = channels.reduce((total, text) => total + text.length, 0);
    return { channels, bytes, warnings };
}
