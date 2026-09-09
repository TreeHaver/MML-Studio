import {$,status} from './dom.ts';
import {applyImportSpeedMultipliers,hasOutOfRangeTempo,withoutImportedTempos} from './import/tempo.ts';
import type {ImportedSong} from './import/source.ts';

export function prepareImportTempos(imported:ImportedSong,name?:string,askWhetherToKeep=false){
 if(askWhetherToKeep&&imported.project.notes.some(n=>n.tempo!=null)){
  const choice=(window as any).nativeDialogs?.importTempos;
  const keep=choice?choice(name):confirm('Import tempo instructions? Imported tempos replace conflicting tempos at the same position. Continue imports tempos; Cancel removes them and imports the notes without tempo instructions.');
  if(!keep){imported.project=withoutImportedTempos(imported.project);imported.warnings.push('Imported tempo instructions were removed. Notes use the project clock (120 BPM by default).');return;}
 }
 if(hasOutOfRangeTempo(imported.project)&&confirm('This song has tempos outside the MS2 range of 32–255 BPM. Use Speed Multiplier instructions to try to fix them?\n\nThis makes the song use more instructions and might produce unexpected results. Conversion uses only ×2 or ×4 (up to 2 BPM rounding), or ÷2/÷4 for slow tempos. Tempos that do not fit stay unchanged and are reported. Choose Cancel to import with the original tempos.')){
  const converted=applyImportSpeedMultipliers(imported.project,imported.warnings);
  if(converted!==imported.project)imported.warnings.push('Speed Multiplier instructions were added using only ×2/×4 or ÷2/÷4. This uses more instructions and might produce unexpected results.');
  imported.project=converted;
 }
}
export function importReport(summary:string,warnings:string[]=[],failed=false){
 status((failed?'Import failed: ':'')+summary);
 $('midi-report-title').textContent=failed?'Import failed':'Import complete';$('midi-report-note').hidden=failed;$('midi-summary').textContent=summary;
 $('midi-warnings').replaceChildren();
 for(const warning of warnings){const li=document.createElement('li');li.textContent=warning;$('midi-warnings').append(li);}
 const dialog=$('midi-report') as HTMLDialogElement;if(!dialog.open)dialog.showModal();
}
