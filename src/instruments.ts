import {mmlControls,updateMml} from './mml.ts';
import {instrumentActions,removeInstrument} from './instrument-actions.ts';
import {GM_PROGRAMS} from './playback/gm-programs.ts';
import {DRUM_KIT_NAME,DRUM_MS2_WARNING,MS2_DRUMS,type Ms2Drum} from './playback/drums.ts';
import {INSTRUCTIONS_NAME} from './model/instructions.ts';
import {draw} from './painting.ts';
import {info} from './inspector.ts';
import {checkpoint} from './history.ts';
import {refresh} from './commands.ts';
import {$,view} from './dom.ts';
import {ROW} from './constants.ts';
import {updatePlaybackMutes} from './playback/transport.ts';
import {state,instrumentView} from './state.ts';
import {colors} from './model/project.ts';
import {name} from './music/pitch.ts';

export function instruments(){
 // Rebuilding the list empties its scroll container, which would reset the scroll position.
 const panel=$('track-panel'),scroll=panel.scrollTop;
 $('instrument-count').textContent=String(state.project.instruments.length);$('editing-instrument').textContent=state.project.instruments[state.active]?.name??'';
 $('instruments').replaceChildren();state.project.instruments.forEach((i,index)=>{
 const row=document.createElement('div');row.className='instrument';row.classList.toggle('selected',index===state.active);const color=document.createElement('input');color.type='color';color.value=i.color;color.setAttribute('aria-label','Color for '+i.name);color.onchange=()=>{checkpoint();i.color=color.value;draw();};
 const collapsed=instrumentView.collapsed.has(index);
 const button=document.createElement('button');button.textContent=i.name+(instrumentView.muted.has(index)?' (muted)':'');button.className='instrument-name';button.classList.toggle('active',index===state.active);
 button.title=i.name+' · click again to collapse';button.setAttribute('aria-expanded',String(!collapsed));
 const select=()=>{
  if(index===state.active)return;
  state.active=index;state.selection.clear();document.querySelectorAll('.instrument-name').forEach((el,j)=>el.classList.toggle('active',j===index));document.querySelectorAll('.instrument').forEach((el,j)=>el.classList.toggle('selected',j===index));$('editing-instrument').textContent=i.name;if(i.isInstructions){const event=state.project.notes.find(n=>n.instrument===index);view.scrollTop=Math.max(0,(state.topPitch-(event?.pitch??60)-5)*ROW);}info();draw();
 };
 button.onclick=()=>{
  const collapse=index===state.active&&!instrumentView.collapsed.has(index);
  if(collapse)instrumentView.collapsed.add(index);else instrumentView.collapsed.delete(index);
  row.classList.toggle('collapsed',collapse);button.setAttribute('aria-expanded',String(!collapse));
  select();
 };
 row.onclick=e=>{if(!(e.target as HTMLElement).closest?.('button,select,input,label,summary'))select();};
 const beginRename=()=>{if(row.querySelector('.instrument-rename-field'))return;const field=document.createElement('input');field.type='text';field.className='instrument-rename-field';field.value=i.name;field.setAttribute('aria-label','Rename '+i.name);button.after(field);field.focus({preventScroll:true});field.select();let done=false;const finish=(save:boolean)=>{if(done)return;done=true;if(save&&field.value.trim()&&i.name!==field.value.trim()){checkpoint();i.name=field.value.trim();}instruments();};field.onblur=()=>finish(true);field.onkeydown=e=>{if(e.key==='Enter')finish(true);if(e.key==='Escape')finish(false);};};
 const preset=document.createElement('select');preset.title='General MIDI playback instrument';preset.setAttribute('aria-label','Playback preset for '+i.name);GM_PROGRAMS.forEach((name,program)=>{const option=document.createElement('option');option.value=String(program);option.textContent=`${program+1}. ${name}`;preset.append(option);});
 const drums=document.createElement('option');drums.value='drums';drums.textContent=`${DRUM_KIT_NAME} (not valid in MS2)`;preset.append(drums);
 for(const [key,drum] of Object.entries(MS2_DRUMS)){const option=document.createElement('option');option.value=key;option.textContent=drum.name;preset.append(option);}
 const instructions=document.createElement('option');instructions.value='instructions';instructions.textContent='Instructions (silent)';preset.append(instructions);
 preset.value=i.isInstructions?'instructions':i.isDrum?'drums':i.ms2Drum??String(i.midiProgram??0);preset.onchange=()=>{checkpoint();delete i.ms2Drum;if(preset.value in MS2_DRUMS)i.ms2Drum=preset.value as Ms2Drum;i.isDrum=preset.value==='drums';i.isInstructions=preset.value==='instructions';i.midiProgram=i.isDrum||i.isInstructions||i.ms2Drum?0:Number(preset.value);if(i.isInstructions)i.name=INSTRUCTIONS_NAME;if(i.ms2Drum)i.name=MS2_DRUMS[i.ms2Drum].name;instruments();updateMml(true);info();draw();};
 row.append(color,button,preset);$('instruments').append(row);
 if(i.isDrum){const warning=document.createElement('small');warning.className='instrument-warning';warning.textContent=DRUM_MS2_WARNING;row.append(warning);}
 if(i.isInstructions){const help=document.createElement('small');help.className='instrument-help';help.textContent='Silent events. Draw a marker, then edit its tempo. Yellow lines indicate changes.';row.append(help);}
 const controls=document.createElement('div');controls.className='instrument-controls';
 const changed=()=>{state.selection.clear();updatePlaybackMutes();instruments();info();draw();};
 const muted=instrumentView.muted.has(index),soloed=instrumentView.solo===index;
 const mute=document.createElement('button');
 mute.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/>${muted?'<path d="m22 9-6 6"/><path d="m16 9 6 6"/>':'<path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/>'}</svg><span>Mute</span>`;
 mute.title=(muted?'Unmute ':'Mute ')+i.name;mute.setAttribute('aria-label',mute.title);mute.setAttribute('aria-pressed',String(muted));mute.classList.toggle('active',muted);
 mute.onclick=()=>{if(muted)instrumentView.muted.delete(index);else{instrumentView.muted.add(index);if(soloed)instrumentView.solo=null;}changed();};
 const solo=document.createElement('button');
 solo.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg><span>Solo</span>';
 solo.title=(soloed?'Stop soloing ':'Solo ')+i.name;solo.setAttribute('aria-label',solo.title);solo.setAttribute('aria-pressed',String(soloed));solo.classList.toggle('active',soloed);
 solo.onclick=()=>{instrumentView.solo=soloed?null:index;if(!soloed)instrumentView.muted.delete(index);changed();};
 controls.append(mute,solo);row.append(controls);
 row.classList.toggle('collapsed',collapsed);
 const remove=document.createElement('button');remove.className='instrument-row-delete';remove.title='Delete '+i.name;remove.setAttribute('aria-label','Delete '+i.name);remove.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>';remove.onclick=()=>removeInstrument(index);row.append(remove);
 const rename=document.createElement('button');rename.className='instrument-row-rename';rename.title='Rename '+i.name;rename.setAttribute('aria-label','Rename '+i.name);rename.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';rename.onclick=beginRename;row.append(rename);
 mmlControls(row,index);
 instrumentActions(row,index);
 });
 panel.scrollTop=scroll;
 // Selects are wrapped by a MutationObserver, which runs after this returns and moves the scroll again.
 queueMicrotask(()=>{panel.scrollTop=scroll;});
}

export function installInstruments(){
$('add').onclick=()=>{checkpoint();state.project.instruments.push({name:`Instrument ${state.project.instruments.length+1}`,color:colors[state.project.instruments.length%colors.length],midiProgram:0});state.active=state.project.instruments.length-1;state.selection.clear();refresh();};


}
