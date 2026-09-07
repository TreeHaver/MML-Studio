import {ctx,view} from '../dom.ts';
import {state} from '../state.ts';
import {KEY,HEAD} from '../constants.ts';
import {sheetSettings} from '../sheet-settings.ts';
import {createSheetPlanner} from '../music/sheets.ts';
let previous='',boundary:number|null=null,tooSmall=false;
export function drawSheetLimit(){
 const instrument=state.project.instruments[state.active];if(!instrument||instrument.isInstructions)return;
 const signature=JSON.stringify([state.active,instrument,sheetSettings.limit,state.project.notes.filter(n=>n.instrument===state.active||n.tempo!=null)]);
 if(signature!==previous){
  previous=signature;boundary=null;tooSmall=false;
  try{const plan=createSheetPlanner(state.project,state.active,sheetSettings.limit);
   if(plan.whole.bytes===sheetSettings.limit)boundary=plan.end;
   else if(plan.whole.bytes>sheetSettings.limit){try{boundary=plan.next(0).end;}catch{boundary=0;tooSmall=true;}}
  }catch{/* A transient invalid gesture should not interrupt drawing. */}
 }
 if(boundary===null)return;
 const x=KEY+boundary*state.zoom-view.scrollLeft;if(x<KEY||x>state.width)return;
 ctx.save();ctx.beginPath();ctx.rect(KEY,0,state.width-KEY,state.height);ctx.clip();
 ctx.fillStyle='#e53935';ctx.fillRect(x,HEAD,2,state.height-HEAD);ctx.fillRect(x,0,2,HEAD);
 ctx.font='11px Segoe UI';ctx.textBaseline='top';ctx.fillText(tooSmall?'Limit too small':`${sheetSettings.limit.toLocaleString()} char limit`,x+5,2);ctx.restore();
}
