import {state,instrumentView} from './state.ts';
import {generateMml,type MmlResult} from './music/mml.ts';
import {tempoMap} from './music/tempo.ts';
import type {Note,Project} from './model/types.ts';
import {overlapLocations} from './music/note-density.ts';
import {view,status} from './dom.ts';
import {KEY,HEAD} from './constants.ts';
import {pitchTop,pitchHeight} from './pitch-viewport.ts';
import {refresh as refreshEditor} from './commands.ts';
import {draw} from './painting.ts';

type Entry={live:boolean,result?:MmlResult,revision:number,label?:HTMLElement,warning?:HTMLElement};
const entries=new Map<number,Entry>();let epoch=instrumentView.mmlEpoch;
let previous:Note[]|undefined,count=-1,revision=0,buckets=new Map<number,Note[]>(),tempos:ReturnType<typeof tempoMap>=[];
let sentResult:MmlResult|undefined,sentStale:boolean|undefined,sentName='';
let opened:number|undefined;
function entry(i:number){let e=entries.get(i);if(!e){e={live:true,revision:-1};entries.set(i,e);}return e;}
function payload(i:Project['instruments'][number],e:Entry){return {name:i.name,...e.result,stale:e.revision!==revision};}
function publish(i:Project['instruments'][number],e:Entry,index:number){
 if(e.label)e.label.textContent=`Instrument character count: ${e.result?.bytes??'—'} bytes · ${e.result?.channels.length??'—'} Channels${e.revision!==revision?' · Out of date':''}`;
 if(e.warning){const text=e.result?.warnings.join(' ')??'';e.warning.setAttribute('data-message',text);e.warning.hidden=!text;e.warning.setAttribute('aria-label',text);}
 if(opened===index&&(sentResult!==e.result||sentStale!==(e.revision!==revision)||sentName!==i.name)){sentResult=e.result;sentStale=e.revision!==revision;sentName=i.name;void (window as any).mml?.update(payload(i,e));}
}
function generate(index:number,e:Entry){e.result=generateMml(state.project,index,buckets.get(index)??[],tempos);e.revision=revision;}
function reset(){ if(epoch!==instrumentView.mmlEpoch){epoch=instrumentView.mmlEpoch;entries.clear();opened=undefined;void (window as any).mml?.update({name:'Project changed — reopen MML',channels:[],bytes:0,warnings:[],stale:true});}}
export function updateMml(force=false){
 reset();
 const changed=force||previous!==state.project.notes||count!==state.project.notes.length;
 if(changed){previous=state.project.notes;count=previous.length;revision++;buckets=new Map();tempos=[];}
 // With every lane paused, editing does no sorting or string generation.
 const needed=state.project.instruments.some((i,index)=>entry(index).live&&entry(index).revision!==revision);
 if(needed&&tempos.length===0){tempos=tempoMap(state.project.notes,false);state.project.notes.forEach(n=>{if(!buckets.has(n.instrument))buckets.set(n.instrument,[]);buckets.get(n.instrument)!.push(n);});}
 state.project.instruments.forEach((i,index)=>{const e=entry(index);if(e.live&&e.revision!==revision)generate(index,e);publish(i,e,index);});
 if(opened!==undefined&&!state.project.instruments[opened]){opened=undefined;void (window as any).mml?.update({name:'Project changed — reopen MML',channels:[],bytes:0,warnings:[],stale:true});}
}
export function mmlControls(row:HTMLElement,body:HTMLElement,index:number){
 reset();
 const i=state.project.instruments[index],e=entry(index),box=document.createElement('div');box.className='instrument-mml';
 e.label=document.createElement('small');
 e.warning=document.createElement('button');e.warning.className='instrument-flag';e.warning.setAttribute('type','button');
 e.warning.title='Jump to the first overlapping notes in this instrument.';
 e.warning.onclick=()=>{
  const target=overlapLocations(state.project,index)[0];
  if(!target){status('No overlapping notes in this instrument in the current view.');return;}
  state.active=index;state.selectedInstruments.clear();state.selection=new Set(target.ids);refreshEditor();
  view.scrollLeft=Math.max(0,target.start*state.zoom-(state.width-KEY)/3);
  view.scrollTop=Math.max(0,pitchTop(state.topPitch,target.pitch)+pitchHeight(target.pitch)/2-(state.height-HEAD)/2);
  draw();status('Selected the first overlapping notes in this instrument.');
 };
 e.warning.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
 const label=document.createElement('label'),toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=e.live;toggle.onchange=()=>{e.live=toggle.checked;updateMml();};const caption=document.createElement('span');caption.textContent='Real time updating';label.append(toggle,caption);
 const refresh=document.createElement('button');refresh.textContent='Update MML';refresh.title='Regenerate this instrument’s MML from the notes now. Only needed with real time updating off.';refresh.onclick=()=>{e.result=generateMml(state.project,index);e.revision=revision;publish(i,e,index);};
 const show=document.createElement('button');show.textContent='Open MML';show.title='Show the generated MML text in a separate window, one tab per channel, ready to copy into MapleStory 2.';show.onclick=async()=>{if(!e.result)refresh.onclick!({} as MouseEvent);opened=index;try{await (window as any).mml.open(payload(i,e));}catch{e.warning!.textContent='Could not open the MML window.';}};
 // Generating MML is the last step of a session, so it sits inside Instrument actions,
 // opened only when wanted. Warnings stay in the card, where they must be seen.
 box.append(e.label,label,refresh,show);body.append(box);row.append(e.warning);publish(i,e,index);
}
