import {measureLines} from '../music/structure.ts';
import {palette} from '../appearance.ts';
import {ctx,view} from '../dom.ts';
import {state} from '../state.ts';
import {KEY,HEAD} from '../constants.ts';

export function drawRuler(){
 ctx.fillStyle=palette.ruler;ctx.fillRect(0,0,state.width,HEAD);
 for(const line of measureLines(state.project,view.scrollLeft/state.zoom,(view.scrollLeft+state.width)/state.zoom)){if(!line.major)continue;const x=KEY+line.tick*state.zoom-view.scrollLeft;ctx.fillStyle=palette.bar;ctx.fillRect(x,0,1,HEAD);ctx.fillStyle=palette.text;ctx.font='12px Segoe UI';ctx.textBaseline='bottom';ctx.fillText(String(line.bar),x+9,HEAD-1);}
 ctx.fillStyle=palette.corner;ctx.fillRect(0,0,KEY,HEAD);

}
