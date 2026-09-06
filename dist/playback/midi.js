import { tempoMap, secondsAtTick } from '../music/tempo.js';
import { valid } from '../model/validation.js';
function variable(value) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 0xfffffff)
        throw Error('Playback position exceeds the MIDI timing range.');
    const bytes = [value & 127];
    while ((value = Math.floor(value / 128)) > 0)
        bytes.unshift((value & 127) | 128);
    return bytes;
}
const word = (v) => [(v >>> 8) & 255, v & 255];
const dword = (v) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
function track(events, end) {
    const data = [];
    let previous = 0;
    events.sort((a, b) => a.tick - b.tick || a.order - b.order);
    for (const e of events) {
        data.push(...variable(e.tick - previous), ...e.data);
        previous = e.tick;
    }
    data.push(...variable(Math.max(end, previous) - previous), 255, 47, 0);
    return [77, 84, 114, 107, ...dword(data.length), ...data];
}
export function compilePlayback(project) {
    if (!valid(project.notes))
        throw Error('Invalid notes or conflicting tempo instructions.');
    const map = tempoMap(project.notes), end = project.notes.reduce((end, n) => Math.max(end, n.start + n.length), 0);
    const conductor = map.map(({ tick, bpm }) => { const micros = Math.round(60000000 / bpm); if (micros < 1 || micros > 0xffffff)
        throw Error('This tempo cannot be represented by the MIDI preview engine. The project is unchanged.'); return { tick, order: 0, data: [255, 81, 3, (micros >>> 16) & 255, (micros >>> 8) & 255, micros & 255] }; });
    const tracks = [track(conductor, end)];
    let skipped = 0;
    const byInstrument = new Map();
    for (const n of project.notes) {
        if (project.instruments[n.instrument]?.isInstructions)
            continue;
        const notes = byInstrument.get(n.instrument) ?? [];
        notes.push(n);
        byInstrument.set(n.instrument, notes);
    }
    const used = [...byInstrument.keys()].sort((a, b) => a - b);
    const channels = [];
    let melodicSlot = 0, drumSlot = 0;
    used.forEach(instrument => {
        // Each drum lane gets channel 10 on its own port, so overlapping drum
        // notes in separate editor instruments cannot cut each other off.
        const drums = project.instruments[instrument]?.isDrum === true;
        const slot = drums ? drumSlot++ : melodicSlot++;
        const port = drums ? slot : Math.floor(slot / 15), local = slot % 15, channel = drums ? 9 : local >= 9 ? local + 1 : local;
        channels.push({ instrument, channel: port * 16 + channel });
        if (port > 127)
            throw Error('Too many playback instruments.');
        const program = drums ? 0 : project.instruments[instrument]?.midiProgram ?? 0;
        if (!Number.isInteger(program) || program < 0 || program > 127)
            throw Error('Invalid GM preset.');
        const events = [{ tick: 0, order: -3, data: [255, 33, 1, port] }, { tick: 0, order: -2, data: [176 + channel, 0, 0] }, { tick: 0, order: -1, data: [176 + channel, 32, 0] }, { tick: 0, order: 0, data: [192 + channel, program] }];
        const notes = byInstrument.get(instrument).sort((a, b) => a.start - b.start || a.id - b.id);
        let inherited = 8;
        for (let begin = 0; begin < notes.length;) {
            let finish = begin + 1;
            while (finish < notes.length && notes[finish].start === notes[begin].start)
                finish++;
            // Same-start V instructions use the highest ID, matching volumeAt.
            for (let i = begin; i < finish; i++)
                if (notes[i].volume !== null)
                    inherited = notes[i].volume;
            const velocity = Math.round(inherited * 127 / 15);
            for (let i = begin; i < finish; i++) {
                const n = notes[i];
                if (n.pitch < 0 || n.pitch > 127) {
                    skipped++;
                    continue;
                }
                if (velocity === 0)
                    continue;
                events.push({ tick: n.start, order: 2, data: [144 + channel, n.pitch, velocity] }, { tick: n.start + n.length, order: 1, data: [128 + channel, n.pitch, 0] });
            }
            begin = finish;
        }
        tracks.push(track(events, end));
    });
    const data = [77, 84, 104, 100, 0, 0, 0, 6, 0, 1, ...word(tracks.length), 0, 32];
    // Avoid spreading a long song into a single function call.
    for (const t of tracks)
        for (const byte of t)
            data.push(byte);
    return { channels, binary: new Uint8Array(data).buffer, map, duration: secondsAtTick(map, end), end, skipped };
}
