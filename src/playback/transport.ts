import {$,status} from '../dom.ts';
import {state,isMuted} from '../state.ts';
import {draw} from '../painting.ts';
import {compilePlayback} from './midi.ts';
import {tickAtSeconds,tempoAt} from '../music/tempo.ts';
import {getEngine} from './engine.ts';
import {followPlayback} from '../viewport.ts';
export const playback={tick:null as number|null};
let phase:'idle'|'loading'|'playing'|'paused'='idle',engine:any=null,plan:any=null;
let snapshot:any=null,frame=0,generation=0;
export function updatePlaybackMutes(ready=false){if(phase==='loading'&&!ready)return;if(engine&&plan)for(const item of plan.channels)engine.mute(item.channel,isMuted(item.instrument));}
function buttons(){
 ($('play') as HTMLButtonElement).disabled=phase==='loading'||phase==='playing';
 $('play').textContent=phase==='paused'?'Resume':'Play';
 ($('pause') as HTMLButtonElement).disabled=phase!=='playing';
 ($('stop') as HTMLButtonElement).disabled=phase==='idle';
}
function animate(){
 if(phase!=='playing')return;
 const time=engine.seq.currentHighResolutionTime;
 playback.tick=Math.min(plan.end,tickAtSeconds(plan.map,Math.max(0,time)));
 followPlayback(playback.tick);
 $('playback-position').textContent=`${time.toFixed(1)} s · ${tempoAt(snapshot.notes,playback.tick)} BPM`;
 draw();
 if(engine.seq.isFinished){stopPlayback(false);return;}
 frame=requestAnimationFrame(animate);
}
export function stopPlayback(message=true){
 generation++;cancelAnimationFrame(frame);engine?.stop();playback.tick=null;
 // Retain the loading lock until an in-flight initialization completes.
 if(phase!=='loading')phase='idle';buttons();draw();
 if(message)status('Playback stopped.');
}
export async function play(){
 if(phase==='loading'||phase==='playing')return;
 if(phase==='paused'){updatePlaybackMutes(true);await engine.play();phase='playing';buttons();animate();return;}
 if(!state.project.notes.length){status('Draw some notes before playing.');return;}
 const token=++generation;phase='loading';buttons();status('Preparing General MIDI playback…');
 try{
  snapshot=structuredClone(state.project);plan=compilePlayback(snapshot);
  engine=await getEngine();if(token!==generation)return;
  await engine.load(plan.binary);if(token!==generation)return;
  updatePlaybackMutes(true);await engine.play();phase='playing';buttons();
  status('Playing unmuted instruments.'+(plan.skipped?` ${plan.skipped} notes outside MIDI pitches 0–127 are silent.`:''));animate();
 }catch(error){phase='idle';playback.tick=null;engine?.stop();status('Playback failed: '+error);}
 finally{if(token!==generation||phase==='loading')phase='idle';buttons();}
}
export function installPlayback(){
 $('play').onclick=()=>void play();
 $('pause').onclick=()=>{if(phase==='playing'){engine.pause();phase='paused';cancelAnimationFrame(frame);buttons();status('Playback paused.');}};
 $('stop').onclick=()=>stopPlayback();buttons();
}
