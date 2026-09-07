import {checkpoint} from './history.ts';
import {importMml} from './import/mml.ts';
import {stopPlayback} from './playback/transport.ts';
import {refresh} from './commands.ts';
import {$,status,view} from './dom.ts';
import {ROW} from './constants.ts';
import {draw} from './painting.ts';
import {state,resetInstrumentView} from './state.ts';
import {fresh} from './model/project.ts';
import {parse} from './model/serialization.ts';
import {fullProject,resetSegment} from './segment-session.ts';



export function installFiles(){
$('project-name').onchange=()=>{const name=($('project-name') as HTMLInputElement).value.trim()||'Untitled';if(name!==(state.project.name||'Untitled')){checkpoint();state.project.name=name;}($('project-name') as HTMLInputElement).value=name;};
let importing=false;
$('import-midi').onclick=async()=>{
 if(importing)return;importing=true;($('import-midi') as HTMLButtonElement).disabled=true;
 try{
  const file=await (window as any).files.importMidi();if(file===null)return;
  const {importMidi}=await import('./import/midi.js');
  const bytes=new Uint8Array(file.bytes);
  const imported=/\.(mid|midi)$/i.test(file.name)?importMidi(bytes):importMml(new TextDecoder('utf-8',{fatal:true}).decode(bytes),file.name.replace(/\.[^.]+$/,''));
  if(state.dirty&&!confirm('Replace the current project with this import and discard unsaved changes?'))return;
  stopPlayback(false);resetInstrumentView();resetSegment();state.project=imported.project;state.project.name=file.name.replace(/\.[^.]+$/,'')||'Untitled';state.selection.clear();state.active=0;
  state.history=[];state.future=[];state.dirty=true;view.scrollLeft=0;
  refresh();view.scrollTop=Math.max(0,(state.topPitch-(state.project.notes.find(n=>n.instrument===0)?.pitch??60)-5)*ROW);draw();
  const count=state.project.instruments.length;
  const instructions=state.project.notes.filter(n=>state.project.instruments[n.instrument].isInstructions).length;
  const summary=`Imported ${imported.noteCount} note${imported.noteCount===1?'':'s'}${instructions?` and ${instructions} unbound instruction${instructions===1?'':'s'}`:''} from ${file.name} into ${count} instrument${count===1?'':'s'}. Save JSON to keep this project.`;
  status(summary);$('midi-summary').textContent=summary;
  $('midi-warnings').replaceChildren();
  for(const warning of imported.warnings){const li=document.createElement('li');li.textContent=warning;$('midi-warnings').append(li);}
  ($('midi-report') as HTMLDialogElement).showModal();
 }catch(error){status('Import failed: '+error);}
 finally{importing=false;($('import-midi') as HTMLButtonElement).disabled=false;}
};
$('midi-report-close').onclick=()=>($('midi-report') as HTMLDialogElement).close();
$('save').onclick=async()=>{try{if(await (window as any).files.save(JSON.stringify(fullProject(),null,2))){state.dirty=false;status('Project saved.');}}catch(e){status('Save failed: '+e);}};
$('open').onclick=async()=>{try{if(state.dirty&&!confirm('Discard unsaved changes and open a project?'))return;const text=await (window as any).files.open();if(text===null)return;const loaded=parse(text);stopPlayback(false);resetInstrumentView();resetSegment();state.project=loaded;state.selection.clear();state.active=0;state.history=[];state.future=[];state.dirty=false;view.scrollLeft=0;refresh();status('Project opened.');}catch(e){status('Open failed: '+e);}};
$('new').onclick=()=>{if(state.dirty&&!confirm('Discard unsaved changes?'))return;stopPlayback(false);resetInstrumentView();resetSegment();state.project=fresh();state.selection.clear();state.active=0;state.history=[];state.future=[];state.dirty=false;view.scrollLeft=0;refresh();};
// Electron owns the native close lifecycle. Do not cancel beforeunload here:
// after MIDI import, Chromium can otherwise keep the main window alive when
// the user clicks its native X button.

}
