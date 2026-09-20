import { checkpoint } from './history.js';
import {} from './import/source.js';
import { importDroppedFiles } from './drop-files.js';
import { importReport } from './import-ui.js';
import { stopPlayback } from './playback/transport.js';
import { refresh, refreshTitle } from './commands.js';
import { $, input, status, view } from './dom.js';
import { pitchTop } from './pitch-viewport.js';
import { draw } from './painting.js';
import { state, resetInstrumentView } from './state.js';
import { fresh } from './model/project.js';
import { parse } from './model/serialization.js';
import { fullProject, resetSegment } from './segment-session.js';
import { resetAdvancedInstructions } from './advanced-instructions.js';
// Adding and removing an instrument leaves the project as it was, so comparing against the
// last saved contents avoids warning about work that no longer differs from it.
const snapshot = () => JSON.stringify(fullProject());
export function markSaved() { state.saved = snapshot(); state.dirty = false; }
export function unsaved() { return state.dirty && snapshot() !== state.saved; }
/** Shared successful replacement for the menu and drops onto a truly empty project. */
export function replaceWithImport(imported, name, sourceName = name) {
    stopPlayback(false);
    resetInstrumentView();
    resetAdvancedInstructions();
    resetSegment();
    state.project = imported.project;
    state.project.name = name.replace(/\.[^.]+$/, '') || 'Untitled';
    state.selection.clear();
    state.active = 0;
    state.selectedInstruments.clear();
    state.history = [];
    state.future = [];
    state.dirty = true;
    state.saved = '';
    view.scrollLeft = 0;
    refresh();
    view.scrollTop = Math.max(0, pitchTop(state.topPitch, (state.project.notes.find(n => n.instrument === 0)?.pitch ?? 60) + 5));
    draw();
    const count = state.project.instruments.filter(i => !i.isInstructions).length;
    const instructions = state.project.notes.filter(n => state.project.instruments[n.instrument].isInstructions).length;
    const summary = `Imported ${imported.noteCount} note${imported.noteCount === 1 ? '' : 's'}${instructions ? ` and ${instructions} unbound instruction${instructions === 1 ? '' : 's'}` : ''} from ${sourceName} into ${count} instrument${count === 1 ? '' : 's'}. Save JSON to keep this project.`;
    importReport(summary, imported.warnings);
}
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
    // Both menu entries read the same chosen files. The picker takes several at once because
    // an ensemble is one file per player: each file becomes its own instrument, which is the
    // only way to hear whether the parts fit together.
    const chosenImports = async () => {
        const picked = await window.files.importMidi();
        return (Array.isArray(picked) ? picked : picked ? [picked] : []).map((file) => {
            const bytes = new Uint8Array(file.bytes);
            return { name: file.name, arrayBuffer: async () => bytes.buffer };
        });
    };
    // Replacing was the only thing the menu could do, so importing a second part erased the
    // first and the parts could only be gathered by the undocumented file drop. Adding is now
    // its own entry, and it is the drop path underneath, undo included.
    const runImport = async (replace) => {
        if (importing)
            return;
        importing = true;
        const button = $(replace ? 'import-midi' : 'import-add');
        button.disabled = true;
        try {
            const files = await chosenImports();
            if (!files.length)
                return;
            if (replace && unsaved() && !confirm('Replace the current project with this import and discard unsaved changes?'))
                return;
            await importDroppedFiles(files, replace);
        }
        catch (error) {
            // A failed import used to report only in the footer, which reads as "nothing happened".
            const reason = String(error?.message ?? error).replace(/^Error:\s*/, '');
            importReport(reason, [], true);
        }
        finally {
            importing = false;
            button.disabled = false;
        }
    };
    $('import-midi').onclick = () => runImport(true);
    $('import-add').onclick = () => runImport(false);
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
        resetAdvancedInstructions();
        resetSegment();
        state.project = loaded;
        state.selection.clear();
        state.active = 0;
        state.selectedInstruments.clear();
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
        resetAdvancedInstructions();
        resetSegment();
        state.project = fresh();
        state.selection.clear();
        state.active = 0;
        state.selectedInstruments.clear();
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
