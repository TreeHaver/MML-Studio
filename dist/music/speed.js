export const validMultiplier = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;
export function validSpeed(notes) {
    return notes.every(n => ['speedEntry', 'speedExit'].every(k => n[k] === undefined || typeof n[k] === 'boolean') && (n.speedMultiplier === undefined || validMultiplier(n.speedMultiplier)));
}
/** Exits close the innermost zone. An open entry continues to the end. */
export function speedRegions(notes) {
    const regions = [], stack = [], warnings = [];
    for (const n of [...notes].filter(n => n.speedEntry || n.speedExit).sort((a, b) => a.start - b.start || Number(!!b.speedExit) - Number(!!a.speedExit) || a.id - b.id)) {
        if (n.speedExit) {
            const region = stack.pop();
            if (region) {
                region.end = n.start;
                region.exit = n.id;
            }
            else
                warnings.push(`Multiplier Exit at ${n.start} has no Entry; ignored.`);
        }
        if (n.speedEntry) {
            const region = { start: n.start, end: Infinity, multiplier: n.speedMultiplier ?? 2, instrument: n.instrument, entry: n.id };
            regions.push(region);
            stack.push(region);
        }
    }
    return { regions, warnings };
}
export function speedMap(notes) {
    if (!validSpeed(notes))
        throw Error('Speed multiplier must be a positive finite number.');
    const { regions } = speedRegions(notes), ticks = [...new Set([0, ...regions.flatMap(r => Number.isFinite(r.end) ? [r.start, r.end] : [r.start])])].sort((a, b) => a - b);
    let previous = NaN;
    return ticks.flatMap(tick => {
        const multiplier = regions.reduce((v, r) => r.start <= tick && tick < r.end ? v * r.multiplier : v, 1);
        if (!validMultiplier(multiplier))
            throw Error('Combined speed multiplier exceeds the numeric range.');
        if (multiplier === previous)
            return [];
        previous = multiplier;
        return [{ tick, multiplier }];
    });
}
export function speedAt(map, tick) { return map.findLast(t => t.tick <= tick)?.multiplier ?? 1; }
/** Keep inherited zones view-only via the existing projection baseline. */
export function seedSpeedContext(root, notes, start, instrument) {
    const { regions } = speedRegions(root.notes);
    for (const r of regions)
        if (r.end === start && r.start < start) {
            const exit = notes.find(n => n.id === r.exit);
            if (exit)
                exit.speedExit = undefined;
        }
    const active = regions.filter(r => r.start < start && r.end > start);
    let id = root.notes.reduce((min, n) => Math.min(min, n.id), 0) - active.length;
    for (const r of active)
        notes.push({ id: id++, instrument, start: 0, length: 1, pitch: 60, volume: 0, speedEntry: true, speedMultiplier: r.multiplier });
}
