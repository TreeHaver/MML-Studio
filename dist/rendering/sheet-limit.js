import { ctx, view } from '../dom.js';
import { state } from '../state.js';
import { KEY, HEAD } from '../constants.js';
import { sheetSettings } from '../sheet-settings.js';
import { createSheetPlanner } from '../music/sheets.js';
let previous = '', boundary = null, tooSmall = false;
let previousNotes, count = -1, settings = '';
export function drawSheetLimit() {
    const instrument = state.project.instruments[state.active];
    if (!instrument || instrument.isInstructions)
        return;
    const nextSettings = JSON.stringify([state.active, instrument, sheetSettings.limit]);
    let signature = previous;
    if (previousNotes !== state.project.notes || count !== state.project.notes.length || settings !== nextSettings) {
        previousNotes = state.project.notes;
        count = previousNotes.length;
        settings = nextSettings;
        signature = JSON.stringify([settings, previousNotes.filter(n => n.instrument === state.active || n.tempo != null || n.loopEntry || n.loopExit)]);
    }
    if (signature !== previous) {
        previous = signature;
        boundary = null;
        tooSmall = false;
        try {
            const plan = createSheetPlanner(state.project, state.active, sheetSettings.limit);
            if (plan.whole.bytes === sheetSettings.limit)
                boundary = plan.sourceTick(plan.end);
            else if (plan.whole.bytes > sheetSettings.limit) {
                try {
                    boundary = plan.sourceTick(plan.next(0).end);
                }
                catch {
                    boundary = 0;
                    tooSmall = true;
                }
            }
        }
        catch { /* A transient invalid gesture should not interrupt drawing. */ }
    }
    if (boundary === null)
        return;
    const x = KEY + boundary * state.zoom - view.scrollLeft;
    if (x < KEY || x > state.width)
        return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(KEY, 0, state.width - KEY, state.height);
    ctx.clip();
    ctx.fillStyle = '#e53935';
    ctx.fillRect(x, HEAD, 2, state.height - HEAD);
    ctx.fillRect(x, 0, 2, HEAD);
    ctx.font = '11px Segoe UI';
    ctx.textBaseline = 'top';
    ctx.fillText(tooSmall ? 'Limit too small' : `${sheetSettings.limit.toLocaleString()} char limit`, x + 5, 2);
    ctx.restore();
}
