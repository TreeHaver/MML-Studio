import {MS2_DRUMS,drumCategory} from '../playback/drums.ts';
import {colors} from './project.ts';
import type {Project,Note} from './types.ts';
import {fresh} from './project.ts';
import {resolveVolumes,volumeAt} from '../music/volume.ts';

function check(project:Project,index:number){
 if(!Number.isInteger(index)||!project.instruments[index])throw Error('Choose an existing instrument.');
}
export function deleteInstrument(project:Project,index:number):Project{
 check(project,index);
 if(project.instruments[index].isInstructions)throw Error('Instructions is a permanent lane. Delete its events instead.');
 if(project.instruments.filter(i=>!i.isInstructions).length===1)return {...project,instruments:project.instruments.map((i,j)=>j===index?fresh().instruments[0]:i),notes:project.notes.filter(n=>n.instrument!==index)};
 const instruments=project.instruments.filter((_,i)=>i!==index);
 return {...project,instruments:instruments.length?instruments:fresh().instruments,
  notes:project.notes.filter(n=>n.instrument!==index).map(n=>({...n,instrument:n.instrument>index?n.instrument-1:n.instrument}))};
}
export function mergeInstruments(project:Project,source:number,target:number){
 check(project,source);check(project,target);
 if(source===target)throw Error('Choose a different destination.');
 if(project.instruments[source].isInstructions||project.instruments[target].isInstructions)
  throw Error('Cannot merge silent Instructions. Merge musical instruments only.');
 // Resolve each original lane before combining, so interleaved notes retain V inheritance.
 const volumes=resolveVolumes(project.notes.filter(n=>n.instrument===source||n.instrument===target));
 const notes:Note[]=project.notes.map(n=>{
  if(!volumes.has(n.id))return {...n,instrument:n.instrument>source?n.instrument-1:n.instrument};
  const volume=volumes.get(n.id)!;
  return {...n,volume,instrument:target>source?target-1:target};
 });
 return {project:{...project,instruments:project.instruments.filter((_,i)=>i!==source),notes},volumeConflict:false};
}

// Materialize both affected lanes before partitioning to preserve their original V inheritance.
function resolvedNotes(project:Project,lanes:Set<number>){
 const volumes=resolveVolumes(project.notes.filter(n=>lanes.has(n.instrument)));
 return project.notes.map(n=>({...n,...(volumes.has(n.id)?{volume:volumes.get(n.id)!}:{})}));
}
export function parseSplitPitch(text:string){
 const match=/^([A-Ga-g])(#|b)?(-?\d+)$/.exec(text.trim());
 if(!match)throw Error('Enter a note name such as B1 or C#3.');
 const pitch=(Number(match[3])+1)*12+({C:0,D:2,E:4,F:5,G:7,A:9,B:11}[match[1].toUpperCase()]!)+(match[2]==='#'?1:match[2]==='b'?-1:0);
 if(!Number.isSafeInteger(pitch))throw Error('Invalid note octave.');return pitch;
}
export function splitNotes(project:Project,source:number,target:number,pitch:number){
 check(project,source);check(project,target);
 if(source===target)throw Error('Choose a different destination.');
 if(project.instruments[source].isInstructions||project.instruments[target].isInstructions)throw Error('Split notes between musical instruments only.');
 const count=project.notes.filter(n=>n.instrument===source&&n.pitch===pitch).length;
 if(!count)return {project,count,volumeConflict:false};
 const notes=resolvedNotes(project,new Set([source,target])).map(n=>n.instrument===source&&n.pitch===pitch?{...n,instrument:target}:n);
 return {project:{...project,notes},count,volumeConflict:false};
}
export function splitDrumkit(project:Project,source:number){
 check(project,source);if(!project.instruments[source].isDrum)throw Error('Select a Standard Drum Kit.');
 const instruments=[...project.instruments],destinations=new Map<string,number>();let count=0;
 for(const n of project.notes.filter(n=>n.instrument===source)){const key=drumCategory(n.pitch);if(!key||destinations.has(key))continue;destinations.set(key,instruments.length);instruments.push({name:MS2_DRUMS[key].name,color:colors[instruments.length%colors.length],ms2Drum:key});}
 if(!destinations.size)return {project,count};
 const notes=resolvedNotes(project,new Set([source])).map(n=>{const key=n.instrument===source?drumCategory(n.pitch):undefined;if(!key)return n;count++;return {...n,instrument:destinations.get(key)!};});
 return {project:{...project,instruments,notes},count};
}

/** MapleStory 2 volumes run V0 to V15. Nothing may leave that range. */
export const MAX_VOLUME=15;
const clampVolume=(value:number)=>Math.max(0,Math.min(MAX_VOLUME,Math.round(value)));
/**
 * The quietest and loudest an instrument actually sounds, inheritance included, so the
 * interface can say how much room is left before the loudest note reaches the cap.
 */
export function instrumentVolumes(project:Project,index:number){
 const notes=project.notes.filter(n=>n.instrument===index);
 if(!notes.length)return null;
 const values=notes.map(n=>volumeAt(project,n));
 const max=Math.max(...values),min=Math.min(...values);
 return {min,max,headroom:MAX_VOLUME-max,floor:min};
}
/**
 * Moves every note of one instrument by the same amount, which is the whole point: the
 * loud parts stay louder than the quiet ones. Only explicitly set volumes are rewritten,
 * since a note that inherits follows the note it inherits from. An instrument that has
 * never had a volume set sounds at the default, so the value is written once on its first
 * note and inheritance carries it from there.
 */
export function shiftInstrumentVolumes(project:Project,index:number,delta:number){
 const mine=project.notes.filter(n=>n.instrument===index);
 if(!mine.length||!delta)return project.notes;
 if(!mine.some(n=>n.volume!==null)){
  const first=mine.reduce((a,b)=>a.start<b.start||(a.start===b.start&&a.id<b.id)?a:b);
  return project.notes.map(n=>n.id===first.id?{...n,volume:clampVolume(volumeAt(project,n)+delta)}:n);
 }
 return project.notes.map(n=>n.instrument===index&&n.volume!==null?{...n,volume:clampVolume(n.volume+delta)}:n);
}

/** The musical instruments, which is everything except the silent Instructions lane. */
const musicalIndexes=(project:Project)=>project.instruments.map((instrument,index)=>({instrument,index})).filter(entry=>!entry.instrument.isInstructions&&project.notes.some(n=>n.instrument===entry.index)).map(entry=>entry.index);
/**
 * The quietest and loudest the whole piece sounds, and which instrument is nearest each end.
 * A shift that moves everything by one amount is limited by those two instruments, and that
 * is the point: the distance between the parts is what makes the arrangement.
 */
export function projectVolumes(project:Project){
 const parts=musicalIndexes(project).map(index=>({index,range:instrumentVolumes(project,index)!}));
 if(!parts.length)return null;
 const loudest=parts.reduce((a,b)=>b.range.max>a.range.max?b:a);
 const quietest=parts.reduce((a,b)=>b.range.min<a.range.min?b:a);
 return {min:quietest.range.min,max:loudest.range.max,headroom:MAX_VOLUME-loudest.range.max,
  loudestInstrument:loudest.index,quietestInstrument:quietest.index};
}
/** Every instrument moved by the same amount, so the balance between them is untouched. */
export function shiftProjectVolumes(project:Project,delta:number){
 let notes=project.notes;
 for(const index of musicalIndexes(project))notes=shiftInstrumentVolumes({...project,notes},index,delta);
 return notes;
}
