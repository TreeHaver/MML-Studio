import {draw} from './painting.ts';
import {$,canvas,ctx,view} from './dom.ts';
import {state} from './state.ts';
import {KEY,HEAD,ROW} from './constants.ts';
import {playheadScroll} from './playback/follow.ts';

export function followPlayback(tick:number){
 const left=playheadScroll(tick,state.zoom,view.clientWidth,view.scrollLeft,KEY);
 if(left!==view.scrollLeft)view.scrollLeft=left;
}

export function layout(){
 const notes=state.project.notes;let nt=127,nb=0,end=4096;
 for(const n of notes){nt=Math.max(nt,n.pitch+12);nb=Math.min(nb,n.pitch-12);end=Math.max(end,n.start+n.length+512);}
 if(nt!==state.topPitch){view.scrollTop+=(nt-state.topPitch)*ROW;state.topPitch=nt;}state.bottomPitch=nb;
 state.width=view.clientWidth;state.height=view.clientHeight;const dpr=devicePixelRatio||1;
 canvas.width=Math.round(state.width*dpr);canvas.height=Math.round(state.height*dpr);canvas.style.width=state.width+'px';canvas.style.height=state.height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);
 $('extent').style.width=(KEY+end*state.zoom)+'px';$('extent').style.height=(HEAD+(state.topPitch-state.bottomPitch+1)*ROW)+'px';draw();
}
