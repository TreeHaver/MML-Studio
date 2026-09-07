import { ctx, view } from '../dom.js';
import { state } from '../state.js';
import { KEY, HEAD } from '../constants.js';
import { crowdedRegions } from '../music/note-density.js';
let previous, count = -1, active = -1, regions = [];
export function drawCrowdedRegions() {
    if (state.project.instruments[state.active]?.isInstructions)
        return;
    if (previous !== state.project.notes || count !== state.project.notes.length || active !== state.active) {
        previous = state.project.notes;
        count = previous.length;
        active = state.active;
        regions = crowdedRegions(previous.filter(n => n.instrument === active));
    }
    ctx.save();
    ctx.fillStyle = '#ffd60026';
    ctx.strokeStyle = '#e6b800';
    ctx.lineWidth = 2;
    for (const region of regions) {
        const left = KEY + region.start * state.zoom - view.scrollLeft, right = KEY + region.end * state.zoom - view.scrollLeft;
        if (right <= KEY || left >= state.width)
            continue;
        ctx.fillRect(left, HEAD, right - left, state.height - HEAD);
        ctx.strokeRect(left, HEAD + 1, right - left, Math.max(0, state.height - HEAD - 2));
    }
    ctx.restore();
}
