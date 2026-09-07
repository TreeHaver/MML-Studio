import { hasOverlappingNotes } from './note-density.js';
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
        const o = Math.floor(n.pitch / 12) - 1, v = volumes.get(n.id) ?? 8;
        if (o !== octave) {
            parts.push('o' + o);
            octave = o;
        }
        if (v !== volume) {
            parts.push('v' + v);
            volume = v;
        }
        span(pitches[((n.pitch % 12) + 12) % 12], n.start + n.length);
    }
    if (endTick !== undefined)
        span('r', endTick);
    return optimizeInstructions(parts.join(''));
}
export function generateMml(project, index, source = project.notes.filter(n => n.instrument === index), tempos = tempoMap(project.notes), options = {}) {
    const instrument = project.instruments[index], warnings = [];
    if (instrument.isInstructions)
        return { channels: [], bytes: 0, warnings: ['Global tempo instructions are included in every musical channel.'] };
    const overlap = !options.skipWarnings && hasOverlappingNotes(source);
    if (instrument.ms2Drum)
        source = source.map(n => ({ ...n, pitch: 60 }));
    if (instrument.isDrum)
        warnings.push('Standard Drum Kit is not a valid MS2 instrument.');
    if (tempos.some(t => t.bpm < 32 || t.bpm > 255))
        warnings.push('Tempo outside MS2 T32–T255: retained unchanged; resolve before export.');
    if (source.some(n => n.pitch < 12 || n.pitch > 119))
        warnings.push('Pitch outside MS2 O0–O8: retained unchanged; resolve before export.');
    const notes = [...source].sort((a, b) => a.start - b.start || a.id - b.id), volumes = new Map();
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
    // Min-heap of channel end times: minimum voices for the interval partition.
    const lanes = [], heap = [];
    for (const n of notes) {
        let lane;
        if (heap.length && heap[0].end <= n.start) {
            lane = heap[0].index;
            heap[0] = heap[heap.length - 1];
            heap.pop();
            let p = 0;
            while (p < heap.length) {
                let c = p * 2 + 1;
                if (c >= heap.length)
                    break;
                if (c + 1 < heap.length && heap[c + 1].end < heap[c].end)
                    c++;
                if (heap[p].end <= heap[c].end)
                    break;
                [heap[p], heap[c]] = [heap[c], heap[p]];
                p = c;
            }
        }
        else {
            lane = lanes.length;
            lanes.push([]);
        }
        lanes[lane].push(n);
        heap.push({ end: n.start + n.length, index: lane });
        let p = heap.length - 1;
        while (p > 0) {
            const parent = (p - 1) >> 1;
            if (heap[parent].end <= heap[p].end)
                break;
            [heap[parent], heap[p]] = [heap[p], heap[parent]];
            p = parent;
        }
    }
    if (!lanes.length && options.endTick)
        lanes.push([]);
    const channels = lanes.map(lane => voice(lane, tempos, options.volumes ?? volumes, options.endTick));
    if (overlap)
        warnings.push('Overlapping notes: same start time and pitch in this instrument; MS2 may produce strange behavior.');
    if (channels.length > 10)
        warnings.push(`Over 10 Channels: ${channels.length} required. All instructions are retained.`);
    // Generated syntax is ASCII only: one character is exactly one UTF-8 byte.
    const bytes = channels.reduce((total, text) => total + text.length, 0);
    return { channels, bytes, warnings };
}
