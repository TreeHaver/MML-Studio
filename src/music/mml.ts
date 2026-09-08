import {speedMap,speedAt,speedRegions,type SpeedEvent} from './speed.ts';
import {partitionChannels} from './channels.ts';
import {hasOverlappingNotes} from './note-density.ts';
import {resolveVolumes} from './volume.ts';
import {expandLoops} from './loops.ts';
import {DRUM_KIT_NAME,DRUM_MS2_WARNING} from '../playback/drums.ts';
import type {Note,Project} from '../model/types.ts';
import {tempoMap,type TempoEvent} from './tempo.ts';
import {optimizeInstructions} from './mml-optimizer.ts';

export type MmlResult={channels:string[],bytes:number,warnings:string[]};
const pitches=['c','c+','d','d+','e','f','f+','g','g+','a','a+','b'];
// Every stored integer duration is exact. Ties are duration decomposition,
// not snapping to the editor grid. The optimizer may use dotted L defaults.
const lengths=Array.from({length:8},(_,i)=>2**i).flatMap(d=>[
 {units:128/d,text:String(d)},...(d<128?[{units:192/d,text:d+'.'}]:[])
]).sort((a,b)=>b.units-a.units);
/** Rational arithmetic keeps odd ticks and decimal multipliers exact in MML. */
function scaledDuration(symbol:string,units:number,multiplier:number):string {
 const [decimal,exponent='0']=String(multiplier).toLowerCase().split('e'),digits=decimal.replace('.',''),places=(decimal.split('.')[1]?.length??0)-Number(exponent);
 let numerator=BigInt(units)*10n**BigInt(Math.max(0,places)),denominator=128n*BigInt(digits)*10n**BigInt(Math.max(0,-places));
 const parts:string[]=[],gcd=(a:bigint,b:bigint):bigint=>b?gcd(b,a%b):a;
 const subtract=(n:bigint,d:bigint)=>{numerator=numerator*d-n*denominator;denominator*=d;const g=gcd(numerator,denominator);numerator/=g;denominator/=g;};
 const single=()=>{if(numerator>0n&&denominator%numerator===0n){parts.push(symbol+String(denominator/numerator));numerator=0n;return true;}return false;};
 single();
 for(const l of lengths){const n=BigInt(l.units),d=128n;
  while(numerator*d>=n*denominator){parts.push(symbol+l.text);subtract(n,d);if(single())break;}
 }
 // Unit fractions also cover non-power-of-two multipliers without rounding.
 while(numerator>0n){const d=(denominator+numerator-1n)/numerator;parts.push(symbol+d);subtract(1n,d);}
 return parts.join(symbol==='r'?'':'&');
}
function duration(symbol:string,units:number,multiplier=1):string {
 if(multiplier!==1)return scaledDuration(symbol,units,multiplier);
 const parts:string[]=[];
 for(const l of lengths)while(units>=l.units){parts.push(symbol+l.text);units-=l.units;}
 return parts.join(symbol==='r'?'':'&');
}
function voice(notes:Note[],tempos:TempoEvent[],volumes:Map<number,number>,speeds:SpeedEvent[],endTick?:number):string {
 const parts:string[]=[];let tick=0,event=0,octave=-99,volume=-1;
 const tempo=()=>{while(event<tempos.length&&tempos[event].tick===tick)parts.push('t'+tempos[event++].bpm);};
 const span=(symbol:string,end:number)=>{
  let continuation=false;
  while(tick<end){tempo();const stop=Math.min(end,tempos[event]?.tick??Infinity,speeds.find(s=>s.tick>tick)?.tick??Infinity);
   // & prefixes the continued note, after any tempo instruction at this tick.
   if(continuation&&symbol!=='r')parts.push('&');
   parts.push(duration(symbol,stop-tick,speedAt(speeds,tick)));tick=stop;
   continuation=true;
  }
 };
 for(const n of notes){span('r',n.start);tempo();const o=n.pitch===11?0:n.pitch===120?8:Math.floor(n.pitch/12)-1,v=volumes.get(n.id)??8;
  if(o!==octave){parts.push('o'+o);octave=o;}if(v!==volume){parts.push('v'+v);volume=v;}
  span(n.pitch===11?'c-':n.pitch===120?'b+':pitches[((n.pitch%12)+12)%12],n.start+n.length);
 }
 if(endTick!==undefined)span('r',endTick);
 return optimizeInstructions(parts.join(''));
}
export function generateMml(project:Project,index:number,source=project.notes.filter(n=>n.instrument===index),tempos=tempoMap(project.notes,false),options:{endTick?:number,volumes?:Map<number,number>,skipWarnings?:boolean,speeds?:SpeedEvent[]}={}):MmlResult {
 if(project.notes.some(n=>project.instruments[n.instrument]?.isInstructions&&(n.loopEntry||n.loopExit))){
  const expanded=expandLoops(project);
  if(expanded.project!==project){const result=generateMml(expanded.project,index,undefined,undefined,{endTick:expanded.end});result.warnings.push(...expanded.warnings);return result;}
  const clean={...project,notes:project.notes.map(n=>({...n,loopEntry:undefined,loopExit:undefined}))};
  const result=generateMml(clean,index,source,tempos,options);result.warnings.push(...expanded.warnings);return result;
 }
 const instrument=project.instruments[index],warnings:string[]=[...speedRegions(project.notes).warnings];
 if(instrument.isInstructions)return {channels:[],bytes:0,warnings:['Global tempo instructions are included in every musical channel.']};
 const overlap=!options.skipWarnings&&hasOverlappingNotes(source);
 if(instrument.ms2Drum)source=source.map(n=>({...n,pitch:60}));
 if(instrument.isDrum)warnings.push(`${DRUM_KIT_NAME}: ${DRUM_MS2_WARNING}`);
 if(tempos.some(t=>t.bpm<32||t.bpm>255))warnings.push('Tempo outside MS2 T32–T255: retained unchanged; resolve before export.');
 if(source.some(n=>n.pitch<11||n.pitch>120))warnings.push('Pitch outside MS2 O0–O8 including C-/B+ boundaries: retained unchanged; resolve before export.');
 const notes=[...source].sort((a,b)=>a.start-b.start||a.id-b.id),volumes=options.volumes??resolveVolumes(notes);
 const lanes=partitionChannels(notes);
 if(!lanes.length&&options.endTick)lanes.push([]);
 const channels=lanes.map(lane=>voice(lane,tempos,volumes,options.speeds??speedMap(project.notes),options.endTick));
 if(channels.some(c=>[...c.matchAll(/[a-gr][+-]?(\d+)/g)].some(m=>Number(m[1])>128)))warnings.push('Speed simulation requires lengths finer than 1/128. Exact denominators are retained; verify support in the target player.');
 if(overlap)warnings.push('Overlapping notes: same start time and pitch in this instrument; MS2 may produce strange behavior.');
 if(channels.length>10)warnings.push(`Over 10 Channels: ${channels.length} required. All instructions are retained.`);
 // Generated syntax is ASCII only: one character is exactly one UTF-8 byte.
 const bytes=channels.reduce((total,text)=>total+text.length,0);
 return {channels,bytes,warnings};
}
