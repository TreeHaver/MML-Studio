import {importMml} from './import/mml.ts';
import {ensureInstructions} from './model/instructions.ts';
import {state,isMuted} from './state.ts';
import {checkpoint} from './history.ts';
import {refresh} from './commands.ts';
import {status} from './dom.ts';
import {valid} from './model/validation.ts';
import type {Note} from './model/types.ts';

let clipboard:{notes:Note[],instructions:boolean,span:number}|null=null;
let position:number|null=null;
export function setPastePosition(tick:number){position=tick;status('Paste position set. Ctrl+V pastes into the active instrument.');}
export function copyNotes(){
 if(state.gesture)return;
 const selected=state.project.notes.filter(n=>n.instrument===state.active&&state.selection.has(n.id));
 if(!selected.length){status('Select notes to copy.');return;}
 const start=selected.reduce((min,n)=>Math.min(min,n.start),Infinity),end=selected.reduce((max,n)=>Math.max(max,n.start+n.length),0);
 const lane=state.project.notes.filter(n=>n.instrument===state.active).sort((a,b)=>a.start-b.start||a.id-b.id),volumes=new Map<number,number>();let volume=8;
 for(let a=0;a<lane.length;){let b=a;while(b<lane.length&&lane[b].start===lane[a].start){if(lane[b].volume!==null)volume=lane[b].volume!;b++;}for(;a<b;a++)volumes.set(lane[a].id,volume);}
 clipboard={notes:selected.map(n=>({...n,start:n.start-start,volume:volumes.get(n.id)!})),instructions:!!state.project.instruments[state.active].isInstructions,span:end-start};
 position=end;status(`Copied ${selected.length} notes/events. Ctrl+V pastes after this group, or click empty space in Select mode to choose a position.`);
}
export function pasteNotes(){
 if(state.gesture)return;
 if(!clipboard){status('Copy a selection with Ctrl+C first.');return;}
 if(isMuted(state.active)){status('Unmute this instrument to paste notes.');return;}
 if(clipboard.instructions!==!!state.project.instruments[state.active].isInstructions){status('Paste musical notes into a musical instrument, or silent events into Instructions.');return;}
 let id=state.project.notes.reduce((max,n)=>Math.max(max,n.id),0);
 const start=position??0,added=clipboard.notes.map(n=>({...n,id:++id,instrument:state.active,start:start+n.start}));
 const notes=[...state.project.notes,...added];
 if(!valid(notes)){status('Cannot paste here: the copied tempo instructions conflict with an existing tempo change.');return;}
 checkpoint();state.project.notes=notes;state.selection=new Set(added.map(n=>n.id));position=start+clipboard.span;refresh();
 status(`Pasted ${added.length} notes/events. Drag the selected group to move it; Undo restores the previous project.`);
}

export function pasteMml(text:string):boolean{
 if(!text.trim())return false;
 try{
  const imported=importMml(text);
  if(state.gesture||isMuted(state.active)||state.project.instruments[state.active].isInstructions){status('Select an unmuted musical instrument to paste MML.');return true;}
  const project=structuredClone(state.project),start=position??0;
  let id=project.notes.reduce((max,n)=>Math.max(max,n.id),0);
  const added=imported.project.notes.map(n=>({...n,id:++id,start:start+n.start,instrument:imported.project.instruments[n.instrument].isInstructions?ensureInstructions(project):state.active}));
  project.notes.push(...added);
  if(!valid(project.notes)){status('Cannot paste MML: conflicting global tempo instructions.');return true;}
  checkpoint();state.project=project;state.selection=new Set(added.map(n=>n.id));position=start+imported.span;refresh();
  status('Pasted '+imported.noteCount+' MML notes. '+imported.warnings.join(' '));return true;
 }catch(error){status('Text is not supported MML: '+error);return false;}
}
