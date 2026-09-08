import { state } from './state.js';
import * as base from './music/pitch-layout.js';
// Keep all painted pitch rows and pointer coordinates on the same view scale.
export const pitchHeight = (pitch) => base.pitchHeight(pitch) * state.verticalZoom;
export const pitchTop = (top, pitch) => base.pitchTop(top, pitch) * state.verticalZoom;
export const pitchAtY = (top, y) => base.pitchAtY(top, y / state.verticalZoom);
