/** Compact compiler-generated MML without changing timing or controller state.
 * Input has explicit note/rest lengths; ties immediately prefix continuations.
 * Each channel starts with the MML defaults L4 and V8.
 */
export function optimizeInstructions(text) {
    const tokens = text.match(/[tov]-?\d+|&?[a-gr][+-]?\d+\.?/g) ?? [];
    if (tokens.join('') !== text)
        throw Error('Unexpected compiler MML syntax.');
    const events = tokens.map(token => {
        const match = token.match(/^(&?[a-gr][+-]?)(\d+)(\.?)$/);
        return match ? { symbol: match[1], length: match[2], dot: match[3] } : null;
    });
    // MS2 accepts explicit c128/r128, but default-length L stops at L64.
    const defaults = [...new Set(['4', ...events.flatMap(event => event && Number(event.length) <= 64 ? [event.length + event.dot] : [])])];
    const suffix = (event, state) => defaults[state] === event.length + event.dot ? '' : defaults[state] === event.length ? event.dot : event.length + event.dot;
    const indices = new Map(defaults.map((length, index) => [length, index]));
    const count = defaults.length, choices = new Uint8Array(events.length * count);
    let costs = new Float64Array(count);
    // Backwards dynamic programming: retain the default, or change it to this
    // event's denominator. Other changes can always wait until they are used.
    // Ties prefer retaining the default, avoiding pointless L instructions.
    for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i];
        if (!event)
            continue;
        const target = indices.get(event.length + event.dot), next = new Float64Array(count);
        const change = target === undefined ? Infinity : 1 + event.length.length + event.dot.length + costs[target];
        for (let state = 0; state < count; state++) {
            const keep = suffix(event, state).length + costs[state];
            const useChange = change < keep;
            next[state] = useChange ? change : keep;
            choices[i * count + state] = Number(useChange);
        }
        costs = next;
    }
    const result = [];
    let state = 0, volume = 8;
    for (let i = 0; i < tokens.length; i++) {
        const event = events[i];
        if (event) {
            if (choices[i * count + state]) {
                state = indices.get(event.length + event.dot);
                result.push('l' + event.length + event.dot);
            }
            // L precedes &, so tempo/length commands never interrupt a tie prefix.
            result.push(event.symbol + suffix(event, state));
        }
        else if (tokens[i][0] === 'v') {
            const value = Number(tokens[i].slice(1));
            if (value !== volume) {
                result.push(tokens[i]);
                volume = value;
            }
        }
        else
            result.push(tokens[i]);
    }
    return result.join('');
}
