import {ctx,view} from '../dom.ts';
import {state} from '../state.ts';
import {KEY,HEAD,ROW} from '../constants.ts';
import {name,sharp} from '../music/pitch.ts';

export function drawKeyboard(){
 const startRow=Math.floor(view.scrollTop/ROW),endRow=Math.ceil((view.scrollTop+state.height)/ROW);
 ctx.save();ctx.beginPath();ctx.rect(0,HEAD,KEY,state.height-HEAD);ctx.clip();
 for(let row=startRow;row<=endRow;row++){const p=state.topPitch-row,y=HEAD+row*ROW-view.scrollTop;ctx.fillStyle=sharp(p)?'#191d23':'#dedfdd';ctx.fillRect(0,y,KEY,ROW-1);ctx.fillStyle=sharp(p)?'#fff':'#15181b';ctx.font='11px Segoe UI';ctx.textBaseline='middle';ctx.fillText(name(p),15,y+ROW/2);}ctx.restore();

}
