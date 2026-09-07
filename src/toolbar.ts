import {layout} from './viewport.ts';
import {draw} from './painting.ts';
import {$,view,input} from './dom.ts';
import {state} from './state.ts';
import {checkpoint} from './history.ts';
import {stopPlayback} from './playback/transport.ts';
import {refresh} from './commands.ts';
import {status} from './dom.ts';

export function setTool(value:string){state.tool=value;for(const id of ['draw','select'])$(id).classList.toggle('active',id===state.tool);}

export function installToolbar(){
$('draw').onclick=()=>setTool('draw');$('select').onclick=()=>setTool('select');
for(const g of [4,8,16,32,64,128]){const option=document.createElement('option');option.value=String(g);option.textContent='L'+g;$('grid').append(option);}
$('grid').onchange=()=>{state.project.grid=Number(input('grid').value);draw();};
$('zoom').oninput=()=>{const time=view.scrollLeft/state.zoom;state.zoom=Number(input('zoom').value);layout();view.scrollLeft=time*state.zoom;draw();};
$('clear-all').onclick=()=>{const count=state.project.notes.length;if(!count)return;if(!confirm(`Delete all ${count} notes and instructions from this project?\nYou can undo this action.`))return;stopPlayback(false);checkpoint();state.project.notes=[];state.selection.clear();refresh();status(`Deleted all ${count} notes and instructions.`);};

}

