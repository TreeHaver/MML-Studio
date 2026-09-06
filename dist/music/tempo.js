export const DEFAULT_TEMPO = 120;
export function validTempo(value) {
    return value == null || (typeof value === 'number' && Number.isInteger(value) && value > 0);
}
export function tempoMap(notes) {
    const map = new Map();
    for (const n of notes) {
        if (!validTempo(n.tempo))
            throw Error('Tempo must be a positive whole number of BPM.');
        if (n.tempo == null)
            continue;
        if (map.has(n.start) && map.get(n.start) !== n.tempo)
            throw Error('Conflicting T instructions at the same time. Use one tempo at each position.');
        map.set(n.start, n.tempo);
    }
    if (!map.has(0))
        map.set(0, DEFAULT_TEMPO);
    return [...map].sort((a, b) => a[0] - b[0]).map(([tick, bpm]) => ({ tick, bpm }));
}
export function tempoAt(notes, tick) {
    let bpm = DEFAULT_TEMPO;
    for (const t of tempoMap(notes)) {
        if (t.tick > tick)
            break;
        bpm = t.bpm;
    }
    return bpm;
}
export function tempoChanges(notes) {
    let previous = DEFAULT_TEMPO;
    return tempoMap(notes).filter(event => { const changed = event.bpm !== previous; previous = event.bpm; return changed; });
}
// SMF stores integer microseconds per quarter. Use that same clock for the playhead.
export const secondsPerTick = (bpm) => Math.round(60000000 / bpm) / 1000000 / 32;
export function secondsAtTick(map, tick) {
    let time = 0, previous = 0, bpm = DEFAULT_TEMPO;
    for (const t of map) {
        if (t.tick > tick)
            break;
        time += (t.tick - previous) * secondsPerTick(bpm);
        previous = t.tick;
        bpm = t.bpm;
    }
    return time + (tick - previous) * secondsPerTick(bpm);
}
export function tickAtSeconds(map, time) {
    let previous = 0, bpm = DEFAULT_TEMPO;
    for (const t of map) {
        const span = (t.tick - previous) * secondsPerTick(bpm);
        if (time < span)
            return previous + time / secondsPerTick(bpm);
        time -= span;
        previous = t.tick;
        bpm = t.bpm;
    }
    return previous + time / secondsPerTick(bpm);
}
