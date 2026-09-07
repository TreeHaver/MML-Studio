import {ctx,view} from '../dom.ts';
import {state,isMuted} from '../state.ts';
import {KEY,HEAD} from '../constants.ts';
import {tempoChanges} from '../music/tempo.ts';
import {INSTRUCTIONS_COLOR} from '../model/instructions.ts';
import {palette} from '../appearance.ts';

export function drawTempoMarkers(){
 ctx.save();ctx.beginPath();ctx.rect(KEY,HEAD,state.width-KEY,state.height-HEAD);ctx.clip();
 ctx.fillStyle=INSTRUCTIONS_COLOR;ctx.font='11px Segoe UI';ctx.textBaseline='middle';
 const labels=new Map<number,Set<string>>();
 const label=(tick:number,text:string)=>{const parts=labels.get(tick)??new Set<string>();parts.add(text);labels.set(tick,parts);};
 for(const n of state.project.notes)if(state.project.instruments[n.instrument].isInstructions&&!isMuted(n.instrument)){
  if(n.section?.trim())label(n.start,n.section.trim());
  if(n.timeSignature)label(n.start,n.timeSignature);
  if(n.section?.trim()&&n.resetMeasures)label(n.start,'Measure 1');
 }
 const visible=new Set(state.project.notes.filter(n=>n.tempo!=null&&!isMuted(n.instrument)).map(n=>`${n.start}:${n.tempo}`));
 for(const event of tempoChanges(state.project.notes)){
  if(!visible.has(`${event.tick}:${event.bpm}`))continue;
  const x=KEY+event.tick*state.zoom-view.scrollLeft;
  if(x<KEY||x>state.width)continue;
  ctx.fillRect(x,HEAD,2,state.height-HEAD);
  label(event.tick,`T${event.bpm}`);
 }
 // Floating captions stay below the ruler. Nearby captions use separate rows
 // instead of painting over each other or the measure numbers.
 const rowEnds:number[]=[];
 for(const [tick,parts] of [...labels].sort((a,b)=>a[0]-b[0])){
  const x=KEY+tick*state.zoom-view.scrollLeft;if(x<KEY||x>=state.width-12)continue;
  let text=[...parts].join(' · ');const maxWidth=Math.min(320,state.width-x-8);
  if(ctx.measureText(text).width+12>maxWidth){while(text.length&&ctx.measureText(text+'…').width+12>maxWidth)text=text.slice(0,-1);text+='…';}
  const width=Math.min(maxWidth,ctx.measureText(text).width+12);
  let row=rowEnds.findIndex(end=>end<x);if(row<0)row=rowEnds.length;rowEnds[row]=x+width+8;
  const y=HEAD+4+row*24;
  ctx.fillStyle=palette.ruler;ctx.fillRect(x+3,y,width,20);
  ctx.strokeStyle=INSTRUCTIONS_COLOR;ctx.lineWidth=1;ctx.strokeRect(x+3.5,y+.5,width-1,19);
  ctx.fillStyle=palette.text;ctx.fillText(text,x+9,y+10);
 }
 ctx.restore();
}
