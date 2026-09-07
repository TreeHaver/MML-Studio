import {drawCrowdedRegions,drawCrowdedMarkers} from './rendering/note-density.ts';
import {refreshSignature} from './toolbar.ts';
import {refreshSegmentControls,drawSegmentBoundary} from './segment-view.ts';
import {drawSheetLimit} from './rendering/sheet-limit.ts';
import {palette} from './appearance.ts';
import {playback,syncPlaybackControls} from './playback/transport.ts';
import {view} from './dom.ts';
import {ctx} from './dom.ts';
import {state} from './state.ts';
import {KEY,HEAD} from './constants.ts';
import {drawGrid} from './rendering/grid.ts';
import {drawNotes} from './rendering/notes.ts';
import {drawRuler} from './rendering/ruler.ts';
import {drawKeyboard} from './rendering/keyboard.ts';
import {drawInstructionLines,drawLoopRegions,drawTempoMarkers} from './rendering/tempo.ts';

export function draw(){
 syncPlaybackControls();
 refreshSignature();
 refreshSegmentControls();
 const {width,height}=state;
 ctx.clearRect(0,0,width,height);
 ctx.fillStyle=palette.background;
 ctx.fillRect(0,0,width,height);
 ctx.save();
 ctx.beginPath();
 ctx.rect(KEY,HEAD,width-KEY,height-HEAD);
 ctx.clip();
 drawGrid();
 drawLoopRegions();
 drawInstructionLines();
 drawCrowdedRegions();
 drawNotes();
 ctx.restore();
 drawRuler();
 drawCrowdedMarkers();
 drawKeyboard();
 drawTempoMarkers();
 drawSegmentBoundary();
 drawSheetLimit();
 if(playback.tick!==null){
  const x=KEY+playback.tick*state.zoom-view.scrollLeft;
  ctx.save();ctx.beginPath();ctx.rect(KEY,HEAD,width-KEY,height-HEAD);ctx.clip();
  ctx.fillStyle=palette.playhead;ctx.fillRect(x,HEAD,2,height-HEAD);ctx.restore();
  ctx.save();ctx.beginPath();ctx.rect(KEY,0,width-KEY,HEAD);ctx.clip();
  ctx.fillStyle=palette.playhead;ctx.fillRect(x,0,2,HEAD);
  ctx.beginPath();ctx.moveTo(x-5,0);ctx.lineTo(x+7,0);ctx.lineTo(x+1,10);ctx.closePath();ctx.fill();ctx.restore();
 }
}
