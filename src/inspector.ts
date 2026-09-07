import {refreshStructure} from './toolbar.ts';
import {validSignature} from './music/structure.ts';
import {updateMml} from './mml.ts';
import {tempoAt,validTempo} from './music/tempo.ts';
import {status} from './dom.ts';
import {anchor} from './geometry.ts';
import {commitNotes} from './commands.ts';
import {$,input} from './dom.ts';
import {state} from './state.ts';
import {name} from './music/pitch.ts';
import {volumeAt} from './music/volume.ts';

export function info(){
 updateMml();refreshStructure();
 const n=anchor(),instructions=n&&state.project.instruments[n.instrument].isInstructions;
 $('note-properties').classList.toggle('has-selection',!!n);
 $('info').textContent=n?(instructions?`${state.selection.size} selected · Instructions (silent) · T${tempoAt(state.project.notes,n.start)}`:`${state.selection.size} selected · ${name(n.pitch)} · effective V${volumeAt(state.project,n)} · T${tempoAt(state.project.notes,n.start)}`):'Select a note or instruction to edit.';
 for(const key of ['pitch','length','volume','tempo'])input(key).disabled=!n||!!(instructions&&key!=='tempo');
 $('visual-instructions').hidden=!instructions;
 for(const key of ['time-signature','section-name'])input(key).disabled=!instructions;
 input('time-signature').value=n?.timeSignature??'';input('section-name').value=n?.section??'';
 input('section-reset').checked=!!n?.resetMeasures;input('section-reset').disabled=!instructions;
 if(n){input('pitch').value=String(n.pitch);input('length').value=String(n.length);input('volume').value=n.volume===null?'':String(n.volume);input('tempo').value=n.tempo==null?'':String(n.tempo);}
}

export function installInspector(){
$('section-reset').onchange=()=>{const n=anchor();if(!n||!state.project.instruments[n.instrument].isInstructions)return;const resetMeasures=input('section-reset').checked;commitNotes(state.project.notes.map(o=>state.selection.has(o.id)&&state.project.instruments[o.instrument].isInstructions?{...o,resetMeasures}:o));};
for(const [id,key] of [['time-signature','timeSignature'],['section-name','section']] as const)$(id).onchange=()=>{
 const n=anchor();if(!n||!state.project.instruments[n.instrument].isInstructions)return;const value=input(id).value.trim();
 if(key==='timeSignature'&&value&&!validSignature(value)){status('Use a time signature such as 3/4 or 6/8 (denominator 1–128, powers of two).');info();return;}
 commitNotes(state.project.notes.map(o=>state.selection.has(o.id)&&state.project.instruments[o.instrument].isInstructions?{...o,[key]:value}:o));
};
for(let v=0;v<=15;v++){const option=document.createElement('option');option.value=String(v);option.textContent='V'+v;$('volume').append(option);}
for(const key of ['pitch','length','volume','tempo'])$(key).onchange=()=>{
 const n=anchor();if(!n||state.project.instruments[n.instrument].isInstructions&&key!=='tempo')return;const value=input(key).value;const num=Number(value);if(key==='tempo'&&!validTempo(value===''?null:num)){status('Tempo must be a positive whole number of BPM.');info();return;}if(key!=='tempo'&&key!=='volume'&&!Number.isInteger(num)){info();return;}
 const next=state.project.notes.map(o=>state.selection.has(o.id)?{...o,[key]:(key==='volume'||key==='tempo')?(value===''?null:num):key==='pitch'?o.pitch+num-n.pitch:num}:o);commitNotes(next);
};

}
