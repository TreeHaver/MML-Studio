import {ctx,view} from '../dom.ts';
import {state} from '../state.ts';
import {KEY,HEAD} from '../constants.ts';
import {crowdedRegions,overlapLocations} from '../music/note-density.ts';
let overlapNotes:typeof state.project.notes|undefined,overlapCount=-1,overlapActive=-1,overlapInstruments:typeof state.project.instruments|undefined,overlaps:ReturnType<typeof overlapLocations>=[];
/** Red onset lines use the same current-view/performance definition as MML. */
export function drawOverlapMarkers(){
 if(overlapNotes!==state.project.notes||overlapCount!==state.project.notes.length||overlapInstruments!==state.project.instruments||overlapActive!==state.active){
  overlapNotes=state.project.notes;overlapCount=overlapNotes.length;overlapInstruments=state.project.instruments;overlapActive=state.active;
  overlaps=overlapLocations(state.project,state.active);
 }
 ctx.save();ctx.beginPath();ctx.rect(KEY,HEAD,state.width-KEY,state.height-HEAD);ctx.clip();ctx.fillStyle='#e5484d';
 for(const start of new Set(overlaps.map(o=>o.start))){
  const x=KEY+start*state.zoom-view.scrollLeft;
  if(x>=KEY&&x<state.width)ctx.fillRect(x,HEAD,2,state.height-HEAD);
 }
 ctx.restore();
}
let previous:typeof state.project.notes|undefined,count=-1,active=-1,regions:ReturnType<typeof crowdedRegions>=[];
function current(){
 if(state.project.instruments[state.active]?.isInstructions)return [];
 if(previous!==state.project.notes||count!==state.project.notes.length||active!==state.active){
  previous=state.project.notes;count=previous.length;active=state.active;
  regions=crowdedRegions(previous.filter(n=>n.instrument===active));
 }
 return regions;
}
const span=(region:{start:number,end:number})=>({left:KEY+region.start*state.zoom-view.scrollLeft,right:KEY+region.end*state.zoom-view.scrollLeft});
/** A warning, not an error: tint the span just enough to find it, never enough to hide notes. */
export function drawCrowdedRegions(){
 ctx.save();
 for(const region of current()){
  const {left,right}=span(region);
  if(right<=KEY||left>=state.width)continue;
  ctx.fillStyle='#f0b90016';ctx.fillRect(left,HEAD,right-left,state.height-HEAD);
  ctx.fillStyle='#d9a40040';ctx.fillRect(left,HEAD,1,state.height-HEAD);ctx.fillRect(right-1,HEAD,1,state.height-HEAD);
 }
 ctx.restore();
}
/** The ruler carries the real signal, so crowding stays findable without covering the roll. */
export function drawCrowdedMarkers(){
 const list=current();if(!list.length)return;
 ctx.save();ctx.beginPath();ctx.rect(KEY,0,state.width-KEY,HEAD);ctx.clip();ctx.fillStyle='#e0a800';
 for(const region of list){
  const {left,right}=span(region);
  const from=Math.max(KEY,left),to=Math.min(state.width,right);
  if(to<=from)continue;
  ctx.fillRect(from,HEAD-3,to-from,3);
 }
 ctx.restore();
}
