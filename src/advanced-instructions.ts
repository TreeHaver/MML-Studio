import {$} from './dom.ts';
import {state,instrumentView} from './state.ts';
import {ensureInstructions,hasInstructions,INSTRUCTIONS_NAME} from './model/instructions.ts';
import {refresh} from './commands.ts';
import {fullProject} from './segment-session.ts';

// The dedicated lane is always available. An unused lane needs no version-2 record;
// materialize it on selection, using the same owner as imports and structure edits.
export const advancedInstructions={enabled:false,hadInstructions:false};
export function resetAdvancedInstructions(){advancedInstructions.enabled=false;advancedInstructions.hadInstructions=false;}
export function syncAdvancedInstructions(){
 const present=hasInstructions(fullProject());
 if(present&&!advancedInstructions.hadInstructions)advancedInstructions.enabled=true;
 advancedInstructions.hadInstructions=present;
 $('advanced-instructions').setAttribute('aria-pressed',String(advancedInstructions.enabled));
}
export function instructionCard(index=state.project.instruments.findIndex(i=>i.isInstructions)){
 const row=document.createElement('div');row.className='instrument instructions-lane';row.hidden=!advancedInstructions.enabled;
 row.classList.toggle('selected',index>=0&&state.active===index);row.dataset.instrument=String(index);
 const button=document.createElement('button');button.className='instrument-name';button.textContent=INSTRUCTIONS_NAME;
 button.classList.toggle('active',index>=0&&state.active===index);
 const collapsed=index>=0&&instrumentView.collapsed.has(index);row.classList.toggle('collapsed',collapsed);
 button.setAttribute('aria-expanded',String(!collapsed));
 button.onclick=()=>{
  const lane=ensureInstructions(state.project);
  if(state.active===lane&&!instrumentView.collapsed.has(lane))instrumentView.collapsed.add(lane);else instrumentView.collapsed.delete(lane);
  state.active=lane;state.selection.clear();refresh();
 };
 const help=document.createElement('small');help.className='instrument-help';help.textContent='Always active. Draw a marker, then edit tempo, time signature, section or loops in the inspector.';
 row.append(button,help);return row;
}
export function installAdvancedInstructions(){
 $('advanced-instructions').onclick=()=>{
  advancedInstructions.enabled=!advancedInstructions.enabled;
  if(!advancedInstructions.enabled&&state.project.instruments[state.active]?.isInstructions){
   const musical=state.project.instruments.findIndex(i=>!i.isInstructions);
   if(musical>=0){state.active=musical;state.selection.clear();}
  }
  refresh();
 };
}
