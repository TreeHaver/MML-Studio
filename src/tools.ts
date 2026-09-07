import {$,input,status} from './dom.ts';
import {state} from './state.ts';
import {commitNotes} from './commands.ts';
import {valid} from './model/validation.ts';
import {simplifyTiming} from './music/simplify-timing.ts';
import {removeOverlap} from './music/remove-overlap.ts';

export function installTools(){
 $('remove-overlap').onclick=()=>{
  if(state.project.instruments[state.active].isInstructions){status('Select a musical instrument to remove note overlap.');return;}
  const result=removeOverlap(state.project,state.active);
  if(result.changed)commitNotes(result.notes);
  status(`Remove overlap: ${result.changed} notes shortened.${result.duplicates?` ${result.duplicates} simultaneous duplicates kept because cutting them would give zero length.`:''}`);
 };
 input('simplify-length').value='64';
 $('simplify-timing').onclick=()=>{
  if(state.project.instruments[state.active].isInstructions){status('Select a musical instrument to simplify its notes.');return;}
  const length=Number(input('simplify-length').value),range=state.segment?.projection.range;
  const result=simplifyTiming(state.project,state.active,length,range?range.end-range.start:Infinity);
  if(!valid(result.notes)){status('Timing unchanged: rounding would create conflicting instructions.');return;}
  if(result.changed)commitNotes(result.notes);
  status(`Simplify Timing L${length}: ${result.changed} notes changed; ${result.skipped} skipped to preserve notes that cannot fit. Undo restores the original timing.`);
 };
}
