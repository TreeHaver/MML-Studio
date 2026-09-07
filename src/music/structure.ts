import type {Project,Note} from '../model/types.ts';
import {tempoAt} from './tempo.ts';

export function validSignature(value:string){return /^[1-9]\d*\/(1|2|4|8|16|32|64|128)$/.test(value)&&Number.isSafeInteger(Number(value.split('/')[0])*128);}
export function validStructure(notes:Note[]){
 const signatures=new Map<number,string>(),sections=new Map<number,string>();
 for(const n of notes){
  if(n.timeSignature!==undefined&&(typeof n.timeSignature!=='string'||n.timeSignature!==''&&!validSignature(n.timeSignature)))return false;
  if(n.section!==undefined&&typeof n.section!=='string')return false;
  if(n.resetMeasures!==undefined&&typeof n.resetMeasures!=='boolean')return false;
  for(const [value,map] of [[n.timeSignature,signatures],[n.section?.trim(),sections]] as const){if(value){if(map.has(n.start)&&map.get(n.start)!==value)return false;map.set(n.start,value);}}
 }return true;
}
export function sections(project:Project){
 const found=new Map<number,string>();
 for(const n of project.notes)if(project.instruments[n.instrument].isInstructions&&n.section?.trim())found.set(n.start,n.section.trim());
 return [...found].sort((a,b)=>a[0]-b[0]).map(([start,name])=>({start,name}));
}
export function signatureAt(project:Project,tick:number){
 let signature='4/4',start=-1;
 for(const n of project.notes)if(project.instruments[n.instrument]?.isInstructions&&n.timeSignature&&n.start<=tick&&n.start>=start){signature=n.timeSignature;start=n.start;}
 return signature;
}
/** Header edits establish the initial meter, then align to the current measure. */
export function signatureChangeTick(project:Project,tick:number){
 const instructions=project.notes.filter(n=>project.instruments[n.instrument]?.isInstructions);
 if(!instructions.some(n=>n.timeSignature))return 0;
 tick=Math.max(0,Math.floor(tick));let anchor=0;
 for(const n of instructions)if(n.start<=tick&&(n.timeSignature||n.section?.trim()&&n.resetMeasures))anchor=Math.max(anchor,n.start);
 const [beats,denominator]=signatureAt(project,tick).split('/').map(Number),measure=beats*128/denominator;
 return anchor+Math.floor((tick-anchor)/measure)*measure;
}
export function measureLines(project:Project,from:number,to:number){
 const changes=new Map<number,{signature?:string,reset?:boolean}>([[0,{signature:'4/4'}]]);
 for(const n of project.notes)if(project.instruments[n.instrument].isInstructions){
  if(n.timeSignature||n.section?.trim()&&n.resetMeasures){const change=changes.get(n.start)??{};if(n.timeSignature)change.signature=n.timeSignature;if(n.section?.trim()&&n.resetMeasures)change.reset=true;changes.set(n.start,change);}
 }
 const sorted=[...changes].sort((a,b)=>a[0]-b[0]),lines:{tick:number,bar:number,major:boolean,signature:string}[]=[];let bar=1,signature='4/4';
 for(let i=0;i<sorted.length;i++){
  const [start,change]=sorted[i];signature=change.signature??signature;if(change.reset)bar=1;
  const stop=sorted[i+1]?.[0]??Infinity,[beats,denominator]=signature.split('/').map(Number),beat=128/denominator,measure=beat*beats;
  for(let k=Math.max(0,Math.ceil((from-start)/beat));start+k*beat<Math.min(stop,to);k++)lines.push({tick:start+k*beat,bar:bar+Math.floor(k/beats),major:k%beats===0,signature});
  if(stop>=to)break;bar+=Math.ceil((stop-start)/measure);
 }return lines;
}
/** Rebase a segment, carrying the global tempo and each lane's inherited volume. */
export function sliceProject(project:Project,start:number,end:number):Project{
 const volumes=new Map<number,number>(),notes:Note[]=[];
 const sorted=[...project.notes].sort((a,b)=>a.start-b.start||a.id-b.id);
 for(let a=0;a<sorted.length;){let b=a;while(b<sorted.length&&sorted[b].start===sorted[a].start){const n=sorted[b++];if(n.volume!==null)volumes.set(n.instrument,n.volume);}
  for(;a<b;a++){const n=sorted[a];if(project.instruments[n.instrument].isInstructions){if(n.start>=start&&n.start<end)notes.push({...n,start:n.start-start});}
   else if(n.start<end&&n.start+n.length>start)notes.push({...n,start:Math.max(start,n.start)-start,length:Math.min(end,n.start+n.length)-Math.max(start,n.start),volume:volumes.get(n.instrument)??8,tempo:n.start>=start?n.tempo:null});
  }
 }
 const instruments=project.instruments.map(i=>({...i}));let index=instruments.findIndex(i=>i.isInstructions);
 if(index<0){index=instruments.length;instruments.push({name:'Instructions',color:'#f4d35e',isInstructions:true});}
 notes.push({id:project.notes.reduce((id,n)=>Math.max(id,n.id),0)+1,instrument:index,start:0,length:1,pitch:60,volume:0,tempo:tempoAt(project.notes,start)});
 return {...project,instruments,notes};
}
export function exportSegments(project:Project,separate:boolean){
 const markers=separate?sections(project):[];
 if(!markers.length)return [{name:'',project}];
 const end=project.notes.reduce((end,n)=>project.instruments[n.instrument].isInstructions?end:Math.max(end,n.start+n.length),0);
 if(markers[0].start>0)markers.unshift({start:0,name:'Opening'});
 return markers.filter(m=>m.start<end).map((m,i)=>({name:`${String(i+1).padStart(2,'0')}-${m.name}`,project:sliceProject(project,m.start,Math.min(markers[i+1]?.start??end,end))}));
}
