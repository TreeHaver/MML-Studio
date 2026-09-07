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
import {drawTempoMarkers} from './rendering/tempo.ts';

export function draw(){
 syncPlaybackControls();
 const {width,height}=state;
 ctx.clearRect(0,0,width,height);
 ctx.fillStyle=palette.background;
 ctx.fillRect(0,0,width,height);
 ctx.save();
 ctx.beginPath();
 ctx.rect(KEY,HEAD,width-KEY,height-HEAD);
 ctx.clip();
 drawGrid();
 drawNotes();
 ctx.restore();
 drawRuler();
 drawKeyboard();
 drawTempoMarkers();
 if(playback.tick!==null){ctx.save();ctx.beginPath();ctx.rect(KEY,HEAD,width-KEY,height-HEAD);ctx.clip();ctx.fillStyle=palette.playhead;ctx.fillRect(KEY+playback.tick*state.zoom-view.scrollLeft,HEAD,2,height-HEAD);ctx.restore();}
}
