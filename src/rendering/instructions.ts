import {ctx,view} from '../dom.ts';
import {state,isMuted} from '../state.ts';
import {KEY,HEAD} from '../constants.ts';
import {tempoChanges} from '../music/tempo.ts';
import {speedRegions} from '../music/speed.ts';
import {loopRegions} from '../music/loops.ts';
import {INSTRUCTIONS_COLOR} from '../model/instructions.ts';
import {palette} from '../appearance.ts';
import type {Note} from '../model/types.ts';

export function drawLoopRegions(){
 const paint=(loops:ReturnType<typeof loopRegions>['roots'])=>{for(const loop of loops){
  if(!isMuted(loop.instrument)){ctx.globalAlpha=.1;ctx.fillStyle=state.project.instruments[loop.instrument].color;ctx.fillRect(KEY+loop.start*state.zoom-view.scrollLeft,HEAD,(loop.end-loop.start)*state.zoom,state.height-HEAD);}
  paint(loop.children);
 }};
 paint(loopRegions(state.project).roots);
 for(const r of speedRegions(state.project.notes).regions){const end=Number.isFinite(r.end)?r.end:(view.scrollLeft+state.width)/state.zoom;
  ctx.globalAlpha=.08;ctx.fillStyle=state.project.instruments[r.instrument].color;ctx.fillRect(KEY+r.start*state.zoom-view.scrollLeft,HEAD,(end-r.start)*state.zoom,state.height-HEAD);
 }ctx.globalAlpha=1;
}
export function drawInstructionLines(){
 for(const n of state.project.notes)if(state.project.instruments[n.instrument]?.isInstructions&&!isMuted(n.instrument)){
  const x=KEY+n.start*state.zoom-view.scrollLeft;if(x+15<KEY||x>state.width)continue;
  ctx.fillStyle=state.project.instruments[n.instrument].color;ctx.globalAlpha=n.instrument===state.active ? .55 : .3;ctx.fillRect(x,HEAD,15,state.height-HEAD);ctx.globalAlpha=1;
  if(state.selection.has(n.id)){ctx.strokeStyle='#67b7ff';ctx.lineWidth=2;ctx.strokeRect(x+1,HEAD+1,13,state.height-HEAD-2);}
 }
 const visible=new Set(state.project.notes.filter(n=>!state.project.instruments[n.instrument]?.isInstructions&&n.tempo!=null&&!isMuted(n.instrument)).map(n=>`${n.start}:${n.tempo}`));
 ctx.fillStyle=INSTRUCTIONS_COLOR;
 for(const t of tempoChanges(state.project.notes))if(visible.has(`${t.tick}:${t.bpm}`))ctx.fillRect(KEY+t.tick*state.zoom-view.scrollLeft,HEAD,2,state.height-HEAD);
}
function captions(){
 const entries:{note:Note,text:string,color:string}[]=[];
 for(const n of state.project.notes){if(isMuted(n.instrument))continue;const instrument=state.project.instruments[n.instrument];
  if(instrument.isInstructions)entries.push({note:n,color:instrument.color,text:[n.section?.trim(),n.timeSignature,n.resetMeasures&&n.section?.trim()?'Measure 1':'',n.tempo==null?'':`T${n.tempo}`,n.speedEntry?`Multiplier ×${n.speedMultiplier??2}`:'',n.speedExit?'Multiplier Exit':'',n.loopEntry?`Loop Entry ×${n.loopCount??1}`:'',n.loopExit?`Loop Exit${n.loopTie?' · Tie':''}`:''].filter(Boolean).join(' · ')||'Event'});
  else if(n.tempo!=null)entries.push({note:n,color:INSTRUCTIONS_COLOR,text:`T${n.tempo}`});
 }
 const rowEnds:number[]=[],result:{note:Note,text:string,color:string,x:number,y:number,w:number,h:number}[]=[];
 ctx.font='11px Segoe UI';
 for(const entry of entries.sort((a,b)=>a.note.start-b.note.start||a.note.id-b.note.id)){
  const x=KEY+entry.note.start*state.zoom-view.scrollLeft;if(x<KEY||x>=state.width-12)continue;
  let text=entry.text;const maxWidth=Math.min(320,state.width-x-8);
  if(ctx.measureText(text).width+12>maxWidth){while(text.length&&ctx.measureText(text+'…').width+12>maxWidth)text=text.slice(0,-1);text+='…';}
  const w=Math.min(maxWidth,ctx.measureText(text).width+12);let row=rowEnds.findIndex(end=>end<x);if(row<0)row=rowEnds.length;rowEnds[row]=x+w+8;
  result.push({...entry,text,x:x+3,y:HEAD+4+row*24,w,h:20});
 }
 return result;
}
export function instructionCaptionHit(p:{x:number,y:number}){return captions().findLast(c=>state.project.instruments[c.note.instrument]?.isInstructions&&p.x>=c.x&&p.x<=c.x+c.w&&p.y>=c.y&&p.y<=c.y+c.h)?.note;}
export function instructionLineHit(p:{x:number,y:number}){return p.y>=HEAD&&p.y<=state.height&&p.x>=KEY?[...state.project.notes].reverse().find(n=>{const x=KEY+n.start*state.zoom-view.scrollLeft;return state.project.instruments[n.instrument]?.isInstructions&&!isMuted(n.instrument)&&p.x>=x&&p.x<=x+15;}):undefined;}
export function drawTempoMarkers(){
 ctx.save();ctx.beginPath();ctx.rect(KEY,HEAD,state.width-KEY,state.height-HEAD);ctx.clip();ctx.textBaseline='middle';
 for(const c of captions()){ctx.fillStyle=palette.ruler;ctx.fillRect(c.x,c.y,c.w,c.h);ctx.strokeStyle=c.color;ctx.lineWidth=1;ctx.strokeRect(c.x+.5,c.y+.5,c.w-1,c.h-1);ctx.fillStyle=palette.text;ctx.fillText(c.text,c.x+6,c.y+10);}
 ctx.restore();
}
