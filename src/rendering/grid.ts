import {measureLines} from '../music/structure.ts';
import {palette} from '../appearance.ts';
import {ctx,view} from '../dom.ts';
import {state} from '../state.ts';
import {KEY,HEAD} from '../constants.ts';
import {pitchTop,pitchAtY,pitchHeight} from '../music/pitch-layout.ts';
import {sharp} from '../music/pitch.ts';

export function drawGrid(){
 const step=128/state.project.grid,first=Math.floor(view.scrollLeft/(step*state.zoom));
 for(let i=first;i<(view.scrollLeft+state.width)/(step*state.zoom);i++){ctx.fillStyle=i%2?palette.gridA:palette.gridB;ctx.fillRect(KEY+i*step*state.zoom-view.scrollLeft,HEAD,step*state.zoom,state.height);}
 const firstPitch=pitchAtY(state.topPitch,view.scrollTop),lastPitch=pitchAtY(state.topPitch,view.scrollTop+state.height-HEAD);
 for(let pitch=firstPitch;pitch>=lastPitch;pitch--){
  const y=HEAD+pitchTop(state.topPitch,pitch)-view.scrollTop,height=pitchHeight(pitch);
  if(sharp(pitch)){ctx.fillStyle='#00000024';ctx.fillRect(KEY,y,state.width,height-1);}
  if(pitch%12===0){ctx.fillStyle=palette.cRow;ctx.fillRect(KEY,y,state.width,height-1);}
  ctx.fillStyle=pitch%12===0?palette.octave:palette.row;ctx.fillRect(KEY,y+height-1,state.width,1);
 }
 for(const line of measureLines(state.project,view.scrollLeft/state.zoom,(view.scrollLeft+state.width)/state.zoom)){ctx.fillStyle=line.major?palette.bar:palette.beat;ctx.fillRect(KEY+line.tick*state.zoom-view.scrollLeft,HEAD,1,state.height);}

}
