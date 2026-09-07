import { instructionCaptionHit } from './rendering/tempo.js';
import { canvas, view } from './dom.js';
import { state, isMuted } from './state.js';
import { KEY, HEAD } from './constants.js';
import { pitchTop, pitchHeight, pitchAtY } from './music/pitch-layout.js';
export function anchor() { return state.project.notes.find(n => n.id === [...state.selection][0]); }
export function rect(n) { if (state.project.instruments[n.instrument]?.isInstructions)
    return { x: KEY + n.start * state.zoom - view.scrollLeft, y: HEAD, w: 15, h: state.height - HEAD }; return { x: KEY + n.start * state.zoom - view.scrollLeft, y: HEAD + pitchTop(state.topPitch, n.pitch) - view.scrollTop, w: state.project.instruments[n.instrument]?.isInstructions ? 48 : Math.max(1, n.length * state.zoom - 1), h: pitchHeight(n.pitch) - 1 }; }
export function point(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
export function musical(p) { return { tick: Math.max(0, (p.x - KEY + view.scrollLeft) / state.zoom), pitch: pitchAtY(state.topPitch, p.y - HEAD + view.scrollTop) }; }
export function hit(p) { const caption = instructionCaptionHit(p); if (caption?.instrument === state.active)
    return caption; return [...state.project.notes].reverse().find(n => { const r = rect(n); return !isMuted(n.instrument) && n.instrument === state.active && (state.project.instruments[n.instrument]?.isInstructions || musical(p).pitch === n.pitch) && p.x >= r.x - 1 && p.x <= r.x + r.w + 1 && p.y >= r.y - 2 && p.y <= r.y + r.h + 2; }); }
export function edge(n, p) { if (state.project.instruments[n.instrument]?.isInstructions)
    return false; const r = rect(n); return p.x >= r.x + r.w - Math.min(6, r.w / 3); }
export function boxIds(a, b, notes = state.project.notes) { const x = Math.min(a.tick, b.tick), end = Math.max(a.tick, b.tick), lo = Math.min(a.pitch, b.pitch), hi = Math.max(a.pitch, b.pitch); return notes.filter(n => !isMuted(n.instrument) && n.instrument === state.active && n.start + n.length > x && n.start < end && (state.project.instruments[n.instrument]?.isInstructions || n.pitch >= lo && n.pitch <= hi)).map(n => n.id); }
