import {state,instrumentView} from './state.ts';
import {mergeSegment,projectSegment,fitsSegment,type SegmentRange} from './model/segment-view.ts';
import type {Project} from './model/types.ts';

export function fullProject(edited=state.project):Project{
 const session=state.segment;
 return session?mergeSegment(session.root,session.projection,edited,session.sourceIndices):edited;
}
export function enterSegment(root:Project,range:SegmentRange){
 const projection=projectSegment(root,range);
 state.segment={root,projection,sourceIndices:projection.project.instruments.map((_,index)=>index<root.instruments.length?index:-1)};
 state.project=projection.project;instrumentView.mmlEpoch++;
}
export function restoreProject(project:Project){
 if(state.segment)enterSegment(project,state.segment.projection.range);else state.project=project;
}
export function resetSegment(){state.segment=null;instrumentView.mmlEpoch++;}
export function removeSegmentInstrument(index:number){
 const session=state.segment;if(!session)return;
 while(session.sourceIndices.length<state.project.instruments.length)session.sourceIndices.push(-1);
 session.sourceIndices.splice(index,1);
 if(state.project.instruments.length===1)session.sourceIndices.push(-1);
}
export function historySnapshot(project=state.project){return JSON.stringify(fullProject(project));}
export function fitsCurrentView(project:Project){return !state.segment||fitsSegment(project,state.segment.projection.range);}
export function syncSegment(){
 const session=state.segment;if(!session||state.gesture)return;
 if(JSON.stringify(state.project)===JSON.stringify(session.projection.baseline))return;
 const ids=new Map<number,number>();
 const root=mergeSegment(session.root,session.projection,state.project,session.sourceIndices,ids);
 const route=(index:number)=>{const source=session.sourceIndices[index]??-1;return source>=0?source:session.root.instruments.length+state.project.instruments.slice(0,index).filter((_,i)=>(session.sourceIndices[i]??-1)<0).length;};
 const active=route(state.active);
 if(state.project.instruments.some((_,index)=>route(index)!==index)){
  for(const set of [instrumentView.muted,instrumentView.collapsed]){const mapped=[...set].map(route);set.clear();for(const index of mapped)set.add(index);}
  if(instrumentView.solo!==null)instrumentView.solo=route(instrumentView.solo);instrumentView.mmlEpoch++;
 }
 const projection=projectSegment(root,session.projection.range);
 state.segment={root,projection,sourceIndices:projection.project.instruments.map((_,index)=>index<root.instruments.length?index:-1)};
 state.project=projection.project;state.active=Math.max(0,Math.min(active,state.project.instruments.length-1));state.selectedInstruments.clear();
 const present=new Set(state.project.notes.map(n=>n.id));state.selection=new Set([...state.selection].map(id=>ids.get(id)??id).filter(id=>present.has(id)));
}
