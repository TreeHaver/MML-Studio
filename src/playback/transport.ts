import {$,status} from '../dom.ts';
import {state,isMuted} from '../state.ts';
import {draw} from '../painting.ts';
import {compilePlayback,heldPlaybackNotes} from './midi.ts';
import {tickAtSeconds,tempoAt,secondsAtTick,tempoMap} from '../music/tempo.ts';
import {volumeAt} from '../music/volume.ts';
import {getEngine,setMasterVolume} from './engine.ts';
import {followPlayback} from '../viewport.ts';
import {loopRegion,looping} from './loop-region.ts';
import {expandLoops} from '../music/loops.ts';
let position:number|null=null;
export const playback={get tick():number|null{return position===null?null:phase==='idle'||!plan?position:plan.sourceTick(position);},set tick(value:number|null){position=value;}};
export const playbackSettings={speed:1,volume:1};
let phase:'idle'|'loading'|'playing'|'paused'='idle',engine:any=null,plan:any=null;
let snapshot:any=null,frame=0,generation=0,voiceRevision=0,loadedVoiceRevision=0;
let observedNotes=state.project.notes,observedCount=observedNotes.length;
/**
 * The loop cannot ride on the animation frame. Chromium stops painting a window that is
 * behind another application, so the frame callback stops with it while the audio thread
 * plays straight on - which is why the whole song went past the loop as soon as the editor
 * lost focus. This timer reads the sequencer's own clock instead, and keeps the loop honest
 * whether or not anything is being drawn.
 */
let rewinding=false;
/**
 * Taking the loop back to its start. A sequencer that has reached the end of the song is
 * finished for good: putting its clock back is not enough, it has to be told to play again,
 * or the position freezes at the start with the last notes still held down - which is the
 * crackle that was reported when a loop reached past the end of the music.
 */
async function rewindLoop(){
 if(rewinding||!engine||!plan)return;
 rewinding=true;
 try{
  const finished=engine.seq.isFinished;
  seekToTick(loopRegion.start);
  if(!finished)return;
  const token=generation;
  await engine.play();
  if(token!==generation||phase!=='playing')return;
  seekToTick(loopRegion.start);restoreHeld();
 }finally{rewinding=false;}
}
function loopGuard(){
 if(phase!=='playing'||!looping()||!engine||!plan)return;
 const heard=plan.sourceTick(tickAtSeconds(plan.map,Math.max(0,engine.seq.currentHighResolutionTime)));
 if(heard>=loopRegion.end||engine.seq.isFinished)void rewindLoop();
}
// Serialize live edits through the existing engine load. Restore held voices
// from the latest notes, including edits received while a load is in flight.
async function loadSnapshot(token:number){
 engine=await getEngine();
 while(token===generation){
  const revision=voiceRevision,from=position??0;
  const source=plan?.sourceTick(from)??from,notes=state.project.notes,count=notes.length;
  observedNotes=notes;observedCount=count;snapshot=structuredClone(state.project);
  const range=state.segment?.projection.range;
  // A loop drawn past the end of the music still has to be played to its end, so the
  // performance is compiled at least that long; without it the song simply stops early.
  const next=compilePlayback(snapshot,Math.max(range?range.end-range.start:0,looping()?loopRegion.end:0));
  await engine.load(next.binary);if(token!==generation)return false;
  if(revision!==voiceRevision||from!==(position??0)||notes!==state.project.notes||count!==state.project.notes.length)continue;
  // Retain the current repeat when its source mapping survives an edit. If
  // loop structure changed, seek the same source position in the new plan.
  position=Math.min(next.end,plan&&next.sourceTick(from)===source?from:next.performanceTick(source));
  plan=next;engine.seq.playbackRate=playbackSettings.speed;engine.seq.currentTime=Math.min(plan.duration,secondsAtTick(plan.map,position??0));
  loadedVoiceRevision=revision;updatePlaybackMutes(true);return true;
 }
 return false;
}
async function preparePlayback(token:number,resume:boolean){
 do{
  if(!await loadSnapshot(token))return false;
  if(!resume)return true;
  await engine.play();if(token!==generation){engine.stop();return false;}
  if(loadedVoiceRevision!==voiceRevision){engine.pause();continue;}
  // Set again after unpausing: the sequencer's paused seek may advance to the
  // next MIDI event. Playing seeks preserve leading rests and held-note time.
  engine.seq.currentTime=Math.min(plan.duration,secondsAtTick(plan.map,position??0));
  restoreHeld();return true;
 }while(token===generation);
 return false;
}
export async function updatePlaybackVoices(){
 voiceRevision++;
 if(phase!=='playing'&&phase!=='paused')return;
 const resume=phase==='playing',token=++generation;
 if(resume)position=tickAtSeconds(plan.map,Math.max(0,engine.seq.currentHighResolutionTime));
 cancelAnimationFrame(frame);engine.pause();phase='loading';buttons();
 try{
  if(!await preparePlayback(token,resume))return;
  phase=resume?'playing':'paused';buttons();if(resume)animate();else draw();
 }catch(error){phase='idle';position=null;engine?.stop();status('Playback update failed: '+error);}
 finally{if(token!==generation||phase==='loading')phase='idle';buttons();}
}
export function updatePlaybackMutes(ready=false){if(phase==='loading'&&!ready)return;if(engine&&plan)for(const item of plan.channels){engine.mute(item.channel,isMuted(item.instrument));engine.gain(item.channel,(state.project.instruments[item.instrument]?.volume??100)/100);}}
const playable=()=>state.project.notes.some(n=>!state.project.instruments[n.instrument]?.isInstructions&&n.pitch>=0&&n.pitch<=127&&volumeAt(state.project,n)>0);
function restoreHeld(){engine.restoreNotes(heldPlaybackNotes(plan.project,plan.channels,position??0));}
function buttons(){
 const canPlay=playable();const play=$('play') as HTMLButtonElement;const playing=phase==='playing';
 play.classList.toggle('is-playing',playing);
 play.disabled=phase==='loading'||(!playing&&!canPlay);
 play.title=playing?'Pause':phase==='paused'?'Resume':'Play';play.setAttribute('aria-label',play.title);
 ($('stop') as HTMLButtonElement).disabled=phase==='idle';
 ($('clear-all') as HTMLButtonElement).disabled=!state.project.notes.length;
 for(const id of ['start','rewind','forward'])($(id) as HTMLButtonElement).disabled=phase==='idle'||phase==='loading';

}
let clockNotes:typeof state.project.notes|undefined,clockCount=-1,clockRoles='',clockEnd=-1;
let clock:ReturnType<typeof expandLoops>|undefined,clockMap:ReturnType<typeof tempoMap>=[];
function currentClock(){
 const range=state.segment?.projection.range,end=Math.max(range?range.end-range.start:0,looping()?loopRegion.end:0);
 const notes=state.project.notes,roles=state.project.instruments.map(i=>i.isInstructions?'1':'0').join('');
 if(clockNotes!==notes||clockCount!==notes.length||clockRoles!==roles||clockEnd!==end){
  clock=expandLoops(state.project,end);clockMap=tempoMap(clock.project.notes);
  clockNotes=notes;clockCount=notes.length;clockRoles=roles;clockEnd=end;
 }
 return {map:clockMap,end:clock!.end,performanceTick:clock!.performanceTick};
}
function clockText(seconds:number){
 const total=Math.floor(Math.max(0,seconds)+1e-9),minutes=Math.floor(total/60),remainder=String(total%60).padStart(2,'0');
 return minutes>=60?`${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,'0')}:${remainder}`:`${minutes}:${remainder}`;
}
function positionLabel(){
 const tick=position??0,project=phase==='idle'?state.project:plan?.project??snapshot??state.project;
 const bpm=tempoAt(project.notes,tick),effective=bpm*playbackSettings.speed;
 $('playback-bpm').textContent=`${bpm} BPM`;
 const running=(phase==='playing'||phase==='paused')&&plan,timing=running?plan:currentClock();
 const total=secondsAtTick(timing.map,timing.end)/playbackSettings.speed;
 const elapsed=secondsAtTick(timing.map,running?tick:timing.performanceTick(Math.min(tick,timing.end)))/playbackSettings.speed;
 $('playback-time').textContent=`${clockText(Math.min(elapsed,total))} / ${clockText(total)} · `;
 const label=$('effective-bpm'),outOfBounds=effective<32||effective>255;
 // The effective figure only matters when the speed slider has moved, but a tempo the game
 // cannot play matters at any speed: at 1x the warning is shown on its own, beside the BPM.
 label.hidden=playbackSettings.speed===1&&!outOfBounds;
 // Reads as part of the line, not a footnote: whole numbers, same size, same baseline.
 label.textContent=playbackSettings.speed===1
  ?' (out of bounds!)'
  :` · ${Math.round(effective)} effective${outOfBounds?' (out of bounds!)':''}`;
 label.classList.toggle('out-of-bounds',outOfBounds);
}
export function syncPlaybackControls(){
 // Pointer drawing can append in place; move/resize, commands and history
 // replace the array. Avoid scanning the song on every animation frame.
 if(observedNotes!==state.project.notes||observedCount!==state.project.notes.length){
  observedNotes=state.project.notes;observedCount=observedNotes.length;
  if(phase!=='idle')void updatePlaybackVoices();
 }
 buttons();positionLabel();
}
function setPosition(seconds:number){if(!engine||!plan)return;const time=Math.max(0,Math.min(plan.duration,seconds));engine.seq.currentTime=time;position=tickAtSeconds(plan.map,time);if(phase==='playing')restoreHeld();followPlayback(playback.tick!);draw();}
// Idle seeks park the playhead so the next play() starts from there.
export function seekToTick(tick:number){
 const range=state.segment?.projection.range,target=Math.max(0,Math.min(tick,range?range.end-range.start:Infinity));
 if(engine&&plan&&(phase==='playing'||phase==='paused')){setPosition(secondsAtTick(plan.map,plan.performanceTick(target)));return;}
 position=target;draw();
}
function animate(){
 if(phase!=='playing')return;
 const time=engine.seq.currentHighResolutionTime;
 position=Math.min(plan.end,tickAtSeconds(plan.map,Math.max(0,time)));
 // The rehearsal loop is measured in the ticks the user sees, so it is checked here
 // rather than in the compiled performance, and simply seeks back when it runs past.
 if(looping()&&playback.tick!==null&&playback.tick>=loopRegion.end){void rewindLoop();frame=requestAnimationFrame(animate);return;}
 followPlayback(playback.tick!);
 draw();
 if(engine.seq.isFinished){if(looping()){void rewindLoop();frame=requestAnimationFrame(animate);return;}stopPlayback(false);return;}
 frame=requestAnimationFrame(animate);
}
export function stopPlayback(message=true){
 generation++;cancelAnimationFrame(frame);engine?.stop();position=null;
 // Retain the loading lock until an in-flight initialization completes.
 if(phase!=='loading')phase='idle';buttons();draw();
 if(message)status('Playback stopped.');
}
export async function play(){
 if(phase==='loading'||phase==='playing')return;
 if(phase==='paused'){const token=generation,time=secondsAtTick(plan.map,position??0);updatePlaybackMutes(true);await engine.play();if(token!==generation){engine.stop();return;}phase='playing';setPosition(time);buttons();animate();return;}
 if(!playable()){status('Draw a playable note before playing.');return;}
 const section=($('section-nav') as HTMLSelectElement).value;
 if(position===null&&section!=='')position=Number(section);
 // Starting outside the loop would play on and never come round, so it starts inside it.
 if(looping()&&(position===null||position<loopRegion.start||position>=loopRegion.end))position=loopRegion.start;
 const token=++generation;phase='loading';buttons();status('Preparing General MIDI playback…');
 try{
  snapshot=structuredClone(state.project);plan=null;
  if(!await preparePlayback(token,true))return;
  phase='playing';buttons();
  status('Playing unmuted instruments. '+plan.warnings.join(' ')+(plan.skipped?` ${plan.skipped} notes outside MIDI pitches 0–127 are silent.`:''));animate();
 }catch(error){phase='idle';position=null;engine?.stop();status('Playback failed: '+error);}
 finally{if(token!==generation||phase==='loading')phase='idle';buttons();}
}
export function installPlayback(){
 const speed=$('playback-speed') as HTMLInputElement,volume=$('playback-volume') as HTMLInputElement;
 let draggingSpeed=false;
 speed.value='100';volume.value='100';
 speed.onpointerdown=()=>{draggingSpeed=true;};speed.onpointerup=()=>{draggingSpeed=false;};speed.onpointercancel=()=>{draggingSpeed=false;};speed.onkeydown=()=>{draggingSpeed=false;};
 speed.oninput=()=>{
  let percent=Math.max(25,Math.min(400,Number(speed.value)||100));
  if(draggingSpeed)for(const snap of [50,200])if(Math.abs(percent-snap)<=3)percent=snap;
  speed.value=String(percent);playbackSettings.speed=percent/100;
  $('playback-speed-value').textContent=`${percent}% (${percent/100}x)`;
  if(engine)engine.seq.playbackRate=playbackSettings.speed;
  positionLabel();
 };
 volume.oninput=()=>{const percent=Math.max(0,Math.min(100,Number(volume.value)||0));volume.value=String(percent);playbackSettings.volume=percent/100;$('playback-volume-value').textContent=`${percent}%`;setMasterVolume(playbackSettings.volume);};
 $('play').onclick=()=>{if(phase==='playing'){position=tickAtSeconds(plan.map,Math.max(0,engine.seq.currentHighResolutionTime));engine.pause();phase='paused';cancelAnimationFrame(frame);buttons();status('Playback paused.');}else void play();};
 $('stop').onclick=()=>stopPlayback();buttons();
 // 40ms is far below the shortest loop worth rehearsing and costs nothing while idle.
 setInterval(loopGuard,40);
 $('start').onclick=()=>setPosition(0);
 $('rewind').onclick=()=>setPosition((engine?.seq.currentHighResolutionTime??0)-5);
 $('forward').onclick=()=>setPosition((engine?.seq.currentHighResolutionTime??0)+5);
}
