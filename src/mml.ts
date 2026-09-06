import {state,instrumentView} from './state.ts';
import {generateMml,type MmlResult} from './music/mml.ts';
import {tempoMap} from './music/tempo.ts';
import type {Note,Project} from './model/types.ts';

type Entry={live:boolean,result?:MmlResult,revision:number,label?:HTMLElement,warning?:HTMLElement};
const entries=new Map<number,Entry>();let epoch=instrumentView.mmlEpoch;
let previous:Note[]|undefined,count=-1,revision=0,buckets=new Map<number,Note[]>(),tempos:ReturnType<typeof tempoMap>=[];
let sentResult:MmlResult|undefined,sentStale:boolean|undefined,sentName='';
let opened:number|undefined;
function entry(i:number){let e=entries.get(i);if(!e){e={live:true,revision:-1};entries.set(i,e);}return e;}
function payload(i:Project['instruments'][number],e:Entry){return {name:i.name,...e.result,stale:e.revision!==revision};}
function publish(i:Project['instruments'][number],e:Entry,index:number){
 if(e.label)e.label.textContent=`Instrument character count: ${e.result?.bytes??'—'} bytes · ${e.result?.channels.length??'—'} Channels${e.revision!==revision?' · Out of date':''}`;
 if(e.warning)e.warning.textContent=e.result?.warnings.join(' ')??'';
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
 if(needed&&tempos.length===0){tempos=tempoMap(state.project.notes);state.project.notes.forEach(n=>{if(!buckets.has(n.instrument))buckets.set(n.instrument,[]);buckets.get(n.instrument)!.push(n);});}
 state.project.instruments.forEach((i,index)=>{const e=entry(index);if(e.live&&e.revision!==revision)generate(index,e);publish(i,e,index);});
 if(opened!==undefined&&!state.project.instruments[opened]){opened=undefined;void (window as any).mml?.update({name:'Project changed — reopen MML',channels:[],bytes:0,warnings:[],stale:true});}
}
export function mmlControls(row:HTMLElement,index:number){
 reset();
 const i=state.project.instruments[index],e=entry(index),box=document.createElement('div');box.className='instrument-mml';
 e.label=document.createElement('small');e.warning=document.createElement('small');e.warning.className='instrument-warning';
 const label=document.createElement('label'),toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=e.live;toggle.onchange=()=>{e.live=toggle.checked;updateMml();};const caption=document.createElement('span');caption.textContent='Real time updating';label.append(toggle,caption);
 const refresh=document.createElement('button');refresh.textContent='Update MML';refresh.onclick=()=>{e.result=generateMml(state.project,index);e.revision=revision;publish(i,e,index);};
 const show=document.createElement('button');show.textContent='Open MML';show.onclick=async()=>{if(!e.result)refresh.onclick!({} as MouseEvent);opened=index;try{await (window as any).mml.open(payload(i,e));}catch{e.warning!.textContent='Could not open the MML window.';}};
 box.append(e.label,label,refresh,show,e.warning);row.append(box);publish(i,e,index);
}
