import {speedMap,speedAt,speedRegions,type SpeedEvent} from './speed.ts';
import {partitionChannels} from './channels.ts';
import {hasOverlappingNotes} from './note-density.ts';
import {resolveVolumes} from './volume.ts';
import {expandLoops} from './loops.ts';
import {DRUM_KIT_NAME,DRUM_MS2_WARNING} from '../playback/drums.ts';
import type {Note,Project} from '../model/types.ts';
import {tempoMap,type TempoEvent} from './tempo.ts';
import {optimizeInstructions,removeSupersededTempos} from './mml-optimizer.ts';

export type MmlResult={channels:string[],bytes:number,warnings:string[]};
const pitches=['c','c+','d','d+','e','f','f+','g','g+','a','a+','b'];
// Every stored integer duration is exact. Ties are duration decomposition,
// not snapping to the editor grid. The optimizer may use dotted L defaults.
const lengths=Array.from({length:8},(_,i)=>2**i).flatMap(d=>[
 {units:128/d,text:String(d)},...(d<128?[{units:192/d,text:d+'.'}]:[])
]).sort((a,b)=>b.units-a.units);
/** Rational arithmetic keeps odd ticks and decimal multipliers exact in MML. */
function scaledDuration(symbol:string,units:number,multiplier:number,tempoRatio=1,restTempo=1):string {
 const [decimal,exponent='0']=String(multiplier).toLowerCase().split('e'),digits=decimal.replace('.',''),places=(decimal.split('.')[1]?.length??0)-Number(exponent);
 let numerator=BigInt(units)*10n**BigInt(Math.max(0,places))*BigInt(restTempo),denominator=128n*BigInt(digits)*10n**BigInt(Math.max(0,-places))*BigInt(tempoRatio);
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
/** Export-only local clock search. Every candidate uses the exact duration
 * ratio, and includes both tempo commands and the held continuation prefix. */
function extremeSpan(symbol:string,units:number,multiplier:number,bpm:number,tied:boolean,regular:string):string {
 const prefix=tied?'&':'',baseline=prefix+regular;
 let best=baseline,cost=optimizeInstructions(baseline).length;
 // Single conventional lengths suggest useful integer tempos. T32 also
 // shortens very long tied notes that cannot fit in a single length.
 const candidates=new Set([32,...lengths.map(l=>bpm*multiplier*l.units/units).filter(t=>Number.isInteger(t)&&t>=32&&t<=255)]);
 for(const tempo of candidates){
  if(tempo===bpm)continue;
  const candidate='t'+tempo+prefix+scaledDuration(symbol,units,multiplier,bpm,tempo)+'t'+bpm;
  const size=optimizeInstructions(candidate).length;
  if(size<cost){best=candidate;cost=size;}
 }
 return best;
}
function voice(notes:Note[],tempos:TempoEvent[],volumes:Map<number,number>,speeds:SpeedEvent[],endTick?:number,compactRests=false,extremeCompression=false):string {
 const parts:string[]=[];let tick=0,event=0,octave=-99,volume=-1,bpm=120;
 const tempo=()=>{while(event<tempos.length&&tempos[event].tick===tick){bpm=tempos[event++].bpm;parts.push('t'+bpm);}};
 const span=(symbol:string,end:number)=>{
  let continuation=false;
  while(tick<end){tempo();const stop=Math.min(end,tempos[event]?.tick??Infinity,speeds.find(s=>s.tick>tick)?.tick??Infinity);
   // & prefixes the continued note, after any tempo instruction at this tick.
   const tied=continuation&&symbol!=='r';
   const multiplier=speedAt(speeds,tick),regular=duration(symbol,stop-tick,multiplier);
   // Local rest clocks are opt-in for ensemble files. Restore the musical
   // tempo before any sounding note; integer ratios preserve exact elapsed time.
   const compressed=compactRests&&symbol==='r'&&bpm>32?'t32'+scaledDuration('r',stop-tick,multiplier,bpm,32)+'t'+bpm:regular;
   const ordinary=compressed.length<regular.length?compressed:regular;
   parts.push(extremeCompression?extremeSpan(symbol,stop-tick,multiplier,bpm,tied,ordinary):(tied?'&':'')+ordinary);tick=stop;
   continuation=true;
  }
 };
 for(const n of notes){span('r',n.start);tempo();const o=n.pitch===11?0:n.pitch===120?8:Math.floor(n.pitch/12)-1,v=volumes.get(n.id)??8;
  // A silent final carrier preserves editor duration; export its tail as rests.
  if(n===notes.at(-1)&&v===0&&notes.some(note=>(volumes.get(note.id)??8)>0)){span('r',n.start+n.length);continue;}
  if(o!==octave){parts.push('o'+o);octave=o;}if(v!==volume){parts.push('v'+v);volume=v;}
  span(n.pitch===11?'c-':n.pitch===120?'b+':pitches[((n.pitch%12)+12)%12],n.start+n.length);
 }
 if(endTick!==undefined)span('r',endTick);
 let result=optimizeInstructions(parts.join(''));
 if(!extremeCompression)return result;
 result=removeSupersededTempos(result);
 // L defaults are optimized over a whole channel, so a locally shorter span
 // is accepted only when the final channel is shorter too.
 const ordinary=voice(notes,tempos,volumes,speeds,endTick,compactRests,false);
 return result.length<ordinary.length?result:ordinary;
}
export function generateMml(project:Project,index:number,source=project.notes.filter(n=>n.instrument===index),tempos=tempoMap(project.notes,false),options:{endTick?:number,volumes?:Map<number,number>,skipWarnings?:boolean,speeds?:SpeedEvent[],compactRests?:boolean,extremeCompression?:boolean}={}):MmlResult {
 if(project.notes.some(n=>project.instruments[n.instrument]?.isInstructions&&(n.loopEntry||n.loopExit))){
  const expanded=expandLoops(project);
  if(expanded.project!==project){const result=generateMml(expanded.project,index,undefined,undefined,{endTick:expanded.end,compactRests:options.compactRests,extremeCompression:options.extremeCompression});result.warnings.push(...expanded.warnings);return result;}
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
 const channels=lanes.map(lane=>voice(lane,tempos,volumes,options.speeds??speedMap(project.notes),options.endTick,options.compactRests,options.extremeCompression));
 if(channels.some(c=>[...c.matchAll(/[a-gr][+-]?(\d+)/g)].some(m=>Number(m[1])>128)))warnings.push('Speed simulation requires lengths finer than 1/128. Exact denominators are retained; verify support in the target player.');
 if(overlap)warnings.push('Overlapping notes: same start time and pitch in this instrument; MS2 may produce strange behavior.');
 if(channels.length>10)warnings.push(`Over 10 Channels: ${channels.length} required. All instructions are retained.`);
 // Generated syntax is ASCII only: one character is exactly one UTF-8 byte.
 const bytes=channels.reduce((total,text)=>total+text.length,0);
 return {channels,bytes,warnings};
}
