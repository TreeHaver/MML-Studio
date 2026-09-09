import { importMidi } from './midi.js';
import { importMml } from './mml.js';
import { importAbc } from './abc.js';
import { condenseImportInstructions } from './instructions.js';
export function importSong(bytes, name) {
    let song;
    if (/\.(mid|midi)$/i.test(name))
        song = importMidi(bytes);
    else {
        let text;
        const warnings = [];
        try {
            text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        }
        catch {
            text = new TextDecoder('windows-1252').decode(bytes);
            warnings.push('Text was not valid UTF-8; Windows-1252 decoding was attempted. Check names and symbols.');
        }
        const title = name.replace(/\.[^.]+$/, '');
        song = /\.abc$/i.test(name) ? importAbc(text, title, { recover: true }) : importMml(text, title, { tempoConflicts: 'last' });
        song.warnings.push(...warnings);
    }
    condenseImportInstructions(song.project, song.warnings);
    return song;
}
