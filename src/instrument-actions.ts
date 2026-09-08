import {state,instrumentView,resetInstrumentView} from './state.ts';
import {checkpoint} from './history.ts';
import {refresh} from './commands.ts';
import {status} from './dom.ts';
import {stopPlayback} from './playback/transport.ts';
import {deleteInstrument,mergeInstruments,splitNotes,splitDrumkit,parseSplitPitch,instrumentVolumes,shiftInstrumentVolumes,MAX_VOLUME} from './model/instrument-operations.ts';
import type {Project} from './model/types.ts';
import {removeSegmentInstrument} from './segment-session.ts';

function apply(project:Project,source:number,active:number){
 stopPlayback(false);checkpoint();
 const muted=[...instrumentView.muted],collapsed=[...instrumentView.collapsed],solo=instrumentView.solo;
 resetInstrumentView();
 if(state.project.instruments.length>1){
  for(const [values,set] of [[muted,instrumentView.muted],[collapsed,instrumentView.collapsed]] as const)
   for(const index of values)if(index!==source)set.add(index>source?index-1:index);
  if(solo!==null&&solo!==source)instrumentView.solo=solo>source?solo-1:solo;
 }
 removeSegmentInstrument(source);state.project=project;state.active=active;state.selection.clear();state.gesture=null;refresh();
}
export function removeInstrument(index:number){
 const instrument=state.project.instruments[index];if(!instrument||instrument.isInstructions)return;
 const notes=state.project.notes.filter(n=>n.instrument===index),tempos=notes.filter(n=>n.tempo!=null).length;
 const contents=`${notes.length} notes/events${tempos?`, including ${tempos} global tempo instructions`:''}`,last=state.project.instruments.filter(i=>!i.isInstructions).length===1;
 if(state.segment){
  if(!notes.length){status('This instrument has no notes in the current view.');return;}
  if(!confirm(`Remove ${contents} from “${instrument.name}” in this view?\nThe shared instrument and notes outside this view remain. You can undo this.`))return;
  stopPlayback(false);checkpoint();state.project.notes=state.project.notes.filter(n=>n.instrument!==index);state.selection.clear();state.gesture=null;refresh();status(`Cleared “${instrument.name}” inside this view. Undo to restore.`);return;
 }
 if(notes.length&&!confirm(last
  ?`“${instrument.name}” is the only instrument, so it cannot be deleted — it will be emptied instead.\nIts ${contents} will be cleared and it will be reset to an empty Piano.\nYou can undo this.`
  :`Delete “${instrument.name}” and its ${contents}?\nYou can undo this.`))return;
 if(last){stopPlayback(false);checkpoint();state.project=deleteInstrument(state.project,index);instrumentView.muted.delete(index);instrumentView.collapsed.delete(index);if(instrumentView.solo===index)instrumentView.solo=null;state.selection.clear();state.gesture=null;refresh();status(`Emptied “${instrument.name}”. Undo to restore it.`);return;}
 const active=state.active===index?Math.max(0,Math.min(index,state.project.instruments.length-2)):state.active>index?state.active-1:state.active;
 apply(deleteInstrument(state.project,index),index,active);status(`${last?'Emptied':'Deleted'} “${instrument.name}”. Undo to restore it.`);
}
export function mergeInstrument(source:number,target:number){
 try{
  const result=mergeInstruments(state.project,source,target),from=state.project.instruments[source],to=state.project.instruments[target];
  const count=state.project.notes.filter(n=>n.instrument===source).length;
  const scope=state.segment?' inside this view? Notes outside the view and the shared source instrument remain.':`, then delete “${from.name}”?`;
  if(!confirm(`Move all ${count} notes/events and their tempo instructions from “${from.name}” into “${to.name}”${scope}\nThe destination keeps its name, color, playback preset and mute state.\nYou can undo this.`))return;
  apply(result.project,source,target>source?target-1:target);status(`Merged “${from.name}” into “${to.name}”. Undo to restore both.`);
 }catch(error){status(String(error));}
}
/**
 * Raising a part by hand meant selecting its notes and editing them together, which is why
 * it was being done instrument by instrument. This moves them all by the same amount, so the
 * loud notes stay louder than the quiet ones, and it refuses a step that would push the
 * loudest note past V15: past the cap the difference is not raised, it is lost.
 */
export function shiftVolume(index:number,delta:number){
 const range=instrumentVolumes(state.project,index);
 if(!range){status('This instrument has no notes to change.');return;}
 if(delta>0&&range.headroom<=0){status(`The loudest note is already V${MAX_VOLUME}. Raising it further would flatten the difference between the notes.`);return;}
 if(delta<0&&range.min<=0){status('The quietest note is already V0. Lowering it further would flatten the difference between the notes.');return;}
 if(!delta){status('Type how much to move the volume by. Negative numbers lower it.');return;}
 const step=delta>0?Math.min(delta,range.headroom):Math.max(delta,-range.min);
 const trimmed=step!==delta;
 checkpoint();state.project={...state.project,notes:shiftInstrumentVolumes(state.project,index,step)};
 refresh();
 const after=instrumentVolumes(state.project,index)!;
 status(`${state.project.instruments[index].name}: volumes moved by ${step>0?'+':''}${step}${trimmed?` instead of ${delta>0?'+':''}${delta}, which would have pushed past the ends and flattened the difference`:''}. Now V${after.min} to V${after.max}.`);
}
export function instrumentActions(row:HTMLElement,index:number):HTMLElement{
 const box=document.createElement('details');box.className='instrument-actions';
 const summary=document.createElement('summary');summary.textContent='Instrument actions';
 const body=document.createElement('div');body.className='instrument-action-body';
 const destination=document.createElement('select');destination.className='instrument-destination';destination.setAttribute('aria-label','Merge destination for '+state.project.instruments[index].name);
 const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Merge into…';destination.append(placeholder);
 // Both destination lists name every other instrument, and every card carries them, so a
 // project with eighty instruments was building thousands of options on each rebuild - and
 // the panel is rebuilt whenever anything changes. They are filled when the list is opened.
 const others=state.project.instruments.map((instrument,other)=>({instrument,other})).filter(entry=>entry.other!==index&&!entry.instrument.isInstructions);
 (destination as any).fillOptions=()=>{
  if(destination.children.length>1)return;
  for(const {instrument,other} of others){const option=document.createElement('option');option.value=String(other);option.textContent=`${other+1}. ${instrument.name}`;destination.append(option);}
  destination.value='';
 };
 destination.value='';destination.disabled=!others.length;
 destination.title=destination.disabled?'Add another instrument of the same kind to merge.':'Destination keeps its sound and settings.';
 // Both ends are reported: the loudest says how much room is left under the cap, and the
 // quietest says how much room is left above silence, which is the same question downwards.
 const range=instrumentVolumes(state.project,index);
 const volumeRow=document.createElement('div');volumeRow.className='instrument-volume';
 const reading=document.createElement('span');reading.className='instrument-volume-reading';
 reading.textContent=range?`V${range.min} to V${range.max} of ${MAX_VOLUME}`:'No notes yet';
 reading.title=range?`Quietest note V${range.min}, loudest V${range.max}. Room for ${range.headroom} more before the loudest reaches the cap, and ${range.min} before the quietest reaches silence.`:'Draw a note to set a volume.';
 const amount=document.createElement('input');amount.type='number';amount.className='instrument-volume-amount';
 amount.min=String(-MAX_VOLUME);amount.max=String(MAX_VOLUME);amount.step='1';amount.value='1';
 amount.setAttribute('aria-label','Volume change for '+state.project.instruments[index].name);
 amount.title='How much to move every note by. Negative lowers.';
 const apply=document.createElement('button');apply.type='button';apply.textContent='Apply';
 apply.title='Move every note of this instrument by this much, keeping the differences between them';
 apply.onclick=()=>shiftVolume(index,Math.round(Number(amount.value)||0));
 const toCap=document.createElement('button');toCap.type='button';toCap.textContent='Max';
 toCap.title='Raise every note until the loudest reaches V'+MAX_VOLUME;
 toCap.disabled=!range||range.headroom<=0;
 toCap.onclick=()=>{const room=instrumentVolumes(state.project,index);if(room)shiftVolume(index,room.headroom);};
 volumeRow.append(reading,amount,apply,toCap);
 body.append(volumeRow);
 const merge=document.createElement('button');merge.textContent='Merge';merge.disabled=true;merge.onclick=()=>{if(destination.value!=='')mergeInstrument(index,Number(destination.value));};destination.onchange=()=>{merge.disabled=destination.value==='';};

 if(!state.project.instruments[index].isInstructions){
  const label=document.createElement('label');label.className='instrument-split-label';label.textContent='Split Notes';
  const pitch=document.createElement('input');pitch.type='text';pitch.placeholder='B1';pitch.setAttribute('aria-label','Note to split');label.append(pitch);
  const target=document.createElement('select');target.setAttribute('aria-label','Split destination instrument');
  const empty=document.createElement('option');empty.value='';empty.textContent='Instruments…';target.append(empty);
  (target as any).fillOptions=()=>{
  if(target.children.length>1)return;
  for(const {instrument,other} of others){const option=document.createElement('option');option.value=String(other);option.textContent=instrument.name;target.append(option);}
  target.value='';
 };
  target.value='';
  const split=document.createElement('button');split.textContent='Split';split.onclick=()=>{if(target.value===''){status('Choose a destination instrument.');return;}splitInstrumentNote(index,Number(target.value),pitch.value);};
  body.append(label,target,split);
  if(state.project.instruments[index].isDrum){const kit=document.createElement('button');kit.className='instrument-split-kit';kit.textContent='Split Drumkit';kit.onclick=()=>splitKitInstrument(index);body.append(kit);}
 }
 body.append(destination,merge);box.append(summary,body);row.append(box);return body;
}

function applySplit(project:Project,count:number){
 if(!count){status('No matching notes to split.');return;}
 stopPlayback(false);checkpoint();state.project=project;state.selection.clear();state.gesture=null;refresh();status('Moved '+count+' notes. Undo to restore.');
}
export function splitInstrumentNote(source:number,target:number,text:string){
 try{const result=splitNotes(state.project,source,target,parseSplitPitch(text));
 applySplit(result.project,result.count);
 }catch(error){status(String(error));}
}
export function splitKitInstrument(source:number){
 try{const result=splitDrumkit(state.project,source);applySplit(result.project,result.count);}catch(error){status(String(error));}
}
