import {samplePitch,tuningControllers,tuningWheel,overridePrograms,usesBundledSamples} from './sample-pitch.ts';
// Independent lazy synths keep keyboard previews from changing song channels.
let masterVolume=1;
let bankId='TimGM6mb.sf2',changingBank=false;
let prepared:Awaited<ReturnType<typeof createSynth>>|null=null;
export const activeSoundBank=()=>bankId;
/** Prepare the new bank before retiring either live engine. Failed loads retain the old bank. */
export async function changeSoundBank(id:string){
 if(changingBank)throw Error('A sound bank is already loading.');
 if(id===bankId)return;
 changingBank=true;
 try{
  const next=await createSynth(id);
  const old=await Promise.allSettled([instance,previewInstance]);
  for(const result of old)if(result.status==='fulfilled')await result.value?.dispose();
  await prepared?.dispose();prepared=next;
  instance=null;previewInstance=null;bankId=id;
 }finally{changingBank=false;}
}
const outputs=new Set<GainNode>();
export function setMasterVolume(value:number){
 masterVolume=Math.max(0,Math.min(1,value));
 for(const output of outputs)output.gain.setTargetAtTime(masterVolume,output.context.currentTime,.015);
}
async function loadBank(synth:any,bytes:Uint8Array,id:string){
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  await new Promise<void>((resolve,reject)=>{
   // The wrapper emits parse errors as events without rejecting addSoundBank's promise.
   synth.eventHandler?.addEvent('soundBankError','studio-bank',reject);
   timer=setTimeout(()=>reject(Error('Sound bank loading timed out.')),30000);
   synth.soundBankManager.addSoundBank(new Uint8Array(bytes).buffer,id).then(resolve,reject);
  });
 }finally{clearTimeout(timer);synth.eventHandler?.removeEvent('soundBankError','studio-bank');}
}
async function createSynth(id=bankId){
 const lib=await import('../../vendor/synth.js');
 const context=new AudioContext({sampleRate:44100});
 try{
  await context.resume();
  await context.audioWorklet.addModule(new URL('../../vendor/spessasynth_processor.min.js',import.meta.url));
  const synth=new lib.WorkletSynthesizer(context);
  const output=context.createGain();output.gain.value=masterVolume;
  synth.connect(output);output.connect(context.destination);
  const bytes=await (window as any).files.soundBank(id);
  await loadBank(synth,id==='maplebeats-2.dls'?new Uint8Array(lib.prepareSoundBank(new Uint8Array(bytes),id)):bytes,'Selected');
  const customPrograms=id==='TimGM6mb.sf2'?[]:overridePrograms(synth.presetList??[]);
  if(id!=='TimGM6mb.sf2'){
   const fallback=await (window as any).files.soundBank('TimGM6mb.sf2');
   await loadBank(synth,fallback,'General MIDI');
   synth.soundBankManager.priorityOrder=['Selected','General MIDI'];
  }
  await synth.isReady;
  output.gain.value=masterVolume;outputs.add(output);
  return {lib,context,synth,customPrograms,dispose:async()=>{outputs.delete(output);synth.stopAll(true);await context.close();}};
 }catch(error){await context.close();throw error;}
}
let previewInstance:Promise<any>|null=null;
export function getPreviewEngine():Promise<any>{
 if(changingBank)return Promise.reject(Error('Sound bank is loading. Try again when it is ready.'));
 if(previewInstance)return previewInstance;
 previewInstance=(async()=>{
  try{
   const {context,synth,dispose,customPrograms}=await createSynth();
   let timer:ReturnType<typeof setTimeout>|undefined;
   let generation=0;

   return {context,dispose:async()=>{generation++;clearTimeout(timer);await dispose();},
    async preview(pitch:number,program:number,isDrum=false,volume=100){
     const token=++generation;
     await context.resume();if(token!==generation)return;
     clearTimeout(timer);synth.stopAll(false);
     const channel=isDrum?9:0;
     const sample=samplePitch(pitch,program,isDrum,usesBundledSamples(program,customPrograms)),sourcePitch=sample.pitch;
     for(const [cc,value] of tuningControllers())synth.controllerChange(channel,cc,value);
     synth.pitchWheel(channel,tuningWheel(sample.tuning));
     synth.midiChannels[channel].setSystemParameter('gain',volume/100);
     synth.programChange(channel,isDrum?0:program);synth.noteOn(channel,sourcePitch,100);
     timer=setTimeout(()=>synth.noteOff(channel,sourcePitch),500);
    }
   };
  }catch(error){previewInstance=null;throw error;}
 })();return previewInstance;
}
let instance:Promise<any>|null=null;
export function getEngine():Promise<any>{
 if(changingBank)return Promise.reject(Error('Sound bank is loading. Try again when it is ready.'));
 if(instance)return instance;
 instance=(async()=>{
  let context:AudioContext|undefined;
  try{
   const ready=prepared??await createSynth();prepared=null;context=ready.context;
   const {lib,synth}=ready;
   const seq=new lib.Sequencer(synth,{skipToFirstNoteOn:false});seq.loopCount=0;
   return {
    seq,context,customPrograms:ready.customPrograms,dispose:async()=>{seq.pause();await ready.dispose();},
    restoreNotes(notes:{channel:number,pitch:number,velocity:number,tuning?:number}[]){for(const n of notes){for(const [cc,value] of tuningControllers())synth.controllerChange(n.channel,cc,value);synth.pitchWheel(n.channel,tuningWheel(n.tuning??0));synth.noteOn(n.channel,n.pitch,n.velocity);}},
    gain(channel:number,value:number){synth.midiChannels[channel].setSystemParameter('gain',value);},
    mute(channel:number,muted:boolean){synth.midiChannels[channel].setSystemParameter('isMuted',muted);},
    async load(binary:ArrayBuffer){
     seq.pause();synth.stopAll(true);
     await new Promise<void>((resolve,reject)=>{
      const id='studio-load';let timer:any;
      const done=(error?:unknown)=>{clearTimeout(timer);seq.eventHandler.removeEvent('songChange',id);seq.eventHandler.removeEvent('midiError',id);error?reject(error):resolve();};
      seq.eventHandler.addEvent('songChange',id,()=>done());
      seq.eventHandler.addEvent('midiError',id,(error:unknown)=>done(error));
      timer=setTimeout(()=>done(Error('SoundFont playback did not become ready.')),20000);
      seq.loadNewSongList([{binary,fileName:'MML Studio preview'}]);
     });
     seq.pause();
    },
    async play(){await context.resume();seq.play();},
    pause(){seq.pause();synth.stopAll(true);},
    stop(){seq.pause();seq.currentTime=0;synth.stopAll(true);}
   };
  }catch(error){await context?.close();instance=null;throw error;}
 })();return instance;
}
