import {importSong,type ImportedSong} from './import/source.ts';
import {appendImportedSongs} from './import/append.ts';
import {prepareImportTempos,importReport} from './import-ui.ts';
import {state} from './state.ts';
import {fullProject,historySnapshot,fitsCurrentView} from './segment-session.ts';
import {checkpoint} from './history.ts';
import {refresh} from './commands.ts';
import {stopPlayback} from './playback/transport.ts';
import {advancedInstructions} from './advanced-instructions.ts';
import {hasInstructions} from './model/instructions.ts';
import {status} from './dom.ts';
import {replaceWithImport} from './files.ts';

let importing=false;
export async function importDroppedFiles(files:File[]){
 if(!files.length||importing)return;
 importing=true;
 try{
  if(state.gesture)throw Error('Finish the current edit before dropping files.');
  const before=historySnapshot(),segment=state.segment,imported:ImportedSong[]=[];
  const replaceEmpty=!segment&&state.project.instruments.filter(i=>!i.isInstructions).length===1&&state.project.notes.length===0;
  status('Reading dropped files…');
  for(const file of files){
   if(!/\.(mid|midi|mml|ms2mml|mne|txt)$/i.test(file.name))throw Error(`Unsupported dropped file: ${file.name}. Drop MIDI, MML or MML text files.`);
   const bytes=await file.arrayBuffer();
   const song=importSong(new Uint8Array(bytes),file.name);prepareImportTempos(song,file.name,!replaceEmpty);imported.push(song);
  }
  if(state.gesture||segment!==state.segment||before!==historySnapshot())throw Error('The project changed while reading the files. Drop them again to import into the current project.');
  if(replaceEmpty){
   const merged=appendImportedSongs(imported[0].project,imported.slice(1).map(s=>s.project));
   replaceWithImport({project:merged.project,noteCount:imported.reduce((sum,s)=>sum+s.noteCount,0),warnings:[...imported.flatMap((s,i)=>s.warnings.map(w=>`${files[i].name}: ${w}`)),...merged.warnings]},files[0].name,files.map(f=>f.name).join(', '));
   return;
  }
  const result=appendImportedSongs(state.project,imported.map(s=>s.project));
  if(!fitsCurrentView(result.project))throw Error('The imported song extends beyond this view. Return to Project to import it.');
  fullProject(result.project); // Validate scoped reconciliation before checkpointing.
  stopPlayback(false);checkpoint();state.project=result.project;
  state.active=result.instruments[0]??state.active;state.selection=new Set(result.added);
  if(imported.some(s=>hasInstructions(s.project)))advancedInstructions.enabled=true;
  refresh();
  const warnings=[...imported.flatMap((song,i)=>song.warnings.map(w=>`${files[i].name}: ${w}`)),...result.warnings];
  warnings.push('Imported parts start at the beginning of the current view. Tempo and Speed Multiplier instructions use the shared project clock.');
  importReport(`Imported ${imported.reduce((sum,s)=>sum+s.noteCount,0)} notes from ${files.map(f=>f.name).join(', ')} into ${result.instruments.length} instrument(s). Undo restores the previous project.`,warnings);
 }catch(error){importReport(String((error as any)?.message??error),[],true);}
 finally{importing=false;}
}
export function installFileDrop(){
 document.ondragover=event=>{if(Array.from(event.dataTransfer?.types??[]).includes('Files')){event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';}};
 document.ondrop=event=>{event.preventDefault();return importDroppedFiles(Array.from(event.dataTransfer?.files??[]));};
}
