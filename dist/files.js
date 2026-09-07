import { checkpoint } from './history.js';
import { importMml } from './import/mml.js';
import { stopPlayback } from './playback/transport.js';
import { refresh, refreshTitle } from './commands.js';
import { $, status, view } from './dom.js';
import { pitchTop } from './music/pitch-layout.js';
import { draw } from './painting.js';
import { state, resetInstrumentView } from './state.js';
import { fresh } from './model/project.js';
import { parse } from './model/serialization.js';
import { fullProject, resetSegment } from './segment-session.js';
export function installFiles() {
    $('project-name').onchange = () => { const name = $('project-name').value.trim() || 'Untitled'; if (name !== (state.project.name || 'Untitled')) {
        checkpoint();
        state.project.name = name;
    } $('project-name').value = name; refreshTitle(); };
    let importing = false;
    $('import-midi').onclick = async () => {
        if (importing)
            return;
        importing = true;
        $('import-midi').disabled = true;
        try {
            const file = await window.files.importMidi();
            if (file === null)
                return;
            const { importMidi } = await import('./import/midi.js');
            const bytes = new Uint8Array(file.bytes);
            const imported = /\.(mid|midi)$/i.test(file.name) ? importMidi(bytes) : importMml(new TextDecoder('utf-8', { fatal: true }).decode(bytes), file.name.replace(/\.[^.]+$/, ''));
            if (state.dirty && !confirm('Replace the current project with this import and discard unsaved changes?'))
                return;
            stopPlayback(false);
            resetInstrumentView();
            resetSegment();
            state.project = imported.project;
            state.project.name = file.name.replace(/\.[^.]+$/, '') || 'Untitled';
            state.selection.clear();
            state.active = 0;
            state.history = [];
            state.future = [];
            state.dirty = true;
            view.scrollLeft = 0;
            refresh();
            view.scrollTop = Math.max(0, pitchTop(state.topPitch, (state.project.notes.find(n => n.instrument === 0)?.pitch ?? 60) + 5));
            draw();
            const count = state.project.instruments.length;
            const instructions = state.project.notes.filter(n => state.project.instruments[n.instrument].isInstructions).length;
            const summary = `Imported ${imported.noteCount} note${imported.noteCount === 1 ? '' : 's'}${instructions ? ` and ${instructions} unbound instruction${instructions === 1 ? '' : 's'}` : ''} from ${file.name} into ${count} instrument${count === 1 ? '' : 's'}. Save JSON to keep this project.`;
            status(summary);
            $('midi-summary').textContent = summary;
            $('midi-warnings').replaceChildren();
            for (const warning of imported.warnings) {
                const li = document.createElement('li');
                li.textContent = warning;
                $('midi-warnings').append(li);
            }
            $('midi-report').showModal();
        }
        catch (error) {
            status('Import failed: ' + error);
        }
        finally {
            importing = false;
            $('import-midi').disabled = false;
        }
    };
    $('midi-report-close').onclick = () => $('midi-report').close();
    $('save').onclick = async () => { try {
        if (await window.files.save(JSON.stringify(fullProject(), null, 2))) {
            state.dirty = false;
            status('Project saved.');
        }
    }
    catch (e) {
        status('Save failed: ' + e);
    } };
    $('open').onclick = async () => { try {
        if (state.dirty && !confirm('Discard unsaved changes and open a project?'))
            return;
        const text = await window.files.open();
        if (text === null)
            return;
        const loaded = parse(text);
        stopPlayback(false);
        resetInstrumentView();
        resetSegment();
        state.project = loaded;
        state.selection.clear();
        state.active = 0;
        state.history = [];
        state.future = [];
        state.dirty = false;
        view.scrollLeft = 0;
        refresh();
        status('Project opened.');
    }
    catch (e) {
        status('Open failed: ' + e);
    } };
    $('new').onclick = () => { if (state.dirty && !confirm('Discard unsaved changes?'))
        return; stopPlayback(false); resetInstrumentView(); resetSegment(); state.project = fresh(); state.selection.clear(); state.active = 0; state.history = []; state.future = []; state.dirty = false; view.scrollLeft = 0; refresh(); };
    // Electron owns the native close lifecycle. Do not cancel beforeunload here:
    // after MIDI import, Chromium can otherwise keep the main window alive when
    // the user clicks its native X button.
}
