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
 updateMml();
 const n=anchor(),instructions=n&&state.project.instruments[n.instrument].isInstructions;
 $('note-properties').classList.toggle('has-selection',!!n);
 $('info').textContent=n?(instructions?`${state.selection.size} selected · Instructions (silent) · T${tempoAt(state.project.notes,n.start)}`:`${state.selection.size} selected · ${name(n.pitch)} · effective V${volumeAt(state.project,n)} · T${tempoAt(state.project.notes,n.start)}`):'Select a note or instruction to edit.';
 for(const key of ['pitch','length','volume','tempo'])input(key).disabled=!n||!!(instructions&&key!=='tempo');
 if(n){input('pitch').value=String(n.pitch);input('length').value=String(n.length);input('volume').value=n.volume===null?'':String(n.volume);input('tempo').value=n.tempo==null?'':String(n.tempo);}
}

export function installInspector(){
for(let v=0;v<=15;v++){const option=document.createElement('option');option.value=String(v);option.textContent='V'+v;$('volume').append(option);}
for(const key of ['pitch','length','volume','tempo'])$(key).onchange=()=>{
 const n=anchor();if(!n||state.project.instruments[n.instrument].isInstructions&&key!=='tempo')return;const value=input(key).value;const num=Number(value);if(key==='tempo'&&!validTempo(value===''?null:num)){status('Tempo must be a positive whole number of BPM.');info();return;}if(key!=='tempo'&&key!=='volume'&&!Number.isInteger(num)){info();return;}
 const next=state.project.notes.map(o=>state.selection.has(o.id)?{...o,[key]:(key==='volume'||key==='tempo')?(value===''?null:num):key==='pitch'?o.pitch+num-n.pitch:num}:o);commitNotes(next);
};

}
