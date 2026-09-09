import {checkpoint} from './history.ts';
import {importSong,type ImportedSong} from './import/source.ts';
import {prepareImportTempos,importReport} from './import-ui.ts';
import {stopPlayback} from './playback/transport.ts';
import {refresh,refreshTitle} from './commands.ts';
import {$,input,status,view} from './dom.ts';
import {pitchTop} from './pitch-viewport.ts';
import {draw} from './painting.ts';
import {state,resetInstrumentView} from './state.ts';
import {fresh} from './model/project.ts';
import {parse} from './model/serialization.ts';
import {fullProject,resetSegment} from './segment-session.ts';
import {resetAdvancedInstructions} from './advanced-instructions.ts';



// Adding and removing an instrument leaves the project as it was, so comparing against the
// last saved contents avoids warning about work that no longer differs from it.
const snapshot=()=>JSON.stringify(fullProject());
export function markSaved(){state.saved=snapshot();state.dirty=false;}
export function unsaved(){return state.dirty&&snapshot()!==state.saved;}
/** Shared successful replacement for the menu and drops onto a truly empty project. */
export function replaceWithImport(imported:ImportedSong,name:string,sourceName=name){
 stopPlayback(false);resetInstrumentView();resetAdvancedInstructions();resetSegment();state.project=imported.project;state.project.name=name.replace(/\.[^.]+$/,'')||'Untitled';state.selection.clear();state.active=0;state.selectedInstruments.clear();
 state.history=[];state.future=[];state.dirty=true;state.saved='';view.scrollLeft=0;
 refresh();view.scrollTop=Math.max(0,pitchTop(state.topPitch,(state.project.notes.find(n=>n.instrument===0)?.pitch??60)+5));draw();
 const count=state.project.instruments.filter(i=>!i.isInstructions).length;
 const instructions=state.project.notes.filter(n=>state.project.instruments[n.instrument].isInstructions).length;
 const summary=`Imported ${imported.noteCount} note${imported.noteCount===1?'':'s'}${instructions?` and ${instructions} unbound instruction${instructions===1?'':'s'}`:''} from ${sourceName} into ${count} instrument${count===1?'':'s'}. Save JSON to keep this project.`;
 importReport(summary,imported.warnings);
}
let saving:Promise<boolean>|null=null;
export function saveProject():Promise<boolean>{
 if(saving)return saving;
 saving=(async()=>{try{
  const saved=snapshot();
  if(!await (window as any).files.save(JSON.stringify(JSON.parse(saved),null,2)))return false;
  state.saved=saved;state.dirty=snapshot()!==saved;status('Project saved.');return true;
 }catch(error){status('Save failed: '+error);return false;}
 finally{saving=null;}})();return saving;
}
export function installFiles(){
 markSaved();
$('project-name').onchange=()=>{const name=($('project-name') as HTMLInputElement).value.trim()||'Untitled';if(name!==(state.project.name||'Untitled')){checkpoint();state.project.name=name;}($('project-name') as HTMLInputElement).value=name;refreshTitle();};
let importing=false;
$('import-midi').onclick=async()=>{
 if(importing)return;importing=true;($('import-midi') as HTMLButtonElement).disabled=true;
 try{
  const file=await (window as any).files.importMidi();if(file===null)return;
  const bytes=new Uint8Array(file.bytes);
  const imported=importSong(bytes,file.name);
  if(unsaved()&&!confirm('Replace the current project with this import and discard unsaved changes?'))return;
  prepareImportTempos(imported,file.name);
  replaceWithImport(imported,file.name);
 }catch(error){
  // A failed import used to report only in the footer, which reads as "nothing happened".
  const reason=String((error as any)?.message??error).replace(/^Error:\s*/,'');
  importReport(reason,[],true);
 }
 finally{importing=false;($('import-midi') as HTMLButtonElement).disabled=false;}
};
$('midi-report-close').onclick=()=>($('midi-report') as HTMLDialogElement).close();
$('save').onclick=()=>saveProject();
$('open').onclick=async()=>{try{if(unsaved()&&!confirm('Discard unsaved changes and open a project?'))return;const text=await (window as any).files.open();if(text===null)return;const loaded=parse(text);stopPlayback(false);resetInstrumentView();resetAdvancedInstructions();resetSegment();state.project=loaded;state.selection.clear();state.active=0;state.selectedInstruments.clear();state.history=[];state.future=[];view.scrollLeft=0;refresh();markSaved();status('Project opened.');}catch(e){status('Open failed: '+e);}};
$('new').onclick=()=>{if(unsaved()&&!confirm('Discard unsaved changes?'))return;stopPlayback(false);resetInstrumentView();resetAdvancedInstructions();resetSegment();state.project=fresh();state.selection.clear();state.active=0;state.selectedInstruments.clear();state.history=[];state.future=[];view.scrollLeft=0;refresh();markSaved();
 status('New project. Type a name, or start drawing.');
 const name=input('project-name');name.focus({preventScroll:true});name.select();};
(window as any).editorClose?.onRequest(async()=>{
 if(!unsaved())return true;
 const before=snapshot(),choice=await (window as any).nativeDialogs.closeChoice();
 if(choice==='discard')return snapshot()===before;
 if(choice==='save')return await saveProject()&&!unsaved();
 return false;
});
// Electron owns the native close lifecycle. Do not cancel beforeunload here:
// after MIDI import, Chromium can otherwise keep the main window alive when
// the user clicks its native X button.

}
