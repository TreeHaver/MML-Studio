import { draw } from './painting.js';
import { info } from './inspector.js';
import { undo } from './history.js';
import { commitNotes } from './commands.js';
import { endGesture } from './pointer.js';
import { setTool } from './toolbar.js';
import { state } from './state.js';
import { copyNotes, pasteNotes } from './note-clipboard.js';
export function installKeyboard() {
    document.onkeydown = e => {
        if (e.target.matches('input,select,textarea') || e.target.isContentEditable)
            return;
        if ((e.ctrlKey || e.metaKey) && !e.altKey && ['c', 'v'].includes(e.key.toLowerCase())) {
            e.preventDefault();
            if (e.key.toLowerCase() === 'c')
                copyNotes();
            else
                pasteNotes();
            return;
        }
        if (e.key === 'Escape') {
            endGesture(true);
            state.selection.clear();
            info();
            draw();
            return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            if (state.selection.size) {
                commitNotes(state.project.notes.filter(n => !state.selection.has(n.id)));
                state.selection.clear();
                info();
            }
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undo(e.shiftKey);
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            state.selection = new Set(state.project.notes.filter(n => n.instrument === state.active).map(n => n.id));
            info();
            draw();
            return;
        }
        if (e.key.toLowerCase() === 'd')
            setTool('draw');
        if (e.key.toLowerCase() === 's' && !e.ctrlKey)
            setTool('select');
    };
}
