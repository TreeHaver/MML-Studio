export function readSMF(bytes) {
    let pos = 0, limit = bytes.length;
    const need = (n) => { if (n < 0 || pos + n > limit)
        throw Error('Truncated MIDI file.'); };
    const byte = () => { need(1); return bytes[pos++]; };
    const word = () => byte() * 256 + byte();
    const uint = () => word() * 65536 + word();
    const tag = () => String.fromCharCode(byte(), byte(), byte(), byte());
    const vlq = () => { let value = 0; for (let i = 0; i < 4; i++) {
        const b = byte();
        value = value * 128 + (b & 127);
        if (!(b & 128))
            return value;
    } throw Error('Invalid MIDI variable-length value.'); };
    const take = (n) => { need(n); const data = bytes.subarray(pos, pos + n); pos += n; return data; };
    if (tag() !== 'MThd')
        throw Error('Expected a Standard MIDI File (.mid or .midi).');
    const headerLength = uint();
    if (headerLength < 6)
        throw Error('Invalid MIDI header.');
    need(headerLength);
    const format = word(), tracks = word(), ppq = word();
    pos += headerLength - 6;
    if (format !== 0 && format !== 1)
        throw Error('Only MIDI formats 0 and 1 are supported; convert format 2 to format 1 first.');
    if (!tracks || (format === 0 && tracks !== 1))
        throw Error('Invalid MIDI track count.');
    if (ppq & 0x8000)
        throw Error('SMPTE-timed MIDI is not supported; export with ticks-per-quarter-note timing.');
    if (!ppq)
        throw Error('Invalid MIDI timing resolution.');
    const events = [], names = [], warnings = [];
    let end = 0;
    for (let track = 0; track < tracks; track++) {
        limit = bytes.length;
        if (tag() !== 'MTrk')
            throw Error('Expected a MIDI track chunk.');
        const length = uint();
        need(length);
        limit = pos + length;
        let tick = 0, running = 0, port = 0, ended = false;
        names.push(`Track ${track + 1}`);
        while (pos < limit) {
            tick += vlq();
            if (!Number.isSafeInteger(tick))
                throw Error('MIDI timeline is too long.');
            let status = byte();
            if (status < 128) {
                if (!running)
                    throw Error('Invalid MIDI running status.');
                pos--;
                status = running;
            }
            if (status === 255) {
                running = 0;
                const meta = byte(), data = take(vlq());
                if (meta === 3)
                    names[track] = new TextDecoder().decode(data).replace(/[\x00-\x1f]/g, '').trim() || names[track];
                if (meta === 33) {
                    if (data.length !== 1 || data[0] > 127)
                        throw Error('Invalid MIDI port.');
                    port = data[0];
                }
                if (meta === 81 && (data.length !== 3 || data.every(b => b === 0)))
                    throw Error('Invalid MIDI tempo.');
                events.push({ tick, track, port, status, data, meta });
                if (meta === 47) {
                    if (data.length)
                        throw Error('Invalid end-of-track event.');
                    ended = true;
                    pos = limit;
                    break;
                }
            }
            else if (status === 240 || status === 247) {
                running = 0;
                events.push({ tick, track, port, status, data: take(vlq()) });
            }
            else {
                if (status < 128 || status >= 240)
                    throw Error('Unsupported MIDI system event.');
                running = status;
                const data = take((status >> 4) === 12 || (status >> 4) === 13 ? 1 : 2);
                if (data.some(b => b > 127))
                    throw Error('Invalid MIDI channel data.');
                events.push({ tick, track, port, status, data });
            }
        }
        if (!ended)
            warnings.push(`Track ${track + 1} has no end-of-track marker.`);
        end = Math.max(end, tick);
    }
    // Stable sorting keeps track/event order when timestamps coincide.
    events.sort((a, b) => a.tick - b.tick);
    return { ppq, names, events, end, warnings };
}
