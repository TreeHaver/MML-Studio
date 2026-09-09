import { importSong } from './import/source.js';
import { appendImportedSongs } from './import/append.js';
import { prepareImportTempos, importReport } from './import-ui.js';
import { state } from './state.js';
import { fullProject, historySnapshot, fitsCurrentView } from './segment-session.js';
import { checkpoint } from './history.js';
import { refresh } from './commands.js';
import { stopPlayback } from './playback/transport.js';
import { advancedInstructions } from './advanced-instructions.js';
import { hasInstructions } from './model/instructions.js';
import { status } from './dom.js';
import { replaceWithImport } from './files.js';
import { isAudioFile, importAudio } from './import/audio.js';
import { chooseAudioSampling } from './audio-import-ui.js';
import { sheetSettings } from './sheet-settings.js';
let importing = false;
export async function importDroppedFiles(files) {
    if (!files.length || importing)
        return;
    importing = true;
    try {
        if (state.gesture)
            throw Error('Finish the current edit before dropping files.');
        const before = historySnapshot(), segment = state.segment, imported = [];
        const replaceEmpty = !segment && state.project.instruments.filter(i => !i.isInstructions).length === 1 && state.project.notes.length === 0;
        status('Reading dropped files…');
        for (const file of files) {
            const audio = isAudioFile(file.name);
            if (!audio && !/\.(mid|midi|mml|ms2mml|mne|txt|abc)$/i.test(file.name))
                throw Error(`Unsupported dropped file: ${file.name}. Drop audio, MIDI, MML, ABC or MML text files.`);
            const bytes = await file.arrayBuffer();
            let song;
            if (audio) {
                const decoder = window.audioImport?.decode;
                if (!decoder)
                    throw Error('Audio import requires the desktop app with bundled FFmpeg.');
                status(`Decoding ${file.name} for voice analysis…`);
                const decoded = await decoder(new Uint8Array(bytes));
                const samples = new Float32Array(decoded.samples), budget = sheetSettings.limit;
                const options = await chooseAudioSampling(file.name, samples.length / decoded.sampleRate, budget);
                if (options === null) {
                    status('Audio import cancelled.');
                    return;
                }
                status(`Sampling ${file.name}: ${options.voices} voices, ${options.interval} ms…`);
                song = importAudio(samples, decoded.sampleRate, file.name, options.interval, budget, options.voices);
                if (!replaceEmpty)
                    song.warnings.push('Audio keeps its T250/×4 instructions to preserve sample timing. The shared clock also affects existing music; existing later tempo instructions can change the imported voice timing.');
            }
            else {
                song = importSong(new Uint8Array(bytes), file.name);
                prepareImportTempos(song, file.name, !replaceEmpty);
            }
            imported.push(song);
        }
        if (state.gesture || segment !== state.segment || before !== historySnapshot())
            throw Error('The project changed while reading the files. Drop them again to import into the current project.');
        if (replaceEmpty) {
            const merged = appendImportedSongs(imported[0].project, imported.slice(1).map(s => s.project));
            replaceWithImport({ project: merged.project, noteCount: imported.reduce((sum, s) => sum + s.noteCount, 0), warnings: [...imported.flatMap((s, i) => s.warnings.map(w => `${files[i].name}: ${w}`)), ...merged.warnings] }, files[0].name, files.map(f => f.name).join(', '));
            return;
        }
        const result = appendImportedSongs(state.project, imported.map(s => s.project));
        if (!fitsCurrentView(result.project))
            throw Error('The imported song extends beyond this view. Return to Project to import it.');
        fullProject(result.project); // Validate scoped reconciliation before checkpointing.
        stopPlayback(false);
        checkpoint();
        state.project = result.project;
        state.active = result.instruments[0] ?? state.active;
        state.selectedInstruments.clear();
        state.selection = new Set(result.added);
        if (imported.some(s => hasInstructions(s.project)))
            advancedInstructions.enabled = true;
        refresh();
        const warnings = [...imported.flatMap((song, i) => song.warnings.map(w => `${files[i].name}: ${w}`)), ...result.warnings];
        warnings.push('Imported parts start at the beginning of the current view. Tempo and Speed Multiplier instructions use the shared project clock.');
        importReport(`Imported ${imported.reduce((sum, s) => sum + s.noteCount, 0)} notes from ${files.map(f => f.name).join(', ')} into ${result.instruments.length} instrument(s). Undo restores the previous project.`, warnings);
    }
    catch (error) {
        importReport(String(error?.message ?? error), [], true);
    }
    finally {
        importing = false;
    }
}
export function installFileDrop() {
    document.ondragover = event => { if (Array.from(event.dataTransfer?.types ?? []).includes('Files')) {
        event.preventDefault();
        if (event.dataTransfer)
            event.dataTransfer.dropEffect = 'copy';
    } };
    document.ondrop = event => { event.preventDefault(); return importDroppedFiles(Array.from(event.dataTransfer?.files ?? [])); };
}
