import type {Project,Note} from './types.ts';
import {ensureInstructions} from './instructions.ts';
import {tempoAt} from '../music/tempo.ts';
import {signatureAt} from '../music/structure.ts';
import {valid} from './validation.ts';

export type SegmentRange={kind:'song'|'segment',name:string,start:number,end:number};
export type Projection={project:Project,baseline:Project,range:SegmentRange};
export function projectEnd(project:Project){return project.notes.reduce((end,n)=>Math.max(end,n.start+n.length),0);}
export function sectionMarkers(project:Project){
 const markers=new Map<number,{start:number,name:string,song:boolean}>();
 for(const n of project.notes)if(project.instruments[n.instrument].isInstructions&&n.section?.trim()){
  const previous=markers.get(n.start);markers.set(n.start,{start:n.start,name:n.section.trim(),song:!!n.resetMeasures||!!previous?.song});
 }
 return [...markers.values()].sort((a,b)=>a.start-b.start);
}
export function rangeAt(project:Project,tick:number,kind:SegmentRange['kind'],lastEnd=projectEnd(project)):SegmentRange|null{
 const markers=sectionMarkers(project).filter(m=>kind==='segment'||m.song);
 const index=markers.findLastIndex(m=>m.start<=tick);if(index<0)return null;
 const marker=markers[index],end=markers[index+1]?.start??lastEnd;
 return end>marker.start&&tick<end?{kind,name:marker.name,start:marker.start,end}:null;
}
function resolvedVolumes(project:Project){
 const values=new Map<number,number>(),volumes=new Map<number,number>(),sorted=[...project.notes].sort((a,b)=>a.start-b.start||a.id-b.id);
 for(let a=0;a<sorted.length;){let b=a;while(b<sorted.length&&sorted[b].start===sorted[a].start){const n=sorted[b++];if(n.volume!==null)volumes.set(n.instrument,n.volume);}
  for(;a<b;a++)values.set(sorted[a].id,volumes.get(sorted[a].instrument)??8);
 }return values;
}
/** Editable local projection. Baseline remembers every automatic clip/context value. */
export function projectSegment(root:Project,range:SegmentRange):Projection{
 const {start,end}=range,volumes=resolvedVolumes(root),project:Project={...root,instruments:root.instruments.map(i=>({...i})),notes:[]};
 for(const n of root.notes){
  if(root.instruments[n.instrument].isInstructions){if(n.start>=start&&n.start<end)project.notes.push({...n,start:n.start-start,length:Math.min(n.length,end-n.start)});}
  else if(n.start<end&&n.start+n.length>start)project.notes.push({...n,start:Math.max(n.start,start)-start,length:Math.min(n.start+n.length,end)-Math.max(n.start,start),...(n.start<start?{tempo:null,volume:volumes.get(n.id)!}:{})});
 }
 // Seed the first onset per lane, leaving subsequent inherited V values editable.
 for(let instrument=0;instrument<project.instruments.length;instrument++){
  if(project.instruments[instrument].isInstructions)continue;
  const lane=project.notes.filter(n=>n.instrument===instrument).sort((a,b)=>a.start-b.start||a.id-b.id);if(!lane.length)continue;
  const first=lane.filter(n=>n.start===lane[0].start);
  if(first.every(n=>n.volume===null)){const last=first[first.length-1];last.volume=volumes.get(last.id)!;}
 }
 let context=project.notes.find(n=>project.instruments[n.instrument].isInstructions&&n.start===0);
 if(!context){context={id:root.notes.reduce((max,n)=>Math.max(max,n.id),0)+1,instrument:ensureInstructions(project),start:0,length:1,pitch:60,volume:0};project.notes.push(context);}
 if(!project.notes.some(n=>n.start===0&&n.tempo!=null))context.tempo=tempoAt(root.notes,start);
 if(!project.notes.some(n=>n.start===0&&project.instruments[n.instrument].isInstructions&&n.timeSignature))context.timeSignature=signatureAt(root,start);
 return {project,baseline:structuredClone(project),range:{...range}};
}
export function fitsSegment(project:Project,range:SegmentRange){
 const duration=range.end-range.start;
 return project.notes.every(n=>n.start>=0&&n.start<duration&&(project.instruments[n.instrument].isInstructions||n.start+n.length<=duration));
}
const keys=['start','length','pitch','volume','tempo','timeSignature','section','resetMeasures'] as const;
/** Apply explicit view changes to the parent, preserving untouched source notes verbatim. */
export function mergeSegment(root:Project,projection:Projection,edited:Project,sourceIndices:number[],ids=new Map<number,number>()):Project{
 if(!fitsSegment(edited,projection.range))throw Error('This edit extends beyond the current view. Return to Project to edit across its boundary.');
 const {start,end}=projection.range,baseline=new Map(projection.baseline.notes.map(n=>[n.id,n])),current=new Map(edited.notes.map(n=>[n.id,n]));
 const originals=new Map(root.notes.map(n=>[n.id,n])),volumes=resolvedVolumes(root);
 const instruments=root.instruments.map(i=>({...i})),routing=edited.instruments.map((instrument,index)=>{
  const source=sourceIndices[index]??-1;if(source>=0){instruments[source]={...instrument};return source;}
  instruments.push({...instrument});return instruments.length-1;
 });
 let id=Math.max(root.notes.reduce((max,n)=>Math.max(max,n.id),0),edited.notes.reduce((max,n)=>Math.max(max,n.id),0));
 const notes:Note[]=[];
 const changed=(base:Note,n:Note)=>keys.some(key=>base[key]!==n[key])||routing[n.instrument]!==base.instrument;
 for(const original of root.notes){
  const base=baseline.get(original.id);if(!base){notes.push({...original});continue;}
  const n=current.get(original.id);if(n&&!changed(base,n)){notes.push({...original});ids.set(n.id,original.id);continue;}
  const musical=!root.instruments[original.instrument].isInstructions;
  const left=musical&&original.start<start,right=musical&&original.start+original.length>end;
  if(left)notes.push({...original,length:start-original.start});
  if(n){
   const updated={...original};
   for(const key of keys)if(base[key]!==n[key]){if(n[key]===undefined)delete updated[key];else (updated as any)[key]=n[key];}
   updated.id=left?++id:original.id;updated.instrument=routing[n.instrument];updated.start=n.start+start;updated.length=n.length;
   if(left){updated.tempo=n.tempo;updated.volume=n.volume===null?volumes.get(original.id)!:n.volume;}
   notes.push(updated);ids.set(n.id,updated.id);
  }
  if(right)notes.push({...original,id:left||n?++id:original.id,start:end,length:original.start+original.length-end,tempo:null,volume:volumes.get(original.id)!});
 }
 for(const n of edited.notes)if(!originals.has(n.id)||!baseline.has(n.id)){
  const base=baseline.get(n.id);
  if(base&&!changed(base,n))continue; // automatic inherited context is view-only
  const added={...n,id:++id,start:n.start+start,instrument:routing[n.instrument]};
  if(base){for(const key of ['tempo','timeSignature','section','resetMeasures'] as const)if(base[key]===n[key])delete added[key];}
  notes.push(added);ids.set(n.id,added.id);
 }
 // Removed view lanes remain in the parent for any music outside the view.
 const result={...root,name:edited.name,grid:edited.grid,instruments,notes};
 if(!valid(result.notes))throw Error('The edit conflicts with an instruction in the full project.');
 return result;
}
