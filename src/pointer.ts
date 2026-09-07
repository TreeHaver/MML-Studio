import {anchor,point,musical,hit,edge,boxIds} from './geometry.ts';
import {layout} from './viewport.ts';
import {draw} from './painting.ts';
import {info} from './inspector.ts';
import {commitNotes} from './commands.ts';
import {canvas,status} from './dom.ts';
import {state,isMuted} from './state.ts';
import {KEY,HEAD,ROW,threshold} from './constants.ts';
import {cellStart} from './music/timing.ts';
import {valid} from './model/validation.ts';
import {move,resize} from './music/note-operations.ts';
import type {Note} from './model/types.ts';
import {previewNote} from './playback/preview.ts';
import {seekToTick} from './playback/transport.ts';
import {tempoAt} from './music/tempo.ts';
import {setPastePosition} from './note-clipboard.ts';

export function endGesture(cancel=false){if(!state.gesture)return;if(cancel&&state.gesture.before)state.project=JSON.parse(state.gesture.before);state.gesture=null;canvas.style.cursor='default';info();layout();}

export function installPointer(){
 const paint=(from:any,to:any)=>{const gesture=state.gesture,step=128/state.project.grid;if(!gesture||gesture.kind!=='paint')return;const a=Math.floor(Math.max(0,from.tick)/step),b=Math.floor(Math.max(0,to.tick)/step),count=Math.max(Math.abs(b-a),Math.abs(to.pitch-from.pitch));for(let i=1;i<=count;i++){const cell=Math.round(a+(b-a)*i/count),pitch=Math.round(from.pitch+(to.pitch-from.pitch)*i/count),start=cell*step,key=`${start}:${pitch}`;if(gesture.painted.has(key))continue;gesture.painted.add(key);const next:Note={id:state.project.notes.reduce((id,n)=>Math.max(id,n.id),0)+1,instrument:state.active,start,length:step,pitch,volume:null};if(valid([...state.project.notes,next])){state.project.notes.push(next);state.selection.add(next.id);}}};
 let keyGesture:{pointerId:number,pitch:number}|null=null;
 let scrubbing=false;
 let keyHighlightTimer:number|undefined;
 const previewKey=(p:any)=>{const instrument=state.project.instruments[state.active],pitch=musical(p).pitch;if(pitch<0||pitch>127)return;state.previewPitch=pitch;draw();if(keyHighlightTimer!==undefined)window.clearTimeout(keyHighlightTimer);keyHighlightTimer=window.setTimeout(()=>{if(state.previewPitch===pitch){state.previewPitch=null;draw();}},500);void previewNote(pitch,instrument.midiProgram??0,instrument.isDrum===true);return pitch;};
canvas.onpointerdown=e=>{
 if(e.button!==0&&e.button!==2)return;const p=point(e);
 if(p.y<HEAD){if(e.button===0&&p.x>=KEY){e.preventDefault();scrubbing=true;canvas.setPointerCapture(e.pointerId);seekToTick(musical(p).tick);}return;}
 if(p.x<KEY){
  if(e.button===0&&p.x>=0&&!isMuted(state.active)){e.preventDefault();canvas.focus();const instrument=state.project.instruments[state.active];if(instrument.isInstructions){status('Instructions are silent. Draw a marker in the roll and set its tempo.');return;}const pitch=previewKey(p);if(pitch===undefined)return;keyGesture={pointerId:e.pointerId,pitch};}
  return;
 }
 if(isMuted(state.active)){status('Unmute this instrument to edit its notes.');return;}e.preventDefault();canvas.focus();const n=hit(p);if(e.button===2){if(n)commitNotes(state.project.notes.filter(o=>o.id!==n.id));state.selection.delete(n?.id??-1);info();return;}
 const add=e.ctrlKey||e.metaKey;const before=JSON.stringify(state.project);const m=musical(p);
 if(e.shiftKey||(!n&&state.tool==='select'))state.gesture={kind:'box',start:p,current:p,music:m,add,before};
 else if(n){
  const already=state.selection.has(n.id);
  if(state.tool==='select'){
   if(add){if(already)state.selection.delete(n.id);else state.selection.add(n.id);info();draw();return;}
   if(!already)state.selection=new Set([n.id]);
   if(edge(n,p))state.gesture={kind:'resize',start:p,current:p,nid:n.id,base:structuredClone(state.project.notes),length:n.length,before};
   else state.gesture={kind:'move',start:p,current:p,base:structuredClone(state.project.notes),anchor:[...state.selection][0],before};
  }else {
  if(add){if(state.selection.has(n.id))state.selection.delete(n.id);else state.selection.add(n.id);info();draw();return;}
  if(!already){state.selection=new Set([n.id]);}
  if(edge(n,p))state.gesture={kind:'resize',start:p,current:p,nid:n.id,base:structuredClone(state.project.notes),length:n.length,before};
  else if(already)state.gesture={kind:'move',start:p,current:p,base:structuredClone(state.project.notes),anchor:[...state.selection][0],before};
  else state.gesture={kind:'click',start:p,current:p,before};
  }
 }else{const start=Math.max(0,cellStart(m.tick,state.project.grid)),instructions=state.project.instruments[state.active].isInstructions;const newNote:Note={id:state.project.notes.reduce((id,n)=>Math.max(id,n.id),0)+1,instrument:state.active,start,length:instructions?1:128/state.project.grid,pitch:m.pitch,volume:instructions?0:null,...(instructions?{tempo:tempoAt(state.project.notes,start)}:{})};
  if(!valid([...state.project.notes,newNote]))return;state.project.notes.push(newNote);state.selection=new Set([newNote.id]);const spray=state.tool==='spray'&&!instructions;
  state.gesture={kind:instructions?'instruction-create':spray?'paint':'resize',start:p,current:p,music:m,nid:newNote.id,before,
   ...(spray?{painted:new Set([`${start}:${m.pitch}`])}:{base:structuredClone(state.project.notes),length:newNote.length})};
 }
 canvas.setPointerCapture(e.pointerId);info();draw();
};
canvas.onpointermove=e=>{
 const p=point(e);if(scrubbing){seekToTick(musical(p).tick);return;}if(keyGesture){if(p.x>=0&&p.x<KEY&&p.y>=HEAD){const pitch=musical(p).pitch;if(pitch!==keyGesture.pitch&&pitch>=0&&pitch<=127){keyGesture.pitch=pitch;previewKey(p);}}return;}if(!state.gesture){if(p.y<HEAD){canvas.style.cursor=p.x>=KEY?'pointer':'default';return;}const n=p.x>=KEY?hit(p):undefined;canvas.style.cursor=n&&edge(n,p)?'ew-resize':'default';return;}
 state.gesture.current=p;const dx=p.x-state.gesture.start.x,dy=p.y-state.gesture.start.y;
 if(Math.hypot(dx,dy)<threshold&&!state.gesture.moved){draw();return;}state.gesture.moved=true;
 if(state.gesture.kind==='paint'){paint(state.gesture.music,musical(p));state.gesture.music=musical(p);}
 if(state.gesture.kind==='move')state.project.notes=move(state.gesture.base,state.selection,state.gesture.anchor,dx/state.zoom,state.project.instruments[state.active].isInstructions?0:Math.round(-dy/ROW),state.project.grid);
 if(state.gesture.kind==='resize')state.project.notes=resize(state.gesture.base,state.gesture.nid,state.gesture.length+dx/state.zoom,state.project.grid);
 info();draw();
};
canvas.onpointerup=e=>{if(scrubbing){scrubbing=false;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);return;}if(keyGesture){keyGesture=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);return;}if(!state.gesture)return;
 if(state.gesture.kind==='box'){const ids=boxIds(state.gesture.music,musical(state.gesture.current));state.selection=state.gesture.add?new Set([...state.selection,...ids]):new Set(ids);if(!state.gesture.moved)setPastePosition(Math.max(0,cellStart(state.gesture.music.tick,state.project.grid)));}
 if(JSON.stringify(state.project)!==state.gesture.before){state.history.push(state.gesture.before);state.future=[];state.dirty=true;}
 endGesture();if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
};
canvas.onpointercancel=()=>{keyGesture=null;scrubbing=false;endGesture(true);};canvas.onlostpointercapture=()=>{keyGesture=null;scrubbing=false;if(state.gesture)endGesture(true);};canvas.oncontextmenu=e=>e.preventDefault();


}
