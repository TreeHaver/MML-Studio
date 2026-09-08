import { SpessaSynthProcessor, SoundBankLoader } from 'spessasynth_core';
import { compilePlayback } from '../playback/midi.js';
import { readSMF } from '../import/smf.js';
import { parse } from '../model/serialization.js';
export const SAMPLE_RATE = 44100;
/** Compile the active view with the same loop/channel compiler as live playback. */
export function audioPlan(request) {
    const project = parse(JSON.stringify(request.project));
    if (!Number.isSafeInteger(request.minimumEnd) || request.minimumEnd < 0 || !Number.isFinite(request.speed) || request.speed < .25 || request.speed > 4 || !Number.isFinite(request.volume) || request.volume < 0 || request.volume > 1 || !Array.isArray(request.muted) || request.muted.some(i => !Number.isInteger(i) || !project.instruments[i]))
        throw Error('Invalid audio export settings.');
    const plan = compilePlayback(project, request.minimumEnd), midi = readSMF(new Uint8Array(plan.binary));
    // Read the actual encoded MIDI clock, including its integer microsecond tempos.
    let tick = 0, seconds = 0, micros = 500000;
    const events = [];
    for (const event of midi.events) {
        seconds += (event.tick - tick) * micros / 1000000 / midi.ppq / request.speed;
        tick = event.tick;
        if (event.meta === 81)
            micros = event.data[0] * 65536 + event.data[1] * 256 + event.data[2];
        else if (event.status < 240)
            events.push({ frame: Math.round(seconds * SAMPLE_RATE), message: [event.status, ...event.data], offset: event.port * 16 });
    }
    const endFrame = Math.round(seconds * SAMPLE_RATE);
    return { ...plan, events, endFrame, mutedChannels: plan.channels.filter(c => request.muted.includes(c.instrument)).map(c => c.channel) };
}
/** Stream stereo PCM without holding the whole recording in memory. No DOM or live synth. */
export async function renderAudio(request, bankBytes, write, progress = () => { }, cancelled = () => false) {
    const plan = audioPlan(request), synth = new SpessaSynthProcessor(SAMPLE_RATE);
    await synth.processorInitialized;
    synth.soundBankManager.addSoundBank(SoundBankLoader.fromArrayBuffer(bankBytes), 'General MIDI');
    const channels = plan.channels.reduce((end, c) => Math.max(end, c.channel + 1), 16);
    while (synth.midiChannels.length < channels)
        synth.createMIDIChannel();
    // New core channels have zeroed controllers and start in drum mode. Reset
    // after creating all ports, then assign roles before MIDI presets and mutes.
    synth.reset();
    for (const route of plan.channels) {
        const owner = plan.project.instruments[route.instrument];
        synth.midiChannels[route.channel].setDrums(!!(owner.isDrum || owner.ms2Drum));
    }
    for (const channel of plan.mutedChannels)
        synth.midiChannels[channel].setSystemParameter('isMuted', true);
    const left = new Float32Array(128), right = new Float32Array(128), chunk = new Float32Array(8192 * 2);
    let frame = 0, index = 0, used = 0, quiet = 0, clipped = 0, lastProgress = -1;
    const tailLimit = plan.endFrame + SAMPLE_RATE * 30;
    try {
        while (frame < tailLimit) {
            if (cancelled())
                throw Error('Audio export canceled.');
            while (index < plan.events.length && plan.events[index].frame <= frame) {
                const event = plan.events[index++];
                synth.processMessage(event.message, event.offset);
            }
            const count = Math.min(128, tailLimit - frame, Math.max(1, (plan.events[index]?.frame ?? Infinity) - frame));
            left.fill(0);
            right.fill(0);
            synth.process(left, right, 0, count);
            let peak = 0;
            for (let i = 0; i < count; i++)
                for (const value of [left[i] * request.volume, right[i] * request.volume]) {
                    if (!Number.isFinite(value))
                        throw Error('The synthesizer produced invalid audio.');
                    peak = Math.max(peak, Math.abs(value));
                    if (Math.abs(value) > 1)
                        clipped++;
                    chunk[used++] = Math.max(-1, Math.min(1, value));
                    if (used === chunk.length) {
                        await write(chunk);
                        used = 0;
                    }
                }
            frame += count;
            quiet = frame >= plan.endFrame && peak < .00001 ? quiet + count : 0;
            const percent = Math.min(99, Math.floor(frame / Math.max(1, plan.endFrame) * 100));
            if (percent !== lastProgress) {
                lastProgress = percent;
                progress(percent / 100);
            }
            if (frame >= plan.endFrame && quiet >= SAMPLE_RATE / 2)
                break;
        }
        if (used)
            await write(chunk.subarray(0, used));
        const warnings = [...plan.warnings];
        if (plan.skipped)
            warnings.push(`${plan.skipped} out-of-range notes were skipped, as in playback.`);
        if (clipped)
            warnings.push('The mix reached full scale. Lower playback volume if you hear distortion.');
        if (frame >= tailLimit)
            warnings.push('The sound release tail was stopped after 30 seconds.');
        return { seconds: frame / SAMPLE_RATE, musicSeconds: plan.endFrame / SAMPLE_RATE, warnings };
    }
    finally {
        synth.stopAllChannels(true);
    }
}
