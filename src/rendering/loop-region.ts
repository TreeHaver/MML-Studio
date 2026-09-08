import {ctx,view} from '../dom.ts';
import {state} from '../state.ts';
import {palette} from '../appearance.ts';
import {KEY,HEAD} from '../constants.ts';
import {loopRegion,loopSpan,looping} from '../playback/loop-region.ts';

// A switched-off loop stays on screen, faded, so it can be switched back on unchanged.
const edges=()=>({left:KEY+loopRegion.start*state.zoom-view.scrollLeft,right:KEY+loopRegion.end*state.zoom-view.scrollLeft});
const fade=()=>{ctx.globalAlpha=looping()?1:.4;};

/** The tint over the repeated stretch. Drawn with the roll already clipped. */
export function drawLoopSpan(){
 if(loopSpan()<=0)return;
 const {left,right}=edges();
 ctx.save();fade();ctx.fillStyle=palette.loop;ctx.fillRect(left,HEAD,right-left,state.height-HEAD);ctx.restore();
}
/** The bar across the ruler that shows which stretch repeats. */
export function drawLoopBar(){
 if(loopSpan()<=0)return;
 const {left,right}=edges();
 ctx.save();ctx.beginPath();ctx.rect(KEY,0,state.width-KEY,HEAD);ctx.clip();fade();
 ctx.fillStyle=palette.loopBar;
 const round=(x:number,y:number,w:number,h:number,r:number)=>{
  ctx.beginPath();
  if(typeof ctx.roundRect==='function')ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);
  ctx.fill();
 };
 // One rounded bar and nothing else: every shape added at the ends read as a spike.
 // The ends stay just as easy to take hold of - that tolerance is measured in ticks,
 // in loopEdgeAt, and owes nothing to what is drawn here.
 round(left,1,right-left,6,3);
 ctx.restore();
}
