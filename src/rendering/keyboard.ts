import {palette,keyboardView} from '../appearance.ts';
import {ctx,view} from '../dom.ts';
import {state} from '../state.ts';
import {KEY,HEAD} from '../constants.ts';
import {pitchTop,pitchAtY,pitchHeight} from '../pitch-viewport.ts';
import {name,sharp} from '../music/pitch.ts';

/** A black key covers this much of the column, leaving the white key's front visible. */
const BLACK=Math.round(KEY*0.62);

export function drawKeyboard(){
 // Keep both keyboard styles below the fixed measure ruler while scrolling.
 const firstPitch=pitchAtY(state.topPitch,view.scrollTop),lastPitch=pitchAtY(state.topPitch,view.scrollTop+state.height-HEAD);
 ctx.save();ctx.beginPath();ctx.rect(0,HEAD,KEY,state.height-HEAD);ctx.clip();
 if(keyboardView.piano)piano(firstPitch,lastPitch);else names(firstPitch,lastPitch);
 ctx.restore();
}

const top=(pitch:number)=>HEAD+pitchTop(state.topPitch,pitch)-view.scrollTop;

function names(firstPitch:number,lastPitch:number){
 ctx.fillStyle=palette.keyLine;ctx.fillRect(0,0,KEY,state.height);
 for(let p=firstPitch;p>=lastPitch;p--){
  const y=top(p),height=pitchHeight(p),active=p===state.previewPitch,isSharp=sharp(p);
  ctx.fillStyle=active?palette.playhead:isSharp?palette.keyDark:palette.keyLight;ctx.fillRect(0,y,KEY,height-1);
  if(p%12===0&&!active){ctx.fillStyle=palette.cRow;ctx.fillRect(0,y,KEY,height-1);}
  ctx.fillStyle=active?'#101820':isSharp?'#fff':'#15181b';ctx.font='11px Segoe UI';ctx.textBaseline='middle';ctx.fillText(name(p),15,y+height/2);
 }
}

/**
 * The pitch rows are already keyboard-shaped — naturals 20px, sharps 15px — so a piano only
 * needs different paint: one white surface, the boundary between two white keys running
 * under the black key that separates them, and the black keys laid over the top.
 */
function piano(firstPitch:number,lastPitch:number){
 ctx.fillStyle=palette.pianoWhite;ctx.fillRect(0,0,KEY,state.height);
 ctx.strokeStyle=palette.pianoLine;ctx.lineWidth=1;
 ctx.beginPath();
 for(let p=firstPitch;p>=lastPitch;p--){
  if(sharp(p))continue;
  // E|F and B|C touch, so their boundary is the row edge; elsewhere it splits the black key.
  const below=p-1,edge=Math.round(top(p)+pitchHeight(p)+(sharp(below)?pitchHeight(below)/2:0))+.5;
  ctx.moveTo(0,edge);ctx.lineTo(KEY,edge);
 }
 ctx.stroke();
 for(let p=firstPitch;p>=lastPitch;p--){
  const y=top(p),height=pitchHeight(p),active=p===state.previewPitch;
  if(sharp(p)){ctx.fillStyle=active?palette.playhead:palette.pianoBlack;ctx.fillRect(0,y,BLACK,height);}
  else if(active){ctx.fillStyle=palette.playhead;ctx.fillRect(0,y,KEY,height);}
 }
 // Only the Cs are named. Labelling every key would turn the keyboard back into a list.
 ctx.fillStyle=palette.pianoLabel;ctx.font='10px Segoe UI';ctx.textAlign='right';ctx.textBaseline='middle';
 for(let p=firstPitch;p>=lastPitch;p--)if(p%12===0&&p!==state.previewPitch)ctx.fillText(name(p),KEY-6,top(p)+pitchHeight(p)/2);
 ctx.textAlign='left';
}
