import {expandLoops} from './music/loops.ts';
import {exportSegments} from './music/structure.ts';
import {state} from './state.ts';
import {createSheetPlanner,ms2Xml} from './music/sheets.ts';
import {compilePlayback} from './playback/midi.ts';
import {$,status} from './dom.ts';
import {sheetSettings,setCharacterLimit} from './sheet-settings.ts';
import {draw} from './painting.ts';

type Choice='single'|'parts'|'cancel';
function choose(name:string,bytes:number,limit:number):Promise<Choice>{
 const dialog=$('export-limit-dialog') as HTMLDialogElement;
 $('export-limit-message').textContent=`${name} uses ${bytes.toLocaleString()} characters, exceeding your ${limit.toLocaleString()} character limit. Do you still wish to export?`;
 return new Promise(resolve=>{
  let done=false,chosen:Choice='cancel';const finish=(choice:Choice)=>{if(done)return;done=true;chosen=choice;dialog.close();};
  $('export-limit-single').onclick=()=>finish('single');$('export-limit-parts').onclick=()=>finish('parts');$('export-limit-no').onclick=()=>finish('cancel');
  dialog.oncancel=e=>{e.preventDefault();finish('cancel');};dialog.onclose=()=>{dialog.onclose=null;resolve(chosen);};dialog.showModal();
 });
}
/** Channels are pasted one at a time in game, so plain text keeps them visibly apart. */
const SEPARATOR='\n\n';
export function installExport(){
 const input=$('character-limit') as HTMLInputElement;input.value=String(sheetSettings.limit);
 input.onchange=()=>{if(!setCharacterLimit(Number(input.value))){input.value=String(sheetSettings.limit);status('Character limit must be a positive whole number.');return;}draw();status(`Character limit set to ${sheetSettings.limit.toLocaleString()}. The red line marks the selected instrument’s first sheet boundary.`);};
 let exporting=false;
 const action=$('export-run') as HTMLButtonElement;
 // Export asks how to export, so it is a dialog. The limit dialog opens on top of it.
 const dialog=$('export-dialog') as HTMLDialogElement;
 $('export-open').onclick=()=>{
  // The scope reads as a sentence, so it names the instrument it would export.
  $('scope-name').textContent=state.project.instruments[state.active]?.name||'the selected instrument';
  dialog.showModal();
 };
 $('export-cancel').onclick=()=>dialog.close();
 // Each format names what it writes; the two buttons remain the choice of how much to write.
 const sheetFormats:Record<string,{ext:string,render:(channels:string[])=>string}>={
  ms2mml:{ext:'.ms2mml',render:channels=>ms2Xml(channels)},
  text:{ext:'.txt',render:channels=>channels.join(SEPARATOR)+'\n'}
 };
 const FORMATS=['ms2mml','text','midi'];
 const chosenFormat=()=>FORMATS.find(name=>($('format-'+name) as HTMLInputElement|null)?.checked)??'ms2mml';
 const run=async(projectExport:boolean)=>{
  if(exporting)return;exporting=true;action.disabled=true;dialog.close();
  try{
   const format=chosenFormat();
   const project=structuredClone(state.project),limit=sheetSettings.limit;
   const indexes=projectExport?project.instruments.map((_,i)=>i):[state.active];
   const separate=!state.segment&&($('export-sections') as HTMLInputElement).checked;
   const segments=exportSegments(separate?expandLoops(project).project:project,separate);
   const prefixed=(segmentName:string,stem:string)=>{const prefix=state.segment?.projection.range.name??segmentName;return (prefix?prefix+'-':'')+stem;};
   // MIDI is a performance rather than a sheet: one file per scope, and no character limit.
   if(format==='midi'){
    let count=0;
    for(const segment of segments){
     const instructions=(index:number)=>!!segment.project.instruments[index]?.isInstructions;
     // Instructions carry the tempo changes, so they travel with a single instrument too.
     const notes=projectExport?segment.project.notes:segment.project.notes.filter(n=>n.instrument===state.active||instructions(n.instrument));
     if(!notes.some(n=>!instructions(n.instrument)))continue;
     const stem=prefixed(segment.name,projectExport?(project.name?.trim()||'Project'):project.instruments[state.active].name);
     const binary=compilePlayback({...segment.project,notes}).binary;
     if(!await (window as any).files.exportMidi(stem+'.mid',new Uint8Array(binary))){status(`Export canceled after saving ${count} file${count===1?'':'s'}.`);return;}
     count++;
    }
    if(!count){status('No notes to export.');return;}
    status(`Exported ${count} MIDI file${count===1?'':'s'}.`);return;
   }
   const {ext,render}=sheetFormats[format]??sheetFormats.ms2mml;
   const files:{name:string,text:string}[]=[];
   for(const segment of segments)for(const index of indexes){
    if(segment.project.instruments[index].isInstructions||!segment.project.notes.some(n=>n.instrument===index))continue;
    const plan=createSheetPlanner(segment.project,index,limit),name=prefixed(segment.name,project.instruments[index].name);
    if(!plan.whole.channels.length)continue;
    const choice=plan.whole.bytes>limit?await choose(name,plan.whole.bytes,limit):'single';
    if(choice==='cancel'){status('Export canceled.');return;}
    if(choice==='parts'){
     const parts=plan.split();parts.forEach((part,i)=>files.push({name:`${name}-part-${String(i+1).padStart(2,'0')}${ext}`,text:render(part.channels)}));
    }else files.push({name:name+ext,text:render(plan.whole.channels)});
   }
   if(!files.length){status('No musical MML to export.');return;}
   const save=format==='text'?(window as any).files.exportText:(window as any).files.exportMml;
   let count=0;
   for(const file of files){if(!await save(file.name,file.text)){status(`Export canceled after saving ${count} of ${files.length} files.`);return;}count++;}
   status(`Exported ${count} file${count===1?'':'s'}.`);
  }catch(error){status('Export failed: '+error);}
  finally{exporting=false;action.disabled=false;}
 };
 action.onclick=()=>run(($('scope-all') as HTMLInputElement).checked);
}
