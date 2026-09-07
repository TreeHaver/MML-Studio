import {fresh} from './model/project.ts';
import type {Project} from './model/types.ts';
import type {Projection} from './model/segment-view.ts';
export interface EditorState {project:Project;segment:{root:Project,projection:Projection,sourceIndices:number[]}|null;active:number;selection:Set<number>;tool:string;zoom:number;topPitch:number;bottomPitch:number;history:string[];future:string[];gesture:any;dirty:boolean;width:number;height:number;previewPitch:number|null;}
export const state:EditorState={project:fresh(),segment:null,active:0,selection:new Set(),tool:'draw',zoom:3,topPitch:127,bottomPitch:0,history:[],future:[],gesture:null,dirty:false,width:900,height:600,previewPitch:null};

export const instrumentView={mmlEpoch:0,muted:new Set<number>(),collapsed:new Set<number>(),solo:null as number|null};
// Solo silences everything else without touching the explicit mutes, so they survive it.
export function isMuted(index:number){return instrumentView.muted.has(index)||(instrumentView.solo!==null&&instrumentView.solo!==index);}
export function resetInstrumentView(){instrumentView.mmlEpoch++;instrumentView.muted.clear();instrumentView.collapsed.clear();instrumentView.solo=null;}
