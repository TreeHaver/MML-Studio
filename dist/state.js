import { fresh } from './model/project.js';
export const state = { project: fresh(), active: 0, selection: new Set(), tool: 'draw', zoom: 3, topPitch: 127, bottomPitch: 0, history: [], future: [], gesture: null, dirty: false, width: 900, height: 600, previewPitch: null };
export const instrumentView = { mmlEpoch: 0, muted: new Set(), collapsed: new Set(), solo: null };
export function isMuted(index) { return instrumentView.muted.has(index); }
export function resetInstrumentView() { instrumentView.mmlEpoch++; instrumentView.muted.clear(); instrumentView.collapsed.clear(); instrumentView.solo = null; }
