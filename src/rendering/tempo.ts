import {ctx,view} from '../dom.ts';
import {state,isMuted} from '../state.ts';
import {KEY,HEAD} from '../constants.ts';
import {tempoChanges} from '../music/tempo.ts';
import {INSTRUCTIONS_COLOR} from '../model/instructions.ts';

export function drawTempoMarkers(){
 ctx.save();ctx.beginPath();ctx.rect(KEY,0,state.width-KEY,state.height);ctx.clip();
 ctx.fillStyle=INSTRUCTIONS_COLOR;ctx.font='10px Segoe UI';ctx.textBaseline='bottom';
 const visible=new Set(state.project.notes.filter(n=>n.tempo!=null&&!isMuted(n.instrument)).map(n=>`${n.start}:${n.tempo}`));
 for(const event of tempoChanges(state.project.notes)){
  if(!visible.has(`${event.tick}:${event.bpm}`))continue;
  const x=KEY+event.tick*state.zoom-view.scrollLeft;
  if(x<KEY||x>state.width)continue;
  ctx.fillRect(x,HEAD,2,state.height-HEAD);
  ctx.fillRect(x,HEAD-6,2,6);ctx.fillText(`T${event.bpm}`,x+4,HEAD-2);
 }
 ctx.restore();
}
