import {palette} from '../appearance.ts';
import {ctx,view} from '../dom.ts';
import {state} from '../state.ts';
import {KEY,HEAD,ROW} from '../constants.ts';

export function drawRuler(){
 ctx.fillStyle=palette.ruler;ctx.fillRect(0,0,state.width,HEAD);
 for(let bar=Math.floor(view.scrollLeft/(128*state.zoom));bar<(view.scrollLeft+state.width)/(128*state.zoom);bar++){const x=KEY+bar*128*state.zoom-view.scrollLeft;ctx.fillStyle='#707b87';ctx.fillRect(x,0,1,HEAD);ctx.fillStyle=palette.text;ctx.font='12px Segoe UI';ctx.textBaseline='middle';ctx.fillText(String(bar+1),x+9,HEAD/2);}
 ctx.fillStyle=palette.corner;ctx.fillRect(0,0,KEY,HEAD);

}
