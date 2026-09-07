import {hasOverlappingNotes} from '../music/note-density.ts';
import {readSMF} from './smf.ts';
import {colors} from '../model/project.ts';
import {GM_PROGRAMS} from '../playback/gm-programs.ts';
import {DRUM_KIT_NAME,DRUM_MS2_WARNING} from '../playback/drums.ts';
import type {Note,Project} from '../model/types.ts';
import {ensureInstructions} from '../model/instructions.ts';

export type MidiImport={project:Project,warnings:string[],noteCount:number};
type Pending={tick:number,pitch:number,velocity:number,track:number,channel:number,port:number,program:number};
type Channel={program:number,sustain:boolean,down:Map<number,Pending[]>,held:Pending[]};
export function importMidi(bytes:Uint8Array):MidiImport{
 const midi=readSMF(bytes),warnings=new Set(midi.warnings);
 const project:Project={format:'mml-studio',version:2,grid:4,instruments:[],notes:[]};
 const channels=new Map<string,Channel>(),groups=new Map<string,number[]>();
 const tempos=new Map<number,number>(),signatures=new Map<number,string>();let rounded=false,noteCount=0;
 const unit=(tick:number)=>{const exact=tick*32/midi.ppq,value=Math.round(exact);if(Math.abs(exact-value)>1e-8)rounded=true;return value;};
 function close(n:Pending,tick:number){
  noteCount++;
  const start=unit(n.tick),end=Math.max(start+1,unit(tick));
  if(tick<=n.tick)warnings.add('Zero-duration notes were expanded to one timing unit.');
  const key=[n.track,n.port,n.channel,n.program].join(':');
  let lanes=groups.get(key);if(!lanes){lanes=[];groups.set(key,lanes);}
  let instrument=lanes[0];
  if(instrument===undefined){
   instrument=project.instruments.length;
   const label=n.channel===9?DRUM_KIT_NAME:GM_PROGRAMS[n.program];
   project.instruments.push({name:`${midi.names[n.track]} · Ch ${n.channel+1} · ${label}`,color:colors[instrument%colors.length],midiProgram:n.channel===9?0:n.program,...(n.channel===9?{isDrum:true}:{})});
   lanes.push(instrument);
  }

  project.notes.push({id:noteCount,instrument,start,length:end-start,pitch:n.pitch,volume:Math.max(1,Math.round(n.velocity*15/127))});
 }
 // Pair notes first; sorting completed notes by start avoids unnecessary voice
 // splitting when a short, later note ends before an earlier sustained note.
 const completed:{note:Pending,end:number}[]=[];
 const finish=(note:Pending,end:number)=>{completed.push({note,end});};
 for(const e of midi.events){
  if(e.status===255){
   if(e.meta===81){
    const raw=60000000/(e.data[0]*65536+e.data[1]*256+e.data[2]);
    const bpm=Math.round(raw),tick=unit(e.tick);
    if(Math.abs(raw-bpm)>1e-8)warnings.add('MIDI tempo was rounded to the nearest whole BPM for integer tempo instructions.');
    if(tempos.has(tick)&&tempos.get(tick)!==bpm)warnings.add('Coincident tempo changes were merged; the last event wins.');
    tempos.set(tick,bpm);
   }
   if(e.meta===88){
    if(e.data[1]>7){warnings.add('A MIDI time signature denominator finer than 1/128 is not representable by the editor and was skipped.');continue;}
    const signature=`${e.data[0]}/${2**e.data[1]}`,tick=unit(e.tick);
    if(signatures.has(tick)&&signatures.get(tick)!==signature)warnings.add('Coincident time signature changes were merged; the last event wins.');
    signatures.set(tick,signature);
    if(e.data[3]!==8)warnings.add('Nonstandard MIDI notated 32nd-note scaling is not represented; the time signature numerator and denominator were retained.');
   }
   continue;
  }
  if(e.status>=240){warnings.add('System-exclusive messages are not imported.');continue;}
  const channel=e.status&15,key=`${e.port}:${channel}`,kind=e.status>>4;
  let c=channels.get(key);if(!c){c={program:0,sustain:false,down:new Map(),held:[]};channels.set(key,c);}
  const flushHeld=()=>{for(const n of c!.held)finish(n,e.tick);c!.held=[];};
  if(kind===12){c.program=e.data[0];continue;}
  if(kind===9&&e.data[1]>0){
   const n={tick:e.tick,pitch:e.data[0],velocity:e.data[1],track:e.track,channel,port:e.port,program:c.program};
   const queue=c.down.get(n.pitch)??[];queue.push(n);c.down.set(n.pitch,queue);
   if(channel===9){warnings.add(`${DRUM_KIT_NAME}: ${DRUM_MS2_WARNING}`);if(c.program!==0)warnings.add('Alternate MIDI drum kits use the Standard Drum Kit for preview.');}
  }else if(kind===8||kind===9){
   const queue=c.down.get(e.data[0]),n=queue?.shift();
   if(!queue?.length)c.down.delete(e.data[0]);
   if(n){if(c.sustain)c.held.push(n);else finish(n,e.tick);}
   else warnings.add('Unmatched note-off events were ignored.');
  }else if(kind===11){
   const [cc,value]=e.data;
   if(cc===64){c.sustain=value>=64;if(!c.sustain)flushHeld();}
   else if(cc===120||cc===123){
    for(const queue of c.down.values())for(const n of queue){if(cc===123&&c.sustain)c.held.push(n);else finish(n,e.tick);}
    c.down.clear();if(cc===120)flushHeld();
   }else if(cc===121){c.sustain=false;flushHeld();}
   else warnings.add('Controllers other than sustain and note/reset controls are not imported (including bank, volume, pan and expression).');
  }else warnings.add('Pitch bend and aftertouch are not imported.');
 }
 for(const c of channels.values()){
  const remaining=[...c.down.values()].flat().concat(c.held);
  if(remaining.length)warnings.add('Unreleased notes were ended at the end of the MIDI file.');
  for(const n of remaining)finish(n,midi.end);
 }
 if(!completed.length&&!tempos.size&&!signatures.size)throw Error('This MIDI file contains no supported notes, tempo or time signature instructions to import.'+[...warnings].map(w=>' '+w).join(''));
 completed.sort((a,b)=>a.note.tick-b.note.tick);
 for(const n of completed)close(n.note,n.end);
 if(rounded)warnings.add('Timing was rounded to the nearest 1/128-whole-note unit, without snapping to the grid or power-of-two lengths.');
 if(hasOverlappingNotes(project.notes))warnings.add('Overlapping notes with the same start time and pitch were preserved in the same instrument; MML export will warn about this.');
 if(noteCount)warnings.add('MIDI velocity was mapped to the editor’s V1–V15 range.');
 // Version 2 attaches tempo to notes. Silent V0 markers preserve changes in
 // rests or inside held notes, without splitting/retriggering audible notes.
 let tempoLane=-1,previous=120;
 const firstAt=new Map<number,Note>();for(const n of project.notes)if(!firstAt.has(n.start))firstAt.set(n.start,n);
 for(const [tick,bpm] of [...tempos].sort((a,b)=>a[0]-b[0])){
  if(bpm===previous&&(completed.length>0||project.notes.length>0))continue;previous=bpm;
  const note=firstAt.get(tick);
  if(note)note.tempo=bpm;
  else{
   if(tempoLane<0)tempoLane=ensureInstructions(project);
   project.notes.push({id:project.notes.length+1,instrument:tempoLane,start:tick,length:1,pitch:60,volume:0,tempo:bpm});
  }
 }
 // Signatures always belong to silent Instructions, even on a musical onset.
 // Reuse unbound tempo markers at the same position when present.
 const markers=new Map(project.notes.filter(n=>project.instruments[n.instrument].isInstructions).map(n=>[n.start,n]));
 for(const [tick,timeSignature] of signatures){
  const marker=markers.get(tick);
  if(marker)marker.timeSignature=timeSignature;
  else project.notes.push({id:project.notes.length+1,instrument:ensureInstructions(project),start:tick,length:1,pitch:60,volume:0,timeSignature});
 }
 project.notes.sort((a,b)=>a.start-b.start||a.id-b.id);
 return {project,warnings:[...warnings],noteCount};
}
