import {ctx,view} from '../dom.ts';
import {state,isMuted} from '../state.ts';
import {KEY,HEAD,ROW} from '../constants.ts';
import {rect,boxIds,musical} from '../geometry.ts';
import {name,sharp} from '../music/pitch.ts';
import {INSTRUCTIONS_COLOR} from '../model/instructions.ts';

const luminance=(hex:string)=>{const match=/^#([0-9a-f]{6})$/i.exec(hex);if(!match)return 1;const value=Number.parseInt(match[1],16),channel=(shift:number)=>{const c=((value>>shift)&255)/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);};return .2126*channel(16)+.7152*channel(8)+.0722*channel(0);};
export function noteLabelColor(background:string){const bg=luminance(background),dark=luminance('#161b20'),light=luminance('#f7fbff');return (light+.05)/(bg+.05)>(bg+.05)/(dark+.05)?'#f7fbff':'#161b20';}

export function drawNotes(){
 const preview=state.gesture?.kind==='box'?new Set(boxIds(state.gesture.music,musical(state.gesture.current))):null;
 for(const n of state.project.notes){if(isMuted(n.instrument))continue;const r=rect(n);if(r.x+r.w<KEY||r.x>state.width||r.y+r.h<HEAD||r.y>state.height)continue;
 const instructions=state.project.instruments[n.instrument].isInstructions;
 ctx.globalAlpha=n.instrument===state.active?1:.4;ctx.fillStyle=instructions?INSTRUCTIONS_COLOR:state.project.instruments[n.instrument].color;ctx.fillRect(r.x,r.y,r.w,r.h);
 if(!instructions&&sharp(n.pitch)){ctx.fillStyle='#00000022';ctx.fillRect(r.x,r.y,r.w,r.h);}ctx.strokeStyle='#171b20';ctx.lineWidth=1;ctx.strokeRect(r.x+.5,r.y+.5,Math.max(0,r.w-1),r.h-1);
 if((preview?preview.has(n.id)||(state.gesture.add&&state.selection.has(n.id)):state.selection.has(n.id))){ctx.strokeStyle='#67b7ff';ctx.lineWidth=2;ctx.strokeRect(r.x,r.y,r.w,r.h);}
 if(!instructions&&state.selection.has(n.id)&&r.w>9){ctx.fillStyle='#ffffffa0';ctx.fillRect(r.x+r.w-4,r.y+3,1,r.h-6);}
 ctx.save();ctx.beginPath();ctx.rect(r.x+2,r.y,Math.max(0,r.w-4),r.h);ctx.clip();ctx.fillStyle=noteLabelColor(instructions?INSTRUCTIONS_COLOR:state.project.instruments[n.instrument].color);ctx.font='10px Segoe UI, sans-serif';ctx.textBaseline='middle';ctx.fillText(instructions?(n.tempo==null?'Event':`T${n.tempo}`):name(n.pitch)+(n.tempo==null?'':` T${n.tempo}`),r.x+4,r.y+r.h/2);ctx.restore();ctx.globalAlpha=1;
 }
 // Anchored to the content, so the box keeps its corner while the roll scrolls under it.
 if(state.gesture?.kind==='box'){const g=state.gesture,a={x:g.origin.x-view.scrollLeft,y:g.origin.y-view.scrollTop},b=g.current;ctx.fillStyle='#379bf528';ctx.strokeStyle='#67b7ff';ctx.lineWidth=1;ctx.fillRect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(a.x-b.x),Math.abs(a.y-b.y));ctx.strokeRect(Math.min(a.x,b.x)+.5,Math.min(a.y,b.y)+.5,Math.abs(a.x-b.x),Math.abs(a.y-b.y));}

}
