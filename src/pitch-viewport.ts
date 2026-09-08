import {state} from './state.ts';
import * as base from './music/pitch-layout.ts';

// Keep all painted pitch rows and pointer coordinates on the same view scale.
export const pitchHeight=(pitch:number)=>base.pitchHeight(pitch)*state.verticalZoom;
export const pitchTop=(top:number,pitch:number)=>base.pitchTop(top,pitch)*state.verticalZoom;
export const pitchAtY=(top:number,y:number)=>base.pitchAtY(top,y/state.verticalZoom);
