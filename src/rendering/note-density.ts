import {ctx,view} from '../dom.ts';
import {state} from '../state.ts';
import {KEY,HEAD} from '../constants.ts';
import {crowdedRegions} from '../music/note-density.ts';
let previous:typeof state.project.notes|undefined,count=-1,active=-1,regions:ReturnType<typeof crowdedRegions>=[];
export function drawCrowdedRegions(){
 if(state.project.instruments[state.active]?.isInstructions)return;
 if(previous!==state.project.notes||count!==state.project.notes.length||active!==state.active){
  previous=state.project.notes;count=previous.length;active=state.active;
  regions=crowdedRegions(previous.filter(n=>n.instrument===active));
 }
 ctx.save();ctx.fillStyle='#ffd60026';ctx.strokeStyle='#e6b800';ctx.lineWidth=2;
 for(const region of regions){
  const left=KEY+region.start*state.zoom-view.scrollLeft,right=KEY+region.end*state.zoom-view.scrollLeft;
  if(right<=KEY||left>=state.width)continue;
  ctx.fillRect(left,HEAD,right-left,state.height-HEAD);
  ctx.strokeRect(left,HEAD+1,right-left,Math.max(0,state.height-HEAD-2));
 }
 ctx.restore();
}
