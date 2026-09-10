import {expandLoops} from './music/loops.ts';
import {exportSegments} from './music/structure.ts';
import {playbackSettings} from './playback/transport.ts';
import {state,isMuted} from './state.ts';
import {createSheetPlanner,ms2Xml} from './music/sheets.ts';
import {createLazyEnsemble} from './music/lazy-ensemble.ts';
import {fitExportChannels} from './music/export-fit.ts';
import {compilePlayback} from './playback/midi.ts';
import {$,status} from './dom.ts';
import {sheetSettings,setCharacterLimit} from './sheet-settings.ts';
import {draw} from './painting.ts';

type Choice='single'|'parts'|'cancel';
type ChannelChoice='cancel'|'continue'|'fit';
function chooseChannels(name:string,channels:number):Promise<ChannelChoice>{
 const dialog=$('export-channel-dialog') as HTMLDialogElement;
 $('export-channel-message').textContent=`${name} requires ${channels} channels, exceeding the 10-channel limit for one MS2 sheet. In-game playback may be incomplete or incorrect.`;
 return new Promise(resolve=>{
  let done=false,chosen:ChannelChoice='cancel';
  const finish=(choice:ChannelChoice)=>{if(done)return;done=true;chosen=choice;dialog.close();};
  $('export-channel-cancel').onclick=()=>finish('cancel');
  $('export-channel-continue').onclick=()=>finish('continue');
  $('export-channel-fit').onclick=()=>finish('fit');
  dialog.oncancel=e=>{e.preventDefault();finish('cancel');};
  dialog.onclose=()=>{dialog.onclose=null;resolve(chosen);};dialog.showModal();
 });
}
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
  refreshFormat();dialog.showModal();
 };
 $('export-cancel').onclick=()=>dialog.close();
 // Each format names what it writes; the two buttons remain the choice of how much to write.
 const sheetFormats:Record<string,{ext:string,render:(channels:string[])=>string}>={
  ms2mml:{ext:'.ms2mml',render:channels=>ms2Xml(channels)},
  text:{ext:'.txt',render:channels=>channels.join(SEPARATOR)+'\n'}
 };
 const FORMATS=['ms2mml','lazy','text','midi','audio'];
 // Loose files are ready to load in game; an archive is one attachment to send. Neither is
 // right for everyone, so the choice is offered once and kept.
 const zipKey='mml-studio-export-zip';
 const zipBox=$('export-zip') as HTMLInputElement;
 try{zipBox.checked=localStorage.getItem(zipKey)==='1';}catch{}
 zipBox.onchange=()=>{try{localStorage.setItem(zipKey,zipBox.checked?'1':'0');}catch{}};
 const asZip=()=>zipBox.checked;
 const chosenFormat=()=>FORMATS.find(name=>($('format-'+name) as HTMLInputElement|null)?.checked)??'ms2mml';
 const refreshFormat=()=>{
  const format=chosenFormat(),audio=format==='audio',performance=audio||format==='midi';
  // Unticked means the whole project, so the hint says what that means for this format.
  $('export-scope-hint').textContent=audio?'Left unticked, every instrument is rendered into one recording, with loops, playback speed, volume, mute and solo as you have them.':performance?'Left unticked, all instruments share one MIDI performance.':'Left unticked, each instrument is written as its own sheet: a band loads one file per player.';
  if(format==='lazy')$('export-scope-hint').textContent=`Combine the exported notes into one sound. Up to 10 players start at zero on the same timeline, with at most 10 channels and ${sheetSettings.limit.toLocaleString()} characters per player.`;
  $('export-compression-options').hidden=performance;
  $('export-section-options').hidden=audio||format==='lazy';$('export-zip-options').hidden=audio;
 };
 for(const format of FORMATS)$('format-'+format).onchange=refreshFormat;
 const audioDialog=$('audio-export-dialog') as HTMLDialogElement;
 const cancelAudio=()=>{(window as any).files.cancelAudioExport();$('audio-export-message').textContent='Canceling audio export…';};
 $('audio-export-cancel').onclick=cancelAudio;
 audioDialog.oncancel=e=>{e.preventDefault();cancelAudio();};
 (window as any).files?.onAudioProgress?.((fraction:number)=>{
  ($('audio-export-progress') as HTMLProgressElement).value=fraction;
  $('audio-export-message').textContent=fraction>=.99?'Finishing the recording and sound release…':`Rendering audio… ${Math.round(fraction*100)}%`;
 });
 const run=async(projectExport:boolean)=>{
  if(exporting)return;exporting=true;action.disabled=true;dialog.close();
  try{
   const format=chosenFormat(),extremeCompression=!!($('export-extreme') as HTMLInputElement).checked;
   const project=structuredClone(state.project),limit=sheetSettings.limit;
   if(format==='audio'){
    const active=state.active,range=state.segment?.projection.range;
    if(!project.notes.some(n=>!project.instruments[n.instrument]?.isInstructions&&(projectExport||n.instrument===active))){status('No notes to export.');return;}
    const muted=project.instruments.map((_,i)=>i).filter(i=>isMuted(i)||(!projectExport&&i!==active));
    const name=(range?range.name+'-':'')+(projectExport?(project.name?.trim()||'Project'):project.instruments[active].name);
    const request={project,minimumEnd:range?range.end-range.start:0,speed:playbackSettings.speed,volume:playbackSettings.volume,muted};
    $('audio-export-message').textContent='Choose the audio file type in the save dialog.';
    ($('audio-export-progress') as HTMLProgressElement).value=0;audioDialog.showModal();
    try{
     const result=await (window as any).files.exportAudio(name,request);
     status(result.canceled?'Audio export canceled.':`Exported ${result.format.toUpperCase()} audio (${result.seconds.toFixed(1)} seconds).${result.warnings.length?' '+result.warnings.join(' '):''}`);
    }finally{audioDialog.close();}
    return;
   }
   const indexes=projectExport?project.instruments.map((_,i)=>i):[state.active];
   const separate=format!=='lazy'&&!state.segment&&($('export-sections') as HTMLInputElement).checked;
   const segments=exportSegments(separate?expandLoops(project).project:project,separate);
   const prefixed=(segmentName:string,stem:string)=>{const prefix=state.segment?.projection.range.name??segmentName;return (prefix?prefix+'-':'')+stem;};
   // Every file is worked out first: how they are delivered depends on how many there are.
   const files:{name:string,text?:string,bytes?:Uint8Array}[]=[];
   let exportWarnings='';
   // MIDI is a performance rather than a sheet: one file per scope, and no character limit.
   if(format==='midi'){
    for(const segment of segments){
     const instructions=(index:number)=>!!segment.project.instruments[index]?.isInstructions;
     // Instructions carry the tempo changes, so they travel with a single instrument too.
     const notes=projectExport?segment.project.notes:segment.project.notes.filter(n=>n.instrument===state.active||instructions(n.instrument));
     if(!notes.some(n=>!instructions(n.instrument)))continue;
     const stem=prefixed(segment.name,projectExport?(project.name?.trim()||'Project'):project.instruments[state.active].name);
     files.push({name:stem+'.mid',bytes:new Uint8Array(compilePlayback({...segment.project,notes}).binary)});
    }
    if(!files.length){status('No notes to export.');return;}
   }else if(format==='lazy'){
    const range=state.segment?.projection.range;
    const ensemble=createLazyEnsemble(project,indexes,range?range.end-range.start:0,extremeCompression,limit);
    const name=prefixed('',projectExport?(project.name?.trim()||'Project'):project.instruments[state.active].name);
    ensemble.parts.forEach((part,i)=>files.push({name:`${name}-Lazy-Ensemble-${String(i+1).padStart(2,'0')}.ms2mml`,text:ms2Xml(part.channels)}));
    if(!files.length){status('No musical MML to export.');return;}
    exportWarnings=ensemble.warnings.length?' '+ensemble.warnings.join(' '):'';
   }else{
    const {ext,render}=sheetFormats[format]??sheetFormats.ms2mml;
    for(const segment of segments)for(const index of indexes){
     if(segment.project.instruments[index].isInstructions||!segment.project.notes.some(n=>n.instrument===index))continue;
     let plan=createSheetPlanner(segment.project,index,limit,extremeCompression);
     const name=prefixed(segment.name,project.instruments[index].name);
     if(!plan.whole.channels.length)continue;
     if(plan.whole.channels.length>10){
      const channelChoice=await chooseChannels(name,plan.whole.channels.length);
      if(channelChoice==='cancel'){status('Export canceled.');return;}
      if(channelChoice==='fit'){
       const fitted=fitExportChannels(segment.project,index);
       // Keep the original performance end after loop expansion or trimming.
       plan=createSheetPlanner(fitted.project,index,limit,extremeCompression,plan.end);
       if(plan.whole.channels.length>10)throw Error(`${name} still exceeds 10 channels. Export canceled; no files were saved.`);
       exportWarnings+=` ${name}: ${fitted.shortened} held notes shortened, ${fitted.removed} chord notes removed in the export copy.`;
      }
     }
     const choice=plan.whole.bytes>limit?await choose(name,plan.whole.bytes,limit):'single';
     if(choice==='cancel'){status('Export canceled.');return;}
     if(choice==='parts'){
      const parts=plan.split();parts.forEach((part,i)=>files.push({name:`${name}-part-${String(i+1).padStart(2,'0')}${ext}`,text:render(part.channels)}));
     }else files.push({name:name+ext,text:render(plan.whole.channels)});
    }
    if(!files.length){status('No musical MML to export.');return;}
   }
   // One file is one save dialog, as it always was. Several files would have meant one dialog
   // each, so the destination is chosen once: a folder of loose files ready to be loaded, or
   // a single archive to hand to somebody. The choice is the user's and it is remembered.
   if(files.length===1){
    const only=files[0];
    const save=only.bytes?(window as any).files.exportMidi:format==='text'?(window as any).files.exportText:(window as any).files.exportMml;
    status(await save(only.name,only.bytes??only.text)?`Exported ${only.name}.${exportWarnings}`:'Export canceled.');return;
   }
   const bundle=projectExport?(project.name?.trim()||'Project'):(project.instruments[state.active]?.name||'Instrument');
   const target=asZip()?await (window as any).files.exportZip(bundle,files):await (window as any).files.exportFolder(bundle,files);
   status(target?`Exported ${files.length} files to ${target}.${exportWarnings}`:'Export canceled.');
  }catch(error){status('Export failed: '+error);}
  finally{exporting=false;action.disabled=false;}
 };
 // One box, so there is one thing to decide: the whole project, or only what is selected.
 action.onclick=()=>run(!($('scope-selected') as HTMLInputElement).checked);
}
