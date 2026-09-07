import { samplePitch, tuningControllers, tuningWheel } from './sample-pitch.js';
import { partitionChannels } from '../music/channels.js';
import { playbackPitch } from './drums.js';
import { expandLoops } from '../music/loops.js';
import { tempoMap, secondsAtTick } from '../music/tempo.js';
import { valid } from '../model/validation.js';
import { resolveVolumes } from '../music/volume.js';
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
export function heldPlaybackNotes(project, channels, tick) {
    const routing = new Map();
    for (const c of channels)
        for (const id of c.noteIds)
            routing.set(id, c.channel);
    const notes = project.notes.filter(n => routing.has(n.id) && n.start < tick).sort((a, b) => a.start - b.start || a.id - b.id);
    const volumes = resolveVolumes(notes), held = [];
    for (const n of notes) {
        if (n.start + n.length <= tick)
            continue;
        const pitch = playbackPitch(project.instruments[n.instrument], n.pitch), velocity = Math.round((volumes.get(n.id) ?? 8) * 127 / 15);
        if (pitch >= 0 && pitch <= 127 && velocity > 0) {
            const instrument = project.instruments[n.instrument], sample = samplePitch(pitch, instrument.midiProgram ?? 0, !!(instrument.isDrum || instrument.ms2Drum));
            held.push({ channel: routing.get(n.id), pitch: sample.pitch, velocity, ...(sample.tuning ? { tuning: sample.tuning } : {}) });
        }
    }
    return held;
}
export function compilePlayback(project, minimumEnd = 0) {
    const expanded = expandLoops(project, minimumEnd);
    project = expanded.project;
    minimumEnd = expanded.end;
    if (!valid(project.notes))
        throw Error('Invalid notes or conflicting tempo instructions.');
    const map = tempoMap(project.notes), end = project.notes.reduce((end, n) => Math.max(end, n.start + n.length), minimumEnd);
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
        const notes = byInstrument.get(instrument);
        const volumes = resolveVolumes(notes);
        // Use the same monophonic allocation as MML, including within one Instrument.
        const owner = project.instruments[instrument], groups = new Map();
        for (const n of notes) {
            const sample = samplePitch(playbackPitch(owner, n.pitch), owner.midiProgram ?? 0, !!(owner.isDrum || owner.ms2Drum));
            const group = groups.get(sample.tuning) ?? [];
            group.push(n);
            groups.set(sample.tuning, group);
        }
        // Tuning stays fixed for each route, including release tails and seek restoration.
        for (const [tuning, group] of groups)
            for (const lane of partitionChannels(group)) {
                const drums = project.instruments[instrument]?.isDrum === true || !!project.instruments[instrument]?.ms2Drum;
                const slot = drums ? drumSlot++ : melodicSlot++;
                const port = drums ? slot : Math.floor(slot / 15), local = slot % 15, channel = drums ? 9 : local >= 9 ? local + 1 : local;
                channels.push({ instrument, channel: port * 16 + channel, noteIds: lane.map(n => n.id), ...(tuning ? { tuning } : {}) });
                if (port > 127)
                    throw Error('The required playback channels exceed the MIDI port range. The project is unchanged.');
                const program = drums ? 0 : project.instruments[instrument]?.midiProgram ?? 0;
                if (!Number.isInteger(program) || program < 0 || program > 127)
                    throw Error('Invalid GM preset.');
                const events = [{ tick: 0, order: -3, data: [255, 33, 1, port] }, { tick: 0, order: -2, data: [176 + channel, 0, 0] }, { tick: 0, order: -1, data: [176 + channel, 32, 0] }, { tick: 0, order: 0, data: [192 + channel, program] }];
                for (const [cc, value] of tuningControllers())
                    events.push({ tick: 0, order: 0, data: [176 + channel, cc, value] });
                const wheel = tuningWheel(tuning);
                events.push({ tick: 0, order: 0, data: [224 + channel, wheel & 127, (wheel >> 7) & 127] });
                for (const n of lane) {
                    const pitch = playbackPitch(project.instruments[instrument], n.pitch), velocity = Math.round((volumes.get(n.id) ?? 8) * 127 / 15);
                    if (pitch < 0 || pitch > 127) {
                        skipped++;
                        continue;
                    }
                    if (velocity === 0)
                        continue;
                    events.push({ tick: n.start, order: 2, data: [144 + channel, pitch - tuning, velocity] }, { tick: n.start + n.length, order: 1, data: [128 + channel, pitch - tuning, 0] });
                }
                tracks.push(track(events, end));
            }
    });
    const data = [77, 84, 104, 100, 0, 0, 0, 6, 0, 1, ...word(tracks.length), 0, 32];
    // Avoid spreading a long song into a single function call.
    for (const t of tracks)
        for (const byte of t)
            data.push(byte);
    return { channels, binary: new Uint8Array(data).buffer, map, duration: secondsAtTick(map, end), end, skipped, project, warnings: expanded.warnings, sourceTick: expanded.sourceTick, performanceTick: expanded.performanceTick };
}
