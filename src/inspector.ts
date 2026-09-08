import {speedRegions,validMultiplier} from './music/speed.ts';
import {loopRegions} from './music/loops.ts';
import {refreshStructure} from './toolbar.ts';
import {typedSignature} from './music/structure.ts';
import {updateMml} from './mml.ts';
import {tempoAt,validTempo} from './music/tempo.ts';
import {status} from './dom.ts';
import {anchor} from './geometry.ts';
import {commitNotes} from './commands.ts';
import {$,input} from './dom.ts';
import {state} from './state.ts';
import {name} from './music/pitch.ts';
import {volumeAt} from './music/volume.ts';
import type {Note} from './model/types.ts';

// A zone whose Entry is outside this view is automatic context, not a new Entry.
const inheritedSpeed=(n:Note|undefined)=>!!n&&!!state.segment&&state.segment.projection.baseline.notes.some(b=>b.id===n.id&&b.speedEntry)&&!state.segment.root.notes.some(o=>o.id===n.id);

export function info(){
 updateMml();refreshStructure();
 const n=anchor(),instructions=n&&state.project.instruments[n.instrument].isInstructions;
 $('note-properties').classList.toggle('has-selection',!!n);
 $('info').textContent=n?(instructions?`${state.selection.size} selected · Instructions (silent) · T${tempoAt(state.project.notes,n.start)}`:`${state.selection.size} selected · ${name(n.pitch)} · effective V${volumeAt(state.project,n)} · T${tempoAt(state.project.notes,n.start)}`):'Select a note or instruction to edit.';
 for(const key of ['pitch','length','volume','tempo'])input(key).disabled=!n||!!(instructions&&key!=='tempo');
 for(const key of ['pitch','length','volume'])$(key+'-field').hidden=!!instructions;
 $('visual-instructions').hidden=!instructions;
 for(const [id,key] of [['loop-entry','loopEntry'],['loop-exit','loopExit'],['loop-tie','loopTie']] as const){input(id).checked=!!n?.[key];input(id).disabled=!instructions;}
 input('loop-count').value=String(n?.loopCount??1);input('loop-count').disabled=!instructions||!n?.loopEntry;
 $('loop-count-field').hidden=!instructions||!n?.loopEntry;$('loop-tie-field').hidden=!instructions||!n?.loopExit;
 for(const [id,key] of [['speed-entry','speedEntry'],['speed-exit','speedExit']] as const){input(id).checked=!!n?.[key];input(id).disabled=!instructions||inheritedSpeed(n);}
 input('speed-multiplier').value=String(n?.speedMultiplier??2);input('speed-multiplier').disabled=!instructions||!n?.speedEntry||inheritedSpeed(n);
 $('speed-multiplier-field').hidden=!instructions||!n?.speedEntry;
 $('speed-warning').textContent=inheritedSpeed(n)?'Inherited multiplier. Return to Project to edit its Entry.':speedRegions(state.project.notes).warnings.join(' ');
 $('loop-warning').textContent=loopRegions(state.project).warnings.join(' ');
 for(const key of ['time-signature','section-name'])input(key).disabled=!instructions;
 input('time-signature').value=n?.timeSignature??'';input('section-name').value=n?.section??'';
 input('section-reset').checked=!!n?.resetMeasures;input('section-reset').disabled=!instructions;
 if(n){input('pitch').value=String(n.pitch);input('length').value=String(n.length);input('volume').value=n.volume===null?'':String(n.volume);input('tempo').value=n.tempo==null?'':String(n.tempo);}
}

export function installInspector(){
for(const [id,key] of [['speed-entry','speedEntry'],['speed-exit','speedExit'],['speed-multiplier','speedMultiplier']] as const)$(id).onchange=()=>{
 const n=anchor();if(!n||inheritedSpeed(n)||!state.project.instruments[n.instrument].isInstructions||key==='speedMultiplier'&&!n.speedEntry)return;
 const value=key==='speedMultiplier'?Number(input(id).value):input(id).checked;
 if(key==='speedMultiplier'&&!validMultiplier(value)){status('Speed multiplier must be a positive finite number.');info();return;}
 commitNotes(state.project.notes.map(o=>state.selection.has(o.id)&&!inheritedSpeed(o)&&state.project.instruments[o.instrument].isInstructions&&(key!=='speedMultiplier'||o.speedEntry)?{...o,[key]:value}:o));
}

for(const [id,key] of [['loop-entry','loopEntry'],['loop-exit','loopExit'],['loop-tie','loopTie'],['loop-count','loopCount']] as const)$(id).onchange=()=>{
 const n=anchor();if(!n||!state.project.instruments[n.instrument].isInstructions)return;
 if(key==='loopCount'&&!n.loopEntry||key==='loopTie'&&!n.loopExit)return;
 const value=key==='loopCount'?Number(input(id).value):input(id).checked;
 if(key==='loopCount'&&(!Number.isSafeInteger(value)||Number(value)<1)){status('Loop Count must be a positive whole number.');info();return;}
 commitNotes(state.project.notes.map(o=>state.selection.has(o.id)&&state.project.instruments[o.instrument].isInstructions&&(key!=='loopCount'||o.loopEntry)&&(key!=='loopTie'||o.loopExit)?{...o,[key]:value}:o));
};
$('section-reset').onchange=()=>{const n=anchor();if(!n||!state.project.instruments[n.instrument].isInstructions)return;const resetMeasures=input('section-reset').checked;commitNotes(state.project.notes.map(o=>state.selection.has(o.id)&&state.project.instruments[o.instrument].isInstructions?{...o,resetMeasures}:o));};
for(const [id,key] of [['time-signature','timeSignature'],['section-name','section']] as const)$(id).onchange=()=>{
 const n=anchor();if(!n||!state.project.instruments[n.instrument].isInstructions)return;const value=input(id).value.trim();
 if(key==='timeSignature'&&value&&!typedSignature(value)){input(id).classList.add('invalid');status('Use a time signature such as 3/4 or 6/8: 1–32 beats over 1, 2, 4, 8, 16, 32, 64 or 128.');return;}
 if(key==='timeSignature')input(id).classList.remove('invalid');
 commitNotes(state.project.notes.map(o=>state.selection.has(o.id)&&state.project.instruments[o.instrument].isInstructions?{...o,[key]:value}:o));
};
for(let v=0;v<=15;v++){const option=document.createElement('option');option.value=String(v);option.textContent='V'+v;$('volume').append(option);}
for(const key of ['pitch','length','volume','tempo'])$(key).onchange=()=>{
 const n=anchor();if(!n||state.project.instruments[n.instrument].isInstructions&&key!=='tempo')return;const value=input(key).value;const num=Number(value);if(key==='tempo'&&!validTempo(value===''?null:num)){status('Tempo must be a positive whole number of BPM.');info();return;}if(key!=='tempo'&&key!=='volume'&&!Number.isInteger(num)){info();return;}
 const next=state.project.notes.map(o=>state.selection.has(o.id)?{...o,[key]:(key==='volume'||key==='tempo')?(value===''?null:num):key==='pitch'?o.pitch+num-n.pitch:num}:o);commitNotes(next);
};

}
