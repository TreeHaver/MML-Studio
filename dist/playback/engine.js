import { samplePitch, tuningControllers, tuningWheel } from './sample-pitch.js';
// Independent lazy synths keep keyboard previews from changing song channels.
let masterVolume = 1;
const outputs = new Set();
export function setMasterVolume(value) {
    masterVolume = Math.max(0, Math.min(1, value));
    for (const output of outputs)
        output.gain.setTargetAtTime(masterVolume, output.context.currentTime, .015);
}
async function createSynth() {
    const lib = await import('../../vendor/synth.js');
    const context = new AudioContext({ sampleRate: 44100 });
    try {
        await context.resume();
        await context.audioWorklet.addModule(new URL('../../vendor/spessasynth_processor.min.js', import.meta.url));
        const synth = new lib.WorkletSynthesizer(context);
        const output = context.createGain();
        output.gain.value = masterVolume;
        synth.connect(output);
        output.connect(context.destination);
        const bytes = await window.files.soundBank();
        await synth.soundBankManager.addSoundBank(new Uint8Array(bytes).buffer, 'General MIDI');
        await synth.isReady;
        output.gain.value = masterVolume;
        outputs.add(output);
        return { lib, context, synth };
    }
    catch (error) {
        await context.close();
        throw error;
    }
}
let previewInstance = null;
export function getPreviewEngine() {
    if (previewInstance)
        return previewInstance;
    previewInstance = (async () => {
        try {
            const { context, synth } = await createSynth();
            let timer;
            let generation = 0;
            return { context,
                async preview(pitch, program, isDrum = false, volume = 100) {
                    const token = ++generation;
                    await context.resume();
                    if (token !== generation)
                        return;
                    clearTimeout(timer);
                    synth.stopAll(false);
                    const channel = isDrum ? 9 : 0;
                    const sample = samplePitch(pitch, program, isDrum), sourcePitch = sample.pitch;
                    for (const [cc, value] of tuningControllers())
                        synth.controllerChange(channel, cc, value);
                    synth.pitchWheel(channel, tuningWheel(sample.tuning));
                    synth.midiChannels[channel].setSystemParameter('gain', volume / 100);
                    synth.programChange(channel, isDrum ? 0 : program);
                    synth.noteOn(channel, sourcePitch, 100);
                    timer = setTimeout(() => synth.noteOff(channel, sourcePitch), 500);
                }
            };
        }
        catch (error) {
            previewInstance = null;
            throw error;
        }
    })();
    return previewInstance;
}
let instance = null;
export function getEngine() {
    if (instance)
        return instance;
    instance = (async () => {
        let context;
        try {
            const ready = await createSynth();
            context = ready.context;
            const { lib, synth } = ready;
            const seq = new lib.Sequencer(synth, { skipToFirstNoteOn: false });
            seq.loopCount = 0;
            return {
                seq, context,
                restoreNotes(notes) { for (const n of notes) {
                    for (const [cc, value] of tuningControllers())
                        synth.controllerChange(n.channel, cc, value);
                    synth.pitchWheel(n.channel, tuningWheel(n.tuning ?? 0));
                    synth.noteOn(n.channel, n.pitch, n.velocity);
                } },
                gain(channel, value) { synth.midiChannels[channel].setSystemParameter('gain', value); },
                mute(channel, muted) { synth.midiChannels[channel].setSystemParameter('isMuted', muted); },
                async load(binary) {
                    seq.pause();
                    synth.stopAll(true);
                    await new Promise((resolve, reject) => {
                        const id = 'studio-load';
                        let timer;
                        const done = (error) => { clearTimeout(timer); seq.eventHandler.removeEvent('songChange', id); seq.eventHandler.removeEvent('midiError', id); error ? reject(error) : resolve(); };
                        seq.eventHandler.addEvent('songChange', id, () => done());
                        seq.eventHandler.addEvent('midiError', id, (error) => done(error));
                        timer = setTimeout(() => done(Error('SoundFont playback did not become ready.')), 20000);
                        seq.loadNewSongList([{ binary, fileName: 'MML Studio preview' }]);
                    });
                    seq.pause();
                },
                async play() { await context.resume(); seq.play(); },
                pause() { seq.pause(); synth.stopAll(true); },
                stop() { seq.pause(); seq.currentTime = 0; synth.stopAll(true); }
            };
        }
        catch (error) {
            await context?.close();
            instance = null;
            throw error;
        }
    })();
    return instance;
}
