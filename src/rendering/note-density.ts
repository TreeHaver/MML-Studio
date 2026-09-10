import {ctx,view} from '../dom.ts';
import {state} from '../state.ts';
import {KEY,HEAD} from '../constants.ts';
import {crowdedRegionCounts,overlapLocations} from '../music/note-density.ts';
let overlapNotes:typeof state.project.notes|undefined,overlapCount=-1,overlapActive=-1,overlapInstruments:typeof state.project.instruments|undefined,overlaps:ReturnType<typeof overlapLocations>=[];
/** Orange onset lines use the same current-view/performance definition as MML. */
function currentOverlaps(){
 if(overlapNotes!==state.project.notes||overlapCount!==state.project.notes.length||overlapInstruments!==state.project.instruments||overlapActive!==state.active){
  overlapNotes=state.project.notes;overlapCount=overlapNotes.length;overlapInstruments=state.project.instruments;overlapActive=state.active;
  overlaps=overlapLocations(state.project,state.active);
 }
 return overlaps;
}
export function drawOverlapMarkers(){
 const overlaps=currentOverlaps();
 ctx.save();ctx.beginPath();ctx.rect(KEY,HEAD,state.width-KEY,state.height-HEAD);ctx.clip();ctx.fillStyle='#e58a24';
 for(const start of new Set(overlaps.map(o=>o.start))){
  const x=KEY+start*state.zoom-view.scrollLeft;
  if(x>=KEY&&x<state.width)ctx.fillRect(x,HEAD,2,state.height-HEAD);
 }
 ctx.restore();
}
let previous:typeof state.project.notes|undefined,count=-1,active=-1,regions:ReturnType<typeof crowdedRegionCounts>=[];
function current(){
 if(state.project.instruments[state.active]?.isInstructions)return [];
 if(previous!==state.project.notes||count!==state.project.notes.length||active!==state.active){
  previous=state.project.notes;count=previous.length;active=state.active;
  regions=crowdedRegionCounts(previous.filter(n=>n.instrument===active));
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

/** Warning captions use the same data as the timeline lines and shaded areas. */
export function warningCaptions(){
 const onset=[...new Set(currentOverlaps().map(o=>o.start))].map(start=>({start,text:'Multiple notes start at once',color:'#e58a24',wrap:true}));
 const density=current().filter(r=>span(r).right>KEY&&span(r).left<state.width).map(r=>({start:Math.max(r.start,view.scrollLeft/state.zoom),text:`This area has ${r.peak} notes overlapping! The maximum is 10. Simplify chords or shorten held notes!`,color:'#e0a800',wrap:true}));
 return [...onset,...density];
}
