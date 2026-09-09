import { importMidi } from './midi.js';
import { importMml } from './mml.js';
export function importSong(bytes, name) {
    return /\.(mid|midi)$/i.test(name) ? importMidi(bytes) : importMml(new TextDecoder('utf-8', { fatal: true }).decode(bytes), name.replace(/\.[^.]+$/, ''), { tempoConflicts: 'last' });
}
