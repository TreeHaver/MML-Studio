import {INSTRUCTIONS_COLOR} from '../model/instructions.ts';
import type {Note,Project} from '../model/types.ts';
import type {ImportedSong} from './source.ts';
import {generateMml} from '../music/mml.ts';
import {partitionChannels} from '../music/channels.ts';

export const isAudioFile=(name:string)=>/\.(wav|wave|mp3|flac|ogg|oga|opus|m4a|aac|aif|aiff|wma|mp4|webm)$/i.test(name);
const RATE=16000,SIZE=1024;
function validateVoiceCount(voices:number){if(!Number.isSafeInteger(voices)||voices<1)throw Error('Enter a positive whole number of voices.');}
const LEAD_IN=128,MIN_CHANNEL_SECONDS=20; // T240 whole-note rest = exactly one second.
export function audioSampling(intervalMs=30){
 if(!Number.isFinite(intervalMs)||intervalMs<1.875)throw Error('Enter a sample interval of at least 1.875 ms.');
 const ticks=Math.round(intervalMs/1.875);
 if(!Number.isSafeInteger(ticks)||!Number.isSafeInteger(ticks*30))throw Error('The sample interval is too large.');
 return {ticks,hop:ticks*30,intervalMs:ticks*1.875};
}
export function estimateAudioCharacters(seconds:number,intervalMs=30,voices=5){
 validateVoiceCount(voices);
 if(!Number.isFinite(seconds)||seconds<0)throw Error('Invalid clip duration.');
 const sampling=audioSampling(intervalMs),frames=Math.ceil(seconds*RATE/sampling.hop);
 // Planning estimate, not a maximum: six characters per voice/frame plus timing and silence.
 return {...sampling,frames,characters:frames*voices*6+600};
}
type Peak={pitch:number,amplitude:number,score:number};

/** In-place radix-2 FFT. The Hann window is centered on each 30 ms interval. */
function spectrum(samples:Float32Array,center:number){
 const real=new Float64Array(SIZE),imag=new Float64Array(SIZE);
 for(let i=0;i<SIZE;i++)real[i]=(samples[center+i-SIZE/2]??0)*(0.5-0.5*Math.cos(2*Math.PI*i/(SIZE-1)));
 for(let i=1,j=0;i<SIZE;i++){
  let bit=SIZE>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;
  if(i<j)[real[i],real[j]]=[real[j],real[i]];
 }
 for(let size=2;size<=SIZE;size*=2){
  const angle=-2*Math.PI/size,wr=Math.cos(angle),wi=Math.sin(angle);
  for(let start=0;start<SIZE;start+=size){
   let r=1,im=0;
   for(let j=0;j<size/2;j++){
    const a=start+j,b=a+size/2,br=real[b]*r-imag[b]*im,bi=real[b]*im+imag[b]*r;
    real[b]=real[a]-br;imag[b]=imag[a]-bi;real[a]+=br;imag[a]+=bi;
    [r,im]=[r*wr-im*wi,r*wi+im*wr];
   }
  }
 }
 return Float64Array.from(real.subarray(0,SIZE/2),(_,i)=>Math.hypot(real[i],imag[i]));
}

function peaks(samples:Float32Array,center:number,voices:number):Peak[]{
 const bins=spectrum(samples,center),byPitch=new Map<number,Peak>();
 for(let i=6;i<Math.min(bins.length-1,Math.floor(5000*SIZE/RATE));i++){
  if(bins[i]<=bins[i-1]||bins[i]<bins[i+1]||bins[i]<1e-10)continue;
  const left=Math.log(Math.max(1e-12,bins[i-1])),mid=Math.log(bins[i]),right=Math.log(Math.max(1e-12,bins[i+1]));
  const offset=Math.max(-0.5,Math.min(0.5,0.5*(left-right)/(left-2*mid+right)||0));
  const frequency=(i+offset)*RATE/SIZE,pitch=Math.round(69+12*Math.log2(frequency/440));
  const amplitude=Math.hypot(bins[i-1],bins[i],bins[i+1])/SIZE;
  // Modest emphasis helps speech's mid/high components compete with the fundamental.
  const score=amplitude*Math.min(2,Math.sqrt(frequency/500));
  if(!byPitch.has(pitch)||byPitch.get(pitch)!.score<score)byPitch.set(pitch,{pitch,amplitude,score});
 }
 return [...byPitch.values()].sort((a,b)=>b.score-a.score).slice(0,voices);
}

/** A lossy five-tone approximation, not transcription or an embedded recording. */
export function importAudio(samples:Float32Array,sampleRate:number,name:string,intervalMs=30,budget=10000,voices=5):ImportedSong{
 validateVoiceCount(voices);
 if(sampleRate!==RATE||!samples.length)throw Error('Audio analysis requires nonempty 16 kHz mono PCM.');
 const sampling=audioSampling(intervalMs),HOP=sampling.hop,TICKS=sampling.ticks;
 for(const sample of samples)if(!Number.isFinite(sample))throw Error('The decoded audio contains invalid samples.');
 const frames:{peaks:Peak[],rms:number}[]=[];let reference=0,maxRms=0;
 for(let start=0;start<samples.length;start+=HOP){
  const end=Math.min(samples.length,start+HOP);let energy=0;
  for(let i=start;i<end;i++)energy+=samples[i]*samples[i];
  const rms=Math.sqrt(energy/(end-start)),found=peaks(samples,start+Math.floor((end-start)/2),voices);
  maxRms=Math.max(maxRms,rms);for(const peak of found)reference=Math.max(reference,peak.amplitude);
  frames.push({peaks:found,rms});
 }
 if(maxRms<1e-7||reference<1e-10)throw Error('No audible voice-range content was found in this audio.');
 const project:Project={format:'mml-studio',version:2,name:name.replace(/\.[^.]+$/,''),grid:128,
  instruments:[{name:'Voice approximation',color:'#35C0E8',midiProgram:73},{name:'Instructions',color:INSTRUCTIONS_COLOR,isInstructions:true}],notes:[]};
 // T250 ×4: 1 model unit = 1.875 ms; 16 units = exactly 30 ms.
 let id=1;const endTick=LEAD_IN+Math.max(1,Math.round(samples.length/RATE/0.001875));
 project.notes.push({id:id++,instrument:1,start:0,length:1,pitch:60,volume:0,tempo:240});
 project.notes.push({id:id++,instrument:1,start:LEAD_IN,length:1,pitch:60,volume:0,tempo:250,speedEntry:true,speedMultiplier:4});
 const VOICES=frames.reduce((max,frame)=>Math.max(max,frame.peaks.length),0);
 const previous:(Note|undefined)[]=Array(VOICES).fill(undefined);
 for(let frame=0;frame<frames.length;frame++){
  const start=LEAD_IN+frame*TICKS,length=Math.min(TICKS,endTick-start);if(length<=0)break;
  const data=frames[frame];
  const candidates=data.rms<Math.max(1e-7,maxRms*0.01)?[]:data.peaks.map(p=>{
   // One reference for the whole clip, never per-frame normalization. Quiet syllables stay quiet.
   const db=20*Math.log10(p.amplitude/reference),volume=db<=-40?0:Math.max(1,Math.min(15,Math.round(15*(db+40)/40)));
   return {...p,volume};
  }).filter(p=>p.volume>0);
  const assigned=new Map<number,typeof candidates[number]>(),used=new Set<number>();
  // Match nearest pitches first to retain tracks through magnitude-order changes.
  const pairs=previous.flatMap((note,voice)=>note?candidates.map((p,index)=>({voice,index,distance:Math.abs(note.pitch-p.pitch)})):[]).sort((a,b)=>a.distance-b.distance);
  for(const pair of pairs)if(pair.distance<=12&&!assigned.has(pair.voice)&&!used.has(pair.index)){assigned.set(pair.voice,candidates[pair.index]);used.add(pair.index);}
  for(let index=0;index<candidates.length;index++)if(!used.has(index)){
   const voice=Array.from({length:VOICES},(_,i)=>i).find(i=>!assigned.has(i))!;assigned.set(voice,candidates[index]);
  }
  for(let voice=0;voice<VOICES;voice++){
   const candidate=assigned.get(voice),last=previous[voice];
   if(!candidate){previous[voice]=undefined;continue;}
   if(last&&last.start+last.length===start&&last.pitch===candidate.pitch&&last.volume===candidate.volume)last.length+=length;
   else{const note:Note={id:id++,instrument:0,start,length,pitch:candidate.pitch,volume:candidate.volume};project.notes.push(note);previous[voice]=note;}
  }
 }
 if(project.notes.length===2)throw Error('No usable voice frequencies were found in this audio.');
 // The game's reported duration sums channel endpoints, including leading rests.
 // A final V0 note reuses the earliest-free channel without adding a sixth voice.
 const channelEnds=partitionChannels(project.notes.filter(n=>n.instrument===0)).map(lane=>lane.at(-1)!.start+lane.at(-1)!.length);
 const musicalEnd=Math.max(...channelEnds),totalSeconds=channelEnds.reduce((sum,end)=>sum+1+(end-LEAD_IN)*0.001875,0),deficit=Math.max(0,Math.ceil((MIN_CHANNEL_SECONDS-totalSeconds)/0.001875-1e-9));
 const performanceEnd=Math.max(endTick,deficit?Math.max(musicalEnd+1,Math.min(...channelEnds)+deficit):musicalEnd);
 if(musicalEnd<performanceEnd)project.notes.push({id:id++,instrument:0,start:musicalEnd,length:performanceEnd-musicalEnd,pitch:60,volume:0});
 const noteCount=project.notes.length-2;
 project.notes.push({id:id++,instrument:1,start:performanceEnd,length:1,pitch:60,volume:0,speedExit:true});
 const result=generateMml(project,0);
 const warnings=[`Voice approximation: up to ${voices} simultaneous tones, ${sampling.intervalMs} ms analysis steps, Flute preset, explicit V1–V15 loudness. Stable pitch/velocity samples are merged.`,
  `Timing: one second of opening silence at T240, then T250 with ×4 Speed Multiplier; ${((endTick-LEAD_IN)*0.001875).toFixed(3)} seconds of source audio. Final source duration rounded by at most 0.938 ms.`,
  `One channel carries any required rest tail to reach about 20 seconds summed across channels. Actual playback lasts ${(1+(performanceEnd-LEAD_IN)*0.001875).toFixed(3)} seconds.`,
  `Generated MML: ${result.bytes.toLocaleString('en-US')} characters across ${result.channels.length} channels (${budget.toLocaleString('en-US')}-character budget).${result.bytes>budget?' This exceeds one sheet; use the existing split export or shorten the source clip.':''}`,
  'This is an experimental pitched approximation: consonants, noise and the original voice timbre are not reproduced faithfully. Changing the instrument changes the result.'];
 return {project,noteCount,warnings};
}
