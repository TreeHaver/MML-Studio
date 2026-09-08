import { draw } from './painting.js';
import { info } from './inspector.js';
import { undo } from './history.js';
import { commitNotes } from './commands.js';
import { endGesture } from './pointer.js';
import { setTool } from './toolbar.js';
import { state } from './state.js';
import { copyNotes, pasteNotes, pasteMml } from './note-clipboard.js';
import { playback } from './playback/transport.js';
import { markLoopStart, markLoopEnd, toggleLoop, clearLoopRegion, alignLoopToGrid, loopRegion, loopSpan } from './playback/loop-region.js';
import { status } from './dom.js';
export function installKeyboard() {
    document.oncopy = e => { if (e.target.matches('input,select,textarea') || e.target.isContentEditable)
        return; e.preventDefault(); copyNotes(); e.clipboardData?.setData('application/x-mml-studio-notes', '1'); e.clipboardData?.setData('text/plain', ''); };
    document.onpaste = e => { if (e.target.matches('input,select,textarea') || e.target.isContentEditable)
        return; e.preventDefault(); const text = e.clipboardData?.getData('text/plain') ?? ''; if (e.clipboardData?.getData('application/x-mml-studio-notes') === '1' || !text.trim())
        pasteNotes();
    else
        pasteMml(text); };
    document.onkeydown = e => {
        if (e.target.matches('input,select,textarea') || e.target.isContentEditable)
            return;
        if ((e.ctrlKey || e.metaKey) && !e.altKey && ['c', 'v'].includes(e.key.toLowerCase())) {
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
        // The rehearsal loop is trimmed at the playhead with B and N, as a work area is in a
        // video editor, and switched with L. Nothing here is written to the project.
        if (['b', 'n', 'l', 'g'].includes(e.key.toLowerCase()) && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            const key = e.key.toLowerCase(), tick = Math.round(playback.tick ?? 0);
            if (key === 'b') {
                markLoopStart(tick, state.project.notes.reduce((end, n) => Math.max(end, n.start + n.length), 0));
                status(`Loop starts at tick ${loopRegion.start}. N marks the end, G puts it on the grid, L switches it off.`);
            }
            else if (key === 'n') {
                markLoopEnd(tick);
                status(`Loop ends at tick ${loopRegion.end}. B marks the start; L switches it off.`);
            }
            else if (key === 'g')
                status(alignLoopToGrid() ? `Loop put on the grid: ticks ${loopRegion.start}-${loopRegion.end}.` : 'Mark a stretch first: B at the start, N at the end, or shift-drag across the bar numbers.');
            else if (e.shiftKey) {
                clearLoopRegion();
                status('Loop cleared.');
            }
            else
                status(loopSpan() <= 0 ? 'Mark a stretch first: B at the start, N at the end, or shift-drag across the bar numbers.' : toggleLoop() ? 'Repeating the chosen stretch.' : 'Loop off. The stretch stays marked.');
            draw();
            return;
        }
        if (e.key.toLowerCase() === 'd')
            setTool('draw');
        if (e.key.toLowerCase() === 's' && !e.ctrlKey)
            setTool('select');
        if (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey)
            setTool('spray');
    };
}
