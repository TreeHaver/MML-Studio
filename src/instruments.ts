import {mmlControls,updateMml} from './mml.ts';
import {colorSwatch,closeColorPanel} from './color-picker.ts';
import {instrumentActions,removeInstrument} from './instrument-actions.ts';
import {GM_PROGRAMS} from './playback/gm-programs.ts';
import {VANILLA_PROGRAMS} from './playback/vanilla-instruments.ts';
import {DRUM_KIT_NAME,DRUM_MS2_WARNING,MS2_DRUMS,type Ms2Drum} from './playback/drums.ts';
import {syncAdvancedInstructions,instructionCard} from './advanced-instructions.ts';
import {draw} from './painting.ts';
import {info} from './inspector.ts';
import {checkpoint} from './history.ts';
import {refresh} from './commands.ts';
import {$,view} from './dom.ts';
import {pitchTop} from './pitch-viewport.ts';
import {updatePlaybackMutes,updatePlaybackVoices} from './playback/transport.ts';
import {state,instrumentView,instrumentSelected,selectInstrument} from './state.ts';
import {colors} from './model/project.ts';
import {name} from './music/pitch.ts';

export function instruments(){
 // Rebuilding the list empties its scroll container, which would reset the scroll position.
 // A colour panel anchored to a swatch that is about to be replaced would be orphaned.
 closeColorPanel();
 const panel=$('track-panel'),scroll=panel.scrollTop;
 syncAdvancedInstructions();
 $('instrument-count').textContent=String(state.project.instruments.filter(i=>!i.isInstructions).length);
 // An imported project can carry dozens of tracks: the search narrows the list by name,
 // matching the whole stored name, not the shortened one on screen.
 const query=instrumentView.search.trim().toLowerCase();
 const shown=(name:string)=>!query||name.toLowerCase().includes(query);
 $('instruments').replaceChildren();state.project.instruments.forEach((i,index)=>{
 if(i.isInstructions){if(shown(i.name))$('instruments').append(instructionCard(index));return;}
 if(!shown(i.name))return;
 const row=document.createElement('div');row.className='instrument';row.classList.toggle('selected',instrumentSelected(index));const color=colorSwatch(i.color,'Color for '+i.name,value=>{checkpoint();i.color=value;draw();});
 row.dataset.instrument=String(index);
 const collapsed=instrumentView.collapsed.has(index);
 const button=document.createElement('button');button.textContent=shortName(i.name)+(instrumentView.muted.has(index)?' (muted)':'');button.className='instrument-name';button.classList.toggle('active',index===state.active);
 button.title=i.name+' · Ctrl+click to toggle · Shift+click to select a range · click again to collapse';button.setAttribute('aria-expanded',String(!collapsed));
 const select=(toggle=false,range=false)=>{
  if(state.gesture)return;
  selectInstrument(index,toggle,range);instruments();info();draw();
 };
 button.onclick=e=>{
  const collapse=!e?.ctrlKey&&!e?.shiftKey&&state.selectedInstruments.size===0&&index===state.active&&!instrumentView.collapsed.has(index);
  if(collapse)instrumentView.collapsed.add(index);else instrumentView.collapsed.delete(index);
  row.classList.toggle('collapsed',collapse);button.setAttribute('aria-expanded',String(!collapse));
  select(!!e?.ctrlKey,!!e?.shiftKey);
 };
 row.onclick=e=>{if(!(e.target as HTMLElement).closest?.('button,select,input,label,summary'))select(e.ctrlKey,e.shiftKey);};
 const beginRename=()=>{if(row.querySelector('.instrument-rename-field'))return;const field=document.createElement('input');field.type='text';field.className='instrument-rename-field';field.value=i.name;field.setAttribute('aria-label','Rename '+i.name);button.after(field);field.focus({preventScroll:true});field.select();let done=false;const finish=(save:boolean)=>{if(done)return;done=true;if(save&&field.value.trim()&&i.name!==field.value.trim()){checkpoint();i.name=field.value.trim();}instruments();};field.onblur=()=>finish(true);field.onkeydown=e=>{if(e.key==='Enter')finish(true);if(e.key==='Escape')finish(false);};};
 const selected=i.isDrum?'drums':i.ms2Drum??String(i.midiProgram??0);
 const preset=document.createElement('select');preset.title='Playback instrument';preset.setAttribute('aria-label','Playback preset for '+i.name);
 // The warning rides in the tooltip rather than in the label: spelled out, it was the
 // longest line in the list and stretched the whole panel to fit it.
 // Only the chosen preset is built now; the other 150 are built the first time the list is
 // opened. A project with eighty instruments was making twenty thousand option elements on
 // every edit - the panel is rebuilt whenever anything changes, drawing a note included.
 const choices:{value:string,label:string,excluded:boolean,note:string}[]=[];
 const buildOption=(choice:{value:string,label:string,excluded:boolean,note:string})=>{
  const option=document.createElement('option');option.value=choice.value;option.textContent=choice.label;
  // Keep an excluded current value in the closed field, but not among selectable choices.
  option.hidden=choice.excluded;option.disabled=choice.excluded;if(choice.note)option.title=choice.note;
  option.classList.toggle('preset-warning',choice.value==='drums'||choice.excluded);
  return option;
 };
 const addPreset=(value:string,label:string,vanilla:boolean,note='')=>{
  const excluded=instrumentView.vanillaOnly&&!vanilla;
  if(excluded&&value!==selected)return;
  const choice={value,label,excluded,note};choices.push(choice);
  if(value===selected){preset.append(buildOption(choice));preset.classList.toggle('preset-warning',value==='drums'||excluded);}
 };
 GM_PROGRAMS.forEach((name,program)=>addPreset(String(program),`${program+1}. ${VANILLA_PROGRAMS[program]??name}`,program in VANILLA_PROGRAMS));
 addPreset('drums',DRUM_KIT_NAME,false,DRUM_MS2_WARNING);
 // The MS2 drums are described alongside the rest, and built with them when the list opens.
 for(const [key,drum] of Object.entries(MS2_DRUMS)){const choice={value:key,label:drum.name,excluded:false,note:''};choices.push(choice);if(key===selected)preset.append(buildOption(choice));}
 // Rebuilt in order, with the chosen value kept, so the list reads the same as it always did.
 (preset as any).fillOptions=()=>{
  if(preset.children.length>=choices.length)return;
  preset.replaceChildren(...choices.map(buildOption));preset.value=selected;
 };
 preset.value=selected;preset.onchange=()=>{if(preset.value!=='drums'&&!(preset.value in MS2_DRUMS)&&!/^\d+$/.test(preset.value))return;checkpoint();delete i.ms2Drum;if(preset.value in MS2_DRUMS)i.ms2Drum=preset.value as Ms2Drum;i.isDrum=preset.value==='drums';i.midiProgram=i.isDrum||i.ms2Drum?0:Number(preset.value);if(i.ms2Drum)i.name=MS2_DRUMS[i.ms2Drum].name;void updatePlaybackVoices();instruments();updateMml(true);info();draw();};
 row.append(color,button,preset);$('instruments').append(row);
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
 const volumeRow=document.createElement('label');volumeRow.className='instrument-gain';
 const volumeText=document.createElement('span');volumeText.textContent='Volume';
 const gain=document.createElement('input');gain.type='range';gain.min='0';gain.max='100';gain.step='1';gain.value=String(i.volume??100);gain.setAttribute('aria-label','Volume for '+i.name);
 const value=document.createElement('output');value.textContent=gain.value+'%';
 let editing=false;
 gain.oninput=()=>{const percent=Math.max(0,Math.min(100,Number(gain.value)||0));if(percent===(i.volume??100))return;if(!editing){checkpoint();editing=true;}i.volume=percent;value.textContent=percent+'%';updatePlaybackMutes();};
 gain.onchange=()=>{editing=false;};
 volumeRow.append(volumeText,gain,value);row.append(volumeRow);
 row.classList.toggle('collapsed',collapsed);
 const remove=document.createElement('button');remove.className='instrument-row-delete';remove.title='Delete '+i.name;remove.setAttribute('aria-label','Delete '+i.name);remove.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>';remove.onclick=()=>removeInstrument(index);row.append(remove);
 const rename=document.createElement('button');rename.className='instrument-row-rename';rename.title='Rename '+i.name;rename.setAttribute('aria-label','Rename '+i.name);rename.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';rename.onclick=beginRename;row.append(rename);
 mmlControls(row,instrumentActions(row,index),index);
 });
 if(!state.project.instruments.some(i=>i.isInstructions)&&shown('Instructions'))$('instruments').append(instructionCard());
 ($('instrument-empty') as HTMLElement).hidden=!!$('instruments').children.length||!query;
 panel.scrollTop=scroll;
 // Selects are wrapped by a MutationObserver, which runs after this returns and moves the scroll again.
 queueMicrotask(()=>{panel.scrollTop=scroll;});
}

/**
 * A MIDI import names every track after the song, so the screen fills with the same words:
 * 'Off The Wall - Ch 14 - Electric Guitar'. The tail is what tells them apart, so the first
 * part is dropped from the label and the whole name stays in the tooltip and in the search.
 */
export function shortName(name:string){
 const parts=name.split(' · ');
 return parts.length>2?parts.slice(1).join(' · '):name;
}
export function installInstruments(){
$('vanilla-only').onclick=()=>{instrumentView.vanillaOnly=!instrumentView.vanillaOnly;$('vanilla-only').setAttribute('aria-pressed',String(instrumentView.vanillaOnly));instruments();};
const search=$('instrument-search') as HTMLInputElement;
search.oninput=()=>{instrumentView.search=search.value;instruments();};
// One switch for the lot: collapse them all, or open them all if they are already collapsed.
$('collapse-all').onclick=()=>{
 const musical=state.project.instruments.map((i,index)=>({i,index})).filter(entry=>!entry.i.isInstructions).map(entry=>entry.index);
 const anyOpen=musical.some(index=>!instrumentView.collapsed.has(index));
 if(anyOpen)for(const index of musical)instrumentView.collapsed.add(index);else instrumentView.collapsed.clear();
 ($('collapse-all') as HTMLButtonElement).setAttribute('aria-pressed',String(anyOpen));
 instruments();
};
$('add').onclick=()=>{checkpoint();const count=state.project.instruments.filter(i=>!i.isInstructions).length;state.project.instruments.push({name:`Instrument ${count+1}`,color:colors[count%colors.length],midiProgram:0});state.active=state.project.instruments.length-1;state.selectedInstruments.clear();state.selection.clear();refresh();};


}

