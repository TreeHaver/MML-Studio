import { checkpoint } from './history.js';
import { importMml } from './import/mml.js';
import { stopPlayback } from './playback/transport.js';
import { refresh, refreshTitle } from './commands.js';
import { $, input, status, view } from './dom.js';
import { pitchTop } from './pitch-viewport.js';
import { draw } from './painting.js';
import { state, resetInstrumentView } from './state.js';
import { fresh } from './model/project.js';
import { parse } from './model/serialization.js';
import { fullProject, resetSegment } from './segment-session.js';
// Adding and removing an instrument leaves the project as it was, so comparing against the
// last saved contents avoids warning about work that no longer differs from it.
const snapshot = () => JSON.stringify(fullProject());
export function markSaved() { state.saved = snapshot(); state.dirty = false; }
export function unsaved() { return state.dirty && snapshot() !== state.saved; }
let saving = null;
export function saveProject() {
    if (saving)
        return saving;
    saving = (async () => {
        try {
            const saved = snapshot();
            if (!await window.files.save(JSON.stringify(JSON.parse(saved), null, 2)))
                return false;
            state.saved = saved;
            state.dirty = snapshot() !== saved;
            status('Project saved.');
            return true;
        }
        catch (error) {
            status('Save failed: ' + error);
            return false;
        }
        finally {
            saving = null;
        }
    })();
    return saving;
}
export function installFiles() {
    markSaved();
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
            if (unsaved() && !confirm('Replace the current project with this import and discard unsaved changes?'))
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
            state.saved = '';
            view.scrollLeft = 0;
            refresh();
            view.scrollTop = Math.max(0, pitchTop(state.topPitch, (state.project.notes.find(n => n.instrument === 0)?.pitch ?? 60) + 5));
            draw();
            const count = state.project.instruments.length;
            const instructions = state.project.notes.filter(n => state.project.instruments[n.instrument].isInstructions).length;
            const summary = `Imported ${imported.noteCount} note${imported.noteCount === 1 ? '' : 's'}${instructions ? ` and ${instructions} unbound instruction${instructions === 1 ? '' : 's'}` : ''} from ${file.name} into ${count} instrument${count === 1 ? '' : 's'}. Save JSON to keep this project.`;
            status(summary);
            $('midi-report-title').textContent = 'Import complete';
            $('midi-report-note').hidden = false;
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
            // A failed import used to report only in the footer, which reads as "nothing happened".
            const reason = String(error?.message ?? error).replace(/^Error:\s*/, '');
            status('Import failed: ' + reason);
            $('midi-report-title').textContent = 'Import failed';
            $('midi-summary').textContent = reason;
            $('midi-warnings').replaceChildren();
            $('midi-report-note').hidden = true;
            $('midi-report').showModal();
        }
        finally {
            importing = false;
            $('import-midi').disabled = false;
        }
    };
    $('midi-report-close').onclick = () => $('midi-report').close();
    $('save').onclick = () => saveProject();
    $('open').onclick = async () => { try {
        if (unsaved() && !confirm('Discard unsaved changes and open a project?'))
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
        view.scrollLeft = 0;
        refresh();
        markSaved();
        status('Project opened.');
    }
    catch (e) {
        status('Open failed: ' + e);
    } };
    $('new').onclick = () => {
        if (unsaved() && !confirm('Discard unsaved changes?'))
            return;
        stopPlayback(false);
        resetInstrumentView();
        resetSegment();
        state.project = fresh();
        state.selection.clear();
        state.active = 0;
        state.history = [];
        state.future = [];
        view.scrollLeft = 0;
        refresh();
        markSaved();
        status('New project. Type a name, or start drawing.');
        const name = input('project-name');
        name.focus({ preventScroll: true });
        name.select();
    };
    window.editorClose?.onRequest(async () => {
        if (!unsaved())
            return true;
        const before = snapshot(), choice = await window.nativeDialogs.closeChoice();
        if (choice === 'discard')
            return snapshot() === before;
        if (choice === 'save')
            return await saveProject() && !unsaved();
        return false;
    });
    // Electron owns the native close lifecycle. Do not cancel beforeunload here:
    // after MIDI import, Chromium can otherwise keep the main window alive when
    // the user clicks its native X button.
}
