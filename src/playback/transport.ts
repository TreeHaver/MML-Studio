import {$,status} from '../dom.ts';
import {state,isMuted} from '../state.ts';
import {draw} from '../painting.ts';
import {compilePlayback} from './midi.ts';
import {tickAtSeconds,tempoAt,secondsAtTick} from '../music/tempo.ts';
import {volumeAt} from '../music/volume.ts';
import {getEngine} from './engine.ts';
import {followPlayback} from '../viewport.ts';
export const playback={tick:null as number|null};
let phase:'idle'|'loading'|'playing'|'paused'='idle',engine:any=null,plan:any=null;
let snapshot:any=null,frame=0,generation=0;
export function updatePlaybackMutes(ready=false){if(phase==='loading'&&!ready)return;if(engine&&plan)for(const item of plan.channels)engine.mute(item.channel,isMuted(item.instrument));}
const playable=()=>state.project.notes.some(n=>!state.project.instruments[n.instrument]?.isInstructions&&n.pitch>=0&&n.pitch<=127&&volumeAt(state.project,n)>0);
function buttons(){
 const canPlay=playable();const play=$('play') as HTMLButtonElement;const playing=phase==='playing';
 play.classList.toggle('is-playing',playing);
 play.disabled=phase==='loading'||(!playing&&!canPlay);
 play.title=playing?'Pause':phase==='paused'?'Resume':'Play';play.setAttribute('aria-label',play.title);
 ($('stop') as HTMLButtonElement).disabled=phase==='idle';
 ($('clear-all') as HTMLButtonElement).disabled=!state.project.notes.length;
 for(const id of ['start','rewind','forward'])($(id) as HTMLButtonElement).disabled=phase==='idle'||phase==='loading';
}
export function syncPlaybackControls(){buttons();}
function setPosition(seconds:number){if(!engine||!plan)return;const time=Math.max(0,Math.min(plan.duration,seconds));engine.seq.currentTime=time;playback.tick=tickAtSeconds(plan.map,time);followPlayback(playback.tick);$('playback-position').textContent=`${time.toFixed(1)} s · ${tempoAt(snapshot.notes,playback.tick)} BPM`;draw();}
// Idle seeks park the playhead so the next play() starts from there.
export function seekToTick(tick:number){
 const target=Math.max(0,tick);
 if(engine&&plan&&(phase==='playing'||phase==='paused')){setPosition(secondsAtTick(plan.map,target));return;}
 playback.tick=target;draw();
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
 if(!playable()){status('Draw a playable note before playing.');return;}
 const token=++generation;phase='loading';const from=playback.tick;buttons();status('Preparing General MIDI playback…');
 try{
  snapshot=structuredClone(state.project);plan=compilePlayback(snapshot);
  engine=await getEngine();if(token!==generation)return;
  await engine.load(plan.binary);if(token!==generation)return;
  updatePlaybackMutes(true);await engine.play();phase='playing';buttons();
  if(from!=null&&from>0)setPosition(secondsAtTick(plan.map,from));
  status('Playing unmuted instruments.'+(plan.skipped?` ${plan.skipped} notes outside MIDI pitches 0–127 are silent.`:''));animate();
 }catch(error){phase='idle';playback.tick=null;engine?.stop();status('Playback failed: '+error);}
 finally{if(token!==generation||phase==='loading')phase='idle';buttons();}
}
export function installPlayback(){
 $('play').onclick=()=>{if(phase==='playing'){engine.pause();phase='paused';cancelAnimationFrame(frame);buttons();status('Playback paused.');}else void play();};
 $('stop').onclick=()=>stopPlayback();buttons();
 $('start').onclick=()=>setPosition(0);
 $('rewind').onclick=()=>setPosition((engine?.seq.currentHighResolutionTime??0)-5);
 $('forward').onclick=()=>setPosition((engine?.seq.currentHighResolutionTime??0)+5);
}
