import {colors} from './model/project.ts';

/**
 * Chromium's native colour dialog is an operating-system window: page CSS cannot reach it,
 * so it always looked foreign inside the editor. This is the same picker in the editor's
 * own style — any colour at all, through the square, the hue bar or a typed hex value —
 * with the project's own instrument colours offered as one-click presets.
 */
export const PALETTE=[...colors,'#FF7043','#4FD1C5','#7C9CF7','#B5D44A','#F06BC4','#9AA7B0'];

const clamp01=(value:number)=>Math.max(0,Math.min(1,value));
const pad=(value:number)=>value.toString(16).padStart(2,'0');

export function hsvToHex(h:number,s:number,v:number){
 const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;
 const [r,g,b]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
 return '#'+[r,g,b].map(channel=>pad(Math.round((channel+m)*255))).join('').toUpperCase();
}
export function hexToHsv(hex:string){
 const full=hex.length===4?'#'+[...hex.slice(1)].map(character=>character+character).join(''):hex;
 const number=parseInt(full.slice(1),16);
 const r=((number>>16)&255)/255,g=((number>>8)&255)/255,b=(number&255)/255;
 const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
 let h=0;
 if(delta){
  if(max===r)h=60*(((g-b)/delta)%6);
  else if(max===g)h=60*((b-r)/delta+2);
  else h=60*((r-g)/delta+4);
 }
 return {h:(h+360)%360,s:max?delta/max:0,v:max};
}
const valid=(value:string)=>/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
const same=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();

let close:(()=>void)|null=null;
/** Closes the open panel, if any. Used when the panel's card is about to be rebuilt. */
export function closeColorPanel(){close?.();}

export function colorSwatch(value:string,label:string,pick:(color:string)=>void){
 const swatch=document.createElement('button');
 swatch.type='button';swatch.className='color-swatch';swatch.style.background=value;
 swatch.dataset.color=value.toUpperCase();
 swatch.title='Instrument color';swatch.setAttribute('aria-label',label);swatch.setAttribute('aria-haspopup','true');
 swatch.onclick=event=>{event.stopPropagation();open(swatch,pick);};
 return swatch;
}

function open(swatch:HTMLButtonElement,pick:(color:string)=>void){
 // Clicking the open swatch closes its own panel rather than reopening it.
 const reopening=swatch.classList.contains('open');
 close?.();
 if(reopening)return;

 let {h,s,v}=hexToHsv(swatch.dataset.color||'#FF9C33');
 const panel=document.createElement('div');panel.className='menu-panel color-panel';
 const area=document.createElement('div');area.className='color-area';
 const areaDot=document.createElement('div');areaDot.className='color-dot';area.append(areaDot);
 const hue=document.createElement('div');hue.className='color-hue';
 const hueDot=document.createElement('div');hueDot.className='color-dot';hue.append(hueDot);
 const entry=document.createElement('div');entry.className='color-entry';
 const preview=document.createElement('span');preview.className='color-preview';
 const hex=document.createElement('input');hex.className='color-hex';hex.spellcheck=false;hex.setAttribute('aria-label','Hex color');
 entry.append(preview,hex);
 const presets=document.createElement('div');presets.className='color-presets';
 const cells=PALETTE.map(color=>{
  const cell=document.createElement('button');
  cell.type='button';cell.className='color-cell';cell.style.background=color;
  cell.title=color;cell.setAttribute('aria-label',color);
  cell.onclick=()=>{commit(color);shut();};
  presets.append(cell);return cell;
 });
 panel.append(area,hue,entry,presets);

 const current=()=>hsvToHex(h,s,v);
 const show=(editing=false)=>{
  const color=current();
  area.style.backgroundImage=`linear-gradient(to top,#000,#0000),linear-gradient(to right,#fff,${hsvToHex(h,1,1)})`;
  areaDot.style.left=s*100+'%';areaDot.style.top=(1-v)*100+'%';
  hueDot.style.left=(h/360)*100+'%';
  preview.style.background=color;
  if(!editing)hex.value=color;
  swatch.style.background=color;
  for(const cell of cells)cell.classList.toggle('current',same(cell.title,color));
 };
 const commit=(color:string)=>{
  const hsv=hexToHsv(color);h=hsv.h;s=hsv.s;v=hsv.v;
  swatch.dataset.color=color.toUpperCase();show();pick(color.toUpperCase());
 };

 // Dragging explores; the project only changes when the pointer is released, so a drag
 // leaves one entry in the history rather than one per frame.
 const track=(element:HTMLElement,to:(x:number,y:number)=>void)=>{
  const apply=(event:PointerEvent)=>{
   const box=element.getBoundingClientRect();
   to(clamp01((event.clientX-box.left)/box.width),clamp01((event.clientY-box.top)/box.height));
   show();
  };
  element.onpointerdown=event=>{event.preventDefault();element.setPointerCapture(event.pointerId);apply(event);};
  element.onpointermove=event=>{if(element.hasPointerCapture(event.pointerId))apply(event);};
  element.onpointerup=event=>{if(!element.hasPointerCapture(event.pointerId))return;element.releasePointerCapture(event.pointerId);apply(event);commit(current());};
 };
 track(area,(x,y)=>{s=x;v=1-y;});
 track(hue,x=>{h=x*360;});

 hex.oninput=()=>{if(valid(hex.value)){const hsv=hexToHsv(hex.value.trim());h=hsv.h;s=hsv.s;v=hsv.v;show(true);}};
 hex.onkeydown=event=>{
  if(event.key==='Enter'){event.preventDefault();if(valid(hex.value)){commit(hsvToHex(h,s,v));shut();}else hex.value=current();}
  if(event.key==='Escape'){event.preventDefault();shut();}
 };
 hex.onblur=()=>{if(valid(hex.value))commit(hsvToHex(h,s,v));else hex.value=current();};

 document.body.append(panel);swatch.classList.add('open');show();
 const box=swatch.getBoundingClientRect();
 panel.style.left=Math.round(Math.max(8,Math.min(box.left,innerWidth-panel.offsetWidth-8)))+'px';
 const below=innerHeight-box.bottom-14;
 panel.style.top=Math.round(below>=panel.offsetHeight?box.bottom+6:Math.max(8,box.top-panel.offsetHeight-6))+'px';

 const outside=(event:Event)=>{const target=event.target as Element|null;if(target!==swatch&&!target?.closest?.('.color-panel'))shut();};
 const dismiss=(event:KeyboardEvent)=>{if(event.key==='Escape')shut();};
 function shut(){
  panel.remove();swatch.classList.remove('open');close=null;
  document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keyup',dismiss,true);
 }
 document.addEventListener('pointerdown',outside,true);document.addEventListener('keyup',dismiss,true);
 close=shut;
}
