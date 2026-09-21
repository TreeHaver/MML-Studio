import { SoundBankLoader } from 'spessasynth_core';
import { MAPLEBEATS_DRUMS } from '../playback/drums.js';
/** Move Maplebeats percussion into private kits, leaving the melodic FX slots to GM. */
export function filterSoundBank(bank, id) {
    if (id === 'maplebeats-2.dls')
        for (const preset of [...bank.presets]) {
            const mapping = Object.values(MAPLEBEATS_DRUMS).find(item => item.name === preset.name.trim());
            if (mapping) {
                preset.program = mapping.program;
                preset.bankMSB = 0;
                preset.bankLSB = 0;
                preset.isGMGSDrum = true;
            }
        }
    return bank;
}
/** The worklet accepts bank bytes. Serialize a filtered in-memory copy, preserving the file. */
export function prepareSoundBank(bytes, id) {
    const buffer = new Uint8Array(bytes).buffer;
    if (id !== 'maplebeats-2.dls')
        return buffer;
    return filterSoundBank(SoundBankLoader.fromArrayBuffer(buffer), id).writeSF2();
}
