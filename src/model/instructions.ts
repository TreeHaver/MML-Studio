import type {Project} from './types.ts';
export const INSTRUCTIONS_NAME='Instructions',INSTRUCTIONS_COLOR='#f4d35e';

export function hasInstructions(project:Project){
 return project.notes.some(n=>project.instruments[n.instrument]?.isInstructions||n.tempo!=null||n.timeSignature||n.section||n.resetMeasures||n.loopEntry||n.loopExit||n.loopTie||n.loopCount!=null);
}

// Older version-2 files may contain several Instructions lanes. Preserve every
// event and its ID while routing them to the single dedicated lane.
export function consolidateInstructions(project:Project){
 const first=project.instruments.findIndex(i=>i.isInstructions);if(first<0)return;
 const routes:number[]=[];const instruments:Project['instruments']=[];
 project.instruments.forEach((instrument,index)=>{
  if(instrument.isInstructions&&index!==first){routes[index]=routes[first];return;}
  routes[index]=instruments.length;instruments.push(instrument);
 });
 if(instruments.length===project.instruments.length)return;
 project.instruments=instruments;
 project.notes=project.notes.map(n=>({...n,instrument:routes[n.instrument]}));
}

export function ensureInstructions(project:Project):number{
 const existing=project.instruments.findIndex(i=>i.isInstructions);
 if(existing>=0)return existing;
 project.instruments.push({name:INSTRUCTIONS_NAME,color:INSTRUCTIONS_COLOR,isInstructions:true});
 return project.instruments.length-1;
}

// Recognize only the previous importer's specifically named silent marker lane.
// This adds role metadata without changing version-2 note/event storage.
export function recognizeLegacyInstructions(project:Project){
 project.instruments.forEach((instrument,index)=>{
  if(instrument.isInstructions===undefined&&!instrument.isDrum&&instrument.name==='Tempo markers (silent)'&&
     project.notes.some(n=>n.instrument===index)&&project.notes.filter(n=>n.instrument===index).every(n=>n.volume===0&&n.tempo!=null)){
   instrument.isInstructions=true;instrument.name=INSTRUCTIONS_NAME;instrument.color=INSTRUCTIONS_COLOR;
  }
 });
}
