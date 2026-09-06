// Independent lazy synths keep keyboard previews from changing song channels.
async function createSynth(){
 const lib=await import('../../vendor/synth.js');
 const context=new AudioContext({sampleRate:44100});
 try{
  await context.resume();
  await context.audioWorklet.addModule(new URL('../../vendor/spessasynth_processor.min.js',import.meta.url));
  const synth=new lib.WorkletSynthesizer(context);
  synth.connect(context.destination);
  const bytes=await (window as any).files.soundBank();
  await synth.soundBankManager.addSoundBank(new Uint8Array(bytes).buffer,'General MIDI');
  await synth.isReady;
  return {lib,context,synth};
 }catch(error){await context.close();throw error;}
}
let previewInstance:Promise<any>|null=null;
export function getPreviewEngine():Promise<any>{
 if(previewInstance)return previewInstance;
 previewInstance=(async()=>{
  try{
   const {context,synth}=await createSynth();
   let timer:ReturnType<typeof setTimeout>|undefined;
   let generation=0;
   return {context,
    async preview(pitch:number,program:number,isDrum=false){
     const token=++generation;
     await context.resume();if(token!==generation)return;
     clearTimeout(timer);synth.stopAll(true);
     const channel=isDrum?9:0;
     synth.programChange(channel,isDrum?0:program);synth.noteOn(channel,pitch,100);
     timer=setTimeout(()=>synth.noteOff(channel,pitch),500);
    }
   };
  }catch(error){previewInstance=null;throw error;}
 })();return previewInstance;
}
let instance:Promise<any>|null=null;
export function getEngine():Promise<any>{
 if(instance)return instance;
 instance=(async()=>{
  let context:AudioContext|undefined;
  try{
   const ready=await createSynth();context=ready.context;
   const {lib,synth}=ready;
   const seq=new lib.Sequencer(synth,{skipToFirstNoteOn:false});seq.loopCount=0;
   return {
    seq,context,
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
    },
    async play(){await context.resume();seq.play();},
    pause(){seq.pause();synth.stopAll(true);},
    stop(){seq.pause();seq.currentTime=0;synth.stopAll(true);}
   };
  }catch(error){await context?.close();instance=null;throw error;}
 })();return instance;
}
