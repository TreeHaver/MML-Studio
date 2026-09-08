import { fresh } from './model/project.js';
export const state = { project: fresh(), segment: null, active: 0, selection: new Set(), tool: 'draw', zoom: 3, verticalZoom: 1, topPitch: 127, bottomPitch: 0, history: [], future: [], gesture: null, dirty: false, saved: '', width: 900, height: 600, previewPitch: null };
export const instrumentView = { mmlEpoch: 0, muted: new Set(), collapsed: new Set(), solo: null };
// Solo silences everything else without touching the explicit mutes, so they survive it.
export function isMuted(index) { return instrumentView.muted.has(index) || (instrumentView.solo !== null && instrumentView.solo !== index); }
export function resetInstrumentView() { instrumentView.mmlEpoch++; instrumentView.muted.clear(); instrumentView.collapsed.clear(); instrumentView.solo = null; }
