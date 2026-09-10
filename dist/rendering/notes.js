import { ctx, view } from '../dom.js';
import { state, isMuted, instrumentSelected } from '../state.js';
import { KEY, HEAD } from '../constants.js';
import { rect, boxIds, musical } from '../geometry.js';
import { name, sharp } from '../music/pitch.js';
import { INSTRUCTIONS_COLOR } from '../model/instructions.js';
import { pitchAtY } from '../pitch-viewport.js';
import { createNoteVisibility } from '../music/note-visibility.js';
import { sustainedOverlapSpans } from '../music/note-density.js';
import { hexToHsv, hsvToHex } from '../color-picker.js';
let indexedNotes, indexedCount = -1, indexedRoles = '', query;
let sustainedSpans = [];
function visibleNotes() {
    const notes = state.project.notes, roles = state.project.instruments.map(i => i.isInstructions ? '1' : '0').join('');
    if (indexedNotes !== notes || indexedCount !== notes.length || indexedRoles !== roles) {
        query = createNoteVisibility(notes, i => !!state.project.instruments[i]?.isInstructions);
        sustainedSpans = sustainedOverlapSpans(notes.filter(n => !state.project.instruments[n.instrument]?.isInstructions));
        indexedNotes = notes;
        indexedCount = notes.length;
        indexedRoles = roles;
    }
    const from = view.scrollLeft / state.zoom, to = (view.scrollLeft + state.width - KEY) / state.zoom, low = pitchAtY(state.topPitch, view.scrollTop + state.height - HEAD), high = pitchAtY(state.topPitch, view.scrollTop);
    const visible = query(from, to, low, high, 48 / state.zoom), preview = state.gesture?.movePreview;
    if (!preview)
        return visible;
    return [...visible.filter(n => !state.selection.has(n.id)), ...query(from - preview.dt, to - preview.dt, low - preview.dp, high - preview.dp, 48 / state.zoom).filter(n => state.selection.has(n.id)).map(n => ({ ...n, start: n.start + preview.dt, pitch: n.pitch + preview.dp }))];
}
const labelColors = new Map();
const overlapColors = new Map();
/** Rotate hue only: preserve the instrument's HSV saturation and brightness. */
export function overlapOutlineColor(background) {
    let color = overlapColors.get(background);
    if (!color) {
        const { h, s, v } = hexToHsv(background);
        color = hsvToHex((h + 180) % 360, s, v);
        overlapColors.set(background, color);
    }
    return color;
}
const luminance = (hex) => { const match = /^#([0-9a-f]{6})$/i.exec(hex); if (!match)
    return 1; const value = Number.parseInt(match[1], 16), channel = (shift) => { const c = ((value >> shift) & 255) / 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * channel(16) + .7152 * channel(8) + .0722 * channel(0); };
export function noteLabelColor(background) { let color = labelColors.get(background); if (!color) {
    const bg = luminance(background), dark = luminance('#161b20'), light = luminance('#f7fbff');
    color = (light + .05) / (bg + .05) > (bg + .05) / (dark + .05) ? '#f7fbff' : '#161b20';
    labelColors.set(background, color);
} return color; }
export function drawNotes() {
    const visible = visibleNotes();
    // A single selected note sits on top temporarily; never reorder project data.
    if (state.selection.size === 1) {
        const index = visible.findIndex(n => state.selection.has(n.id));
        if (index >= 0)
            visible.push(...visible.splice(index, 1));
    }
    // The font and baseline are the same for every label, and setting them on the context is
    // not free: hoisted out of the loop they are set once a frame instead of once a note.
    ctx.font = '10px Segoe UI, sans-serif';
    ctx.textBaseline = 'middle';
    // A rough width per character at this size, used only to decide whether a label can
    // overflow its note. When it cannot, the clip - and its save/restore pair - is skipped.
    const CHARACTER = 6.4;
    const preview = state.gesture?.kind === 'box' ? new Set(boxIds(state.gesture.music, musical(state.gesture.current), visible)) : null;
    for (const n of visible) {
        if (isMuted(n.instrument) || state.project.instruments[n.instrument].isInstructions)
            continue;
        const r = rect(n);
        if (r.x + r.w <= KEY || r.x >= state.width || r.y + r.h <= HEAD || r.y >= state.height)
            continue;
        const instructions = state.project.instruments[n.instrument].isInstructions;
        ctx.globalAlpha = instrumentSelected(n.instrument) ? 1 : .4;
        ctx.fillStyle = instructions ? INSTRUCTIONS_COLOR : state.project.instruments[n.instrument].color;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        if (!instructions && sharp(n.pitch)) {
            ctx.fillStyle = '#00000022';
            ctx.fillRect(r.x, r.y, r.w, r.h);
        }
        // An inside-only border darkens the lane color without covering adjacent cells.
        const border = Math.min(2, r.w / 2, r.h / 2);
        ctx.strokeStyle = '#00000038';
        ctx.lineWidth = border;
        ctx.strokeRect(r.x + border / 2, r.y + border / 2, r.w - border, r.h - border);
        if ((preview ? preview.has(n.id) || (state.gesture.add && state.selection.has(n.id)) : state.selection.has(n.id))) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(r.x, r.y, r.w, r.h);
            ctx.clip();
            ctx.strokeStyle = '#67b7ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(r.x + 1, r.y + 1, Math.max(0, r.w - 2), r.h - 2);
            ctx.restore();
        }
        if (!instructions && state.selection.has(n.id) && r.w > 9) {
            ctx.fillStyle = '#ffffffa0';
            ctx.fillRect(r.x + r.w - 4, r.y + 3, 1, r.h - 6);
        }
        if (r.w > 8) {
            const text = instructions ? ([n.section, n.timeSignature, n.tempo == null ? '' : `T${n.tempo}`].filter(Boolean).join(' · ') || 'Event') : name(n.pitch) + (n.tempo == null ? '' : ` T${n.tempo}`);
            const clipped = text.length * CHARACTER > r.w - 6;
            if (clipped) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(r.x + 2, r.y, Math.max(0, r.w - 4), r.h);
                ctx.clip();
            }
            ctx.fillStyle = noteLabelColor(instructions ? INSTRUCTIONS_COLOR : state.project.instruments[n.instrument].color);
            ctx.fillText(text, r.x + 4, r.y + r.h / 2);
            if (clipped)
                ctx.restore();
        }
        ctx.globalAlpha = 1;
    }
    // Paint after every note so a later stacked note cannot cover the overlap rails.
    for (const span of state.gesture?.movePreview ? [] : sustainedSpans) {
        if (isMuted(span.instrument) || !instrumentSelected(span.instrument))
            continue;
        const r = rect({ ...span, id: 0, length: span.end - span.start, volume: null });
        const thickness = 2, gap = 1;
        if (r.x + r.w <= KEY || r.x >= state.width || r.y + r.h + gap + thickness <= HEAD || r.y - gap - thickness >= state.height)
            continue;
        ctx.fillStyle = overlapOutlineColor(state.project.instruments[span.instrument].color);
        ctx.fillRect(r.x, r.y - gap - thickness, r.w, thickness);
        ctx.fillRect(r.x, r.y + r.h + gap, r.w, thickness);
    }
    // Anchored to the content, so the box keeps its corner while the roll scrolls under it.
    if (state.gesture?.kind === 'box') {
        const g = state.gesture, a = { x: g.origin.x - view.scrollLeft, y: g.origin.y - view.scrollTop }, b = g.current;
        ctx.fillStyle = '#379bf528';
        ctx.strokeStyle = '#67b7ff';
        ctx.lineWidth = 1;
        ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y));
        ctx.strokeRect(Math.min(a.x, b.x) + .5, Math.min(a.y, b.y) + .5, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    }
}
