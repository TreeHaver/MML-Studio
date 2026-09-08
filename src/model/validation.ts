import {validSpeed} from '../music/speed.ts';
import {validStructure} from '../music/structure.ts';
import {validLoops} from '../music/loops.ts';
import {tempoMap} from '../music/tempo.ts';
import type {Note,Project} from '../model/types.ts';
export function valid(notes:Note[]):boolean {
 if(!validStructure(notes)||!validLoops(notes)||!validSpeed(notes))return false;
 try {tempoMap(notes);} catch {return false;}
 const groups=new Map<number,Map<number,Note[]>>();
 for(const n of notes){
  if(!Number.isInteger(n.start)||n.start<0||!Number.isInteger(n.length)||n.length<=0||!Number.isInteger(n.pitch))return false;
  let pitches=groups.get(n.instrument);if(!pitches){pitches=new Map();groups.set(n.instrument,pitches);}
  const group=pitches.get(n.pitch)??[];group.push(n);pitches.set(n.pitch,group);
 }
 for(const pitches of groups.values())for(const group of pitches.values()){
  group.sort((a,b)=>a.start-b.start);
  // Overlaps are musically unusual but valid in the editor; MML export will
  // warn because a single channel cannot represent simultaneous same-pitch notes.
 }
 return true;
}
