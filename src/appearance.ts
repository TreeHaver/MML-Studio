import {$} from './dom.ts';
import {draw} from './painting.ts';
export const palette={gridA:'#e5f1fa',gridB:'#deedf8',row:'#275d8010',octave:'#387ba447',bar:'#3e789760',beat:'#3c73951c',ruler:'#c8dfef',text:'#284d68',keyDark:'#365b79',keyLight:'#f6fbff',corner:'#b7d3e7',background:'#deedf8',playhead:'#1689dc'};
const sky={...palette},midnight={gridA:'#15283e',gridB:'#182d44',row:'#ffffff08',octave:'#77b6eb38',bar:'#82b8df50',beat:'#9bcfff18',ruler:'#213d58',text:'#c8e6ff',keyDark:'#142b42',keyLight:'#b8cee0',corner:'#193149',background:'#15283e',playhead:'#58beff'};
const night={gridA:'#171717',gridB:'#1b1b1b',row:'#ffffff08',octave:'#ffffff25',bar:'#ffffff38',beat:'#ffffff12',ruler:'#252525',text:'#dddddd',keyDark:'#111111',keyLight:'#bfbfbf',corner:'#202020',background:'#171717',playhead:'#eeeeee'};
const key='mml-studio-workspace-v1';
export function installAppearance(){
 if(!document.documentElement)return;
 const main=$('workspace'),left=$('left-divider'),right=$('right-divider');
 const decorateSelect=(select:HTMLSelectElement)=>{
  if(select.parentElement?.classList.contains('select-control'))return;
  const shell=document.createElement('span'),chevron=document.createElement('span');shell.className='select-control';chevron.className='select-chevron';chevron.setAttribute('aria-hidden','true');select.replaceWith(shell);shell.append(select,chevron);
  const close=()=>shell.classList.remove('open');
  select.addEventListener('pointerdown',()=>shell.classList.toggle('open'));select.addEventListener('change',close);select.addEventListener('keydown',e=>{if(e.key==='Escape'||e.key==='Enter')close();else if(e.key===' '||(e.key==='ArrowDown'&&e.altKey))shell.classList.add('open');});select.addEventListener('blur',()=>window.setTimeout(close,0));
 };
 document.querySelectorAll('select').forEach(select=>decorateSelect(select as HTMLSelectElement));new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(!(node instanceof Element))return;if(node.matches('select'))decorateSelect(node as HTMLSelectElement);node.querySelectorAll('select').forEach(select=>decorateSelect(select as HTMLSelectElement));}))).observe(document.body,{childList:true,subtree:true});
 let settings={theme:'sky',left:264,right:234,leftHidden:false,rightHidden:false};
 try{const saved=JSON.parse(localStorage.getItem(key)??'null');if(saved){if(['sky','midnight','night'].includes(saved.theme))settings.theme=saved.theme;for(const side of ['left','right'] as const){if(Number.isFinite(saved[side]))settings[side]=Math.max(180,Math.min(480,saved[side]));}settings.leftHidden=saved.leftHidden===true;settings.rightHidden=saved.rightHidden===true;}}catch{}
 const save=()=>{try{localStorage.setItem(key,JSON.stringify(settings));}catch{}};
 const fit=()=>{
  let l=settings.leftHidden?0:settings.left,r=settings.rightHidden?0:settings.right;
  const available=Math.max(0,main.clientWidth-340-12),sum=l+r;
  if(sum>available){const baseL=l?180:0,baseR=r?180:0,extra=Math.max(0,available-baseL-baseR),wanted=Math.max(1,sum-baseL-baseR);l=baseL+Math.floor((l-baseL)*extra/wanted);r=baseR+Math.floor((r-baseR)*extra/wanted);}
  main.style.gridTemplateColumns=`${l}px 6px minmax(0,1fr) 6px ${r}px`;
  $('track-panel').hidden=settings.leftHidden;$('note-properties').hidden=settings.rightHidden;
  for(const [side,handle,width] of [['left',left,l],['right',right,r]] as const){handle.setAttribute('aria-valuenow',String(width));handle.setAttribute('aria-valuemax',String(Math.max(180,main.clientWidth-340-12-(side==='left'?r:l))));$('toggle-'+side).setAttribute('aria-pressed',String(!settings[side+'Hidden' as 'leftHidden'|'rightHidden']));}
 };
 const theme=()=>{document.documentElement.dataset.theme=settings.theme;Object.assign(palette,settings.theme==='sky'?sky:settings.theme==='night'?night:midnight);($('theme') as HTMLSelectElement).value=settings.theme;draw();};
 const themeSelect=$('theme') as HTMLSelectElement;themeSelect.onchange=()=>{settings.theme=themeSelect.value;theme();save();};
 for(const [side,handle] of [['left',left],['right',right]] as const){
  const hidden=side==='left'?'leftHidden':'rightHidden',other=side==='left'?'right':'left',otherHidden=side==='left'?'rightHidden':'leftHidden';
  const clamp=(value:number)=>Math.max(180,Math.min(value,480,main.clientWidth-340-12-(settings[otherHidden]?0:$(other==='left'?'track-panel':'note-properties').getBoundingClientRect().width)));
  let drag:{x:number,width:number,preferred:number,hidden:boolean}|null=null;
  handle.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();drag={x:e.clientX,width:settings[hidden]?settings[side]:$(side==='left'?'track-panel':'note-properties').getBoundingClientRect().width,preferred:settings[side],hidden:settings[hidden]};settings[hidden]=false;handle.setPointerCapture(e.pointerId);document.documentElement.classList.add('resizing');fit();};
  handle.onpointermove=e=>{if(!drag)return;settings[side]=clamp(drag.width+(e.clientX-drag.x)*(side==='left'?1:-1));fit();};
  const finish=(cancel=false)=>{if(!drag)return;if(cancel){settings[side]=drag.preferred;settings[hidden]=drag.hidden;}drag=null;document.documentElement.classList.remove('resizing');fit();save();};
  handle.onpointerup=()=>finish();handle.onpointercancel=()=>finish(true);handle.onlostpointercapture=()=>finish();
  handle.ondblclick=()=>{settings[side]=side==='left'?264:234;settings[hidden]=false;fit();save();};
  handle.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();settings[hidden]=false;settings[side]=clamp(settings[side]+(e.key==='ArrowRight'?16:-16)*(side==='left'?1:-1));fit();save();}if(e.key==='Escape')finish(true);};
  $('toggle-'+side).onclick=()=>{settings[hidden]=!settings[hidden];fit();save();};
 }
 theme();fit();new ResizeObserver(fit).observe(main);
}
