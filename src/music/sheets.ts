import type {Project,Note} from '../model/types.ts';
import {generateMml,type MmlResult} from './mml.ts';
import {tempoMap} from './tempo.ts';
import {expandLoops} from './loops.ts';
import {resolveVolumes} from './volume.ts';

export type MmlPart=MmlResult&{start:number,end:number};
/** One shared clock for every channel; all emitted channels fill the part. */
export function createSheetPlanner(project:Project,index:number,limit:number){
 const expanded=expandLoops(project),looped=expanded.project!==project;project=expanded.project;
 if(!Number.isSafeInteger(limit)||limit<1)throw Error('Character limit must be a positive whole number.');
 const source=project.notes.filter(n=>n.instrument===index).sort((a,b)=>a.start-b.start||a.id-b.id);
 const end=source.reduce((end,n)=>Math.max(end,n.start+n.length),looped?expanded.end:0),tempos=tempoMap(project.notes);
 const volumes=resolveVolumes(source);
 const whole=generateMml(project,index,source,tempos,looped?{endTick:end}:{});
 whole.warnings.push(...expanded.warnings);
 const render=(start:number,stop:number):MmlPart=>{
  const notes:Note[]=source.filter(n=>n.start<stop&&n.start+n.length>start).map(n=>({...n,start:Math.max(n.start,start)-start,length:Math.min(n.start+n.length,stop)-Math.max(n.start,start),tempo:null}));
  let bpm=120;for(const t of tempos){if(t.tick>start)break;bpm=t.bpm;}
  const clock=[{tick:0,bpm},...tempos.filter(t=>t.tick>start&&t.tick<stop).map(t=>({...t,tick:t.tick-start}))];
  return {...generateMml(project,index,notes,clock,{endTick:stop-start,volumes,skipWarnings:true}),start,end:stop};
 };
 const next=(start:number):MmlPart=>{
  if(start<0||start>=end||!Number.isSafeInteger(start))throw Error('Invalid part start.');
  const cache=new Map<number,MmlPart>();
  const at=(stop:number)=>{let r=cache.get(stop);if(!r){r=render(start,stop);cache.set(stop,r);}return r;};
  if(at(end).bytes<=limit)return at(end);
  // Encoded duration sizes have small discontinuities (c2 can be shorter than
  // c4&c8). Search conservatively, then verify nearby integer boundaries.
  let low=start+1,high=end-1,best=start;
  while(low<=high){const mid=low+Math.floor((high-low)/2);if(at(mid).bytes<=limit){best=mid;low=mid+1;}else high=mid-1;}
  for(let tick=Math.min(end-1,Math.max(best+32,start+128));tick>Math.max(start,best-32);tick--){if(at(tick).bytes<=limit){best=Math.max(best,tick);break;}}
  if(best===start)throw Error(`Character limit ${limit} is too small to fit the next synchronized notes and their tempo/volume commands. Increase the limit or export in a single file.`);
  // Prefer a clean boundary within one quarter note of the verified cutoff.
  // The union of sounding intervals tells us where no voice is cut.
  const candidates=new Set<number>();
  for(const n of source){for(const t of [n.start,n.start+n.length])if(t>start&&t<=best&&t>=best-32)candidates.add(t);}
  for(const tick of [...candidates].sort((a,b)=>b-a)){
   if(!source.some(n=>n.start<tick&&n.start+n.length>tick)&&at(tick).bytes<=limit)return at(tick);
  }
  return at(best);
 };
 return {whole,end,render,next,sourceTick:expanded.sourceTick,split:()=>{
  if(!whole.channels.length)return [];
  if(whole.bytes<=limit)return [{...whole,start:0,end}];
  const parts:MmlPart[]=[];let start=0;
  while(start<end){const part=next(start);parts.push(part);start=part.end;}
  return parts;
 }};
}

export function ms2Xml(channels:string[]){
 const melody=channels[0]??'',chords=channels.slice(1).map((s,i)=>`    <chord index="${i+1}"><![CDATA[${s}]]></chord>`).join('\n');
 return `<?xml version="1.0" encoding="utf-8"?>\n<ms2>\n    <melody><![CDATA[${melody}]]></melody>${chords?'\n'+chords:''}\n</ms2>\n`;
}
