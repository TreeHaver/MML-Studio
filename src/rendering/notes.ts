import {ctx,view} from '../dom.ts';
import {state,isMuted} from '../state.ts';
import {KEY,HEAD} from '../constants.ts';
import {rect,boxIds,musical} from '../geometry.ts';
import {name,sharp} from '../music/pitch.ts';
import {INSTRUCTIONS_COLOR} from '../model/instructions.ts';
import {pitchAtY} from '../pitch-viewport.ts';
import {createNoteVisibility} from '../music/note-visibility.ts';
import type {Note} from '../model/types.ts';

let indexedNotes:Note[]|undefined,indexedCount=-1,indexedRoles='',query:ReturnType<typeof createNoteVisibility>|undefined;
function visibleNotes(){
 const notes=state.project.notes,roles=state.project.instruments.map(i=>i.isInstructions?'1':'0').join('');
 if(indexedNotes!==notes||indexedCount!==notes.length||indexedRoles!==roles){
  query=createNoteVisibility(notes,i=>!!state.project.instruments[i]?.isInstructions);
  indexedNotes=notes;indexedCount=notes.length;indexedRoles=roles;
 }
 return query!(view.scrollLeft/state.zoom,(view.scrollLeft+state.width-KEY)/state.zoom,
  pitchAtY(state.topPitch,view.scrollTop+state.height-HEAD),pitchAtY(state.topPitch,view.scrollTop),48/state.zoom);
}
const labelColors=new Map<string,string>();

const luminance=(hex:string)=>{const match=/^#([0-9a-f]{6})$/i.exec(hex);if(!match)return 1;const value=Number.parseInt(match[1],16),channel=(shift:number)=>{const c=((value>>shift)&255)/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);};return .2126*channel(16)+.7152*channel(8)+.0722*channel(0);};
export function noteLabelColor(background:string){let color=labelColors.get(background);if(!color){const bg=luminance(background),dark=luminance('#161b20'),light=luminance('#f7fbff');color=(light+.05)/(bg+.05)>(bg+.05)/(dark+.05)?'#f7fbff':'#161b20';labelColors.set(background,color);}return color;}

export function drawNotes(){
 const visible=visibleNotes();
 const preview=state.gesture?.kind==='box'?new Set(boxIds(state.gesture.music,musical(state.gesture.current),visible)):null;
 for(const n of visible){if(isMuted(n.instrument)||state.project.instruments[n.instrument].isInstructions)continue;const r=rect(n);if(r.x+r.w<=KEY||r.x>=state.width||r.y+r.h<=HEAD||r.y>=state.height)continue;
 const instructions=state.project.instruments[n.instrument].isInstructions;
 ctx.globalAlpha=n.instrument===state.active?1:.4;ctx.fillStyle=instructions?INSTRUCTIONS_COLOR:state.project.instruments[n.instrument].color;ctx.fillRect(r.x,r.y,r.w,r.h);
 if(!instructions&&sharp(n.pitch)){ctx.fillStyle='#00000022';ctx.fillRect(r.x,r.y,r.w,r.h);}
 // An inside-only border darkens the lane color without covering adjacent cells.
 const border=Math.min(2,r.w/2,r.h/2);ctx.strokeStyle='#00000038';ctx.lineWidth=border;
 ctx.strokeRect(r.x+border/2,r.y+border/2,r.w-border,r.h-border);
 if((preview?preview.has(n.id)||(state.gesture.add&&state.selection.has(n.id)):state.selection.has(n.id))){ctx.save();ctx.beginPath();ctx.rect(r.x,r.y,r.w,r.h);ctx.clip();ctx.strokeStyle='#67b7ff';ctx.lineWidth=2;ctx.strokeRect(r.x+1,r.y+1,Math.max(0,r.w-2),r.h-2);ctx.restore();}
 if(!instructions&&state.selection.has(n.id)&&r.w>9){ctx.fillStyle='#ffffffa0';ctx.fillRect(r.x+r.w-4,r.y+3,1,r.h-6);}
 if(r.w>8){ctx.save();ctx.beginPath();ctx.rect(r.x+2,r.y,Math.max(0,r.w-4),r.h);ctx.clip();ctx.fillStyle=noteLabelColor(instructions?INSTRUCTIONS_COLOR:state.project.instruments[n.instrument].color);ctx.font='10px Segoe UI, sans-serif';ctx.textBaseline='middle';ctx.fillText(instructions?([n.section,n.timeSignature,n.tempo==null?'':`T${n.tempo}`].filter(Boolean).join(' · ')||'Event'):name(n.pitch)+(n.tempo==null?'':` T${n.tempo}`),r.x+4,r.y+r.h/2);ctx.restore();}ctx.globalAlpha=1;
 }
 // Anchored to the content, so the box keeps its corner while the roll scrolls under it.
 if(state.gesture?.kind==='box'){const g=state.gesture,a={x:g.origin.x-view.scrollLeft,y:g.origin.y-view.scrollTop},b=g.current;ctx.fillStyle='#379bf528';ctx.strokeStyle='#67b7ff';ctx.lineWidth=1;ctx.fillRect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(a.x-b.x),Math.abs(a.y-b.y));ctx.strokeRect(Math.min(a.x,b.x)+.5,Math.min(a.y,b.y)+.5,Math.abs(a.x-b.x),Math.abs(a.y-b.y));}

}
