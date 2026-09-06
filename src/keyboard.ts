import {draw} from './painting.ts';
import {info} from './inspector.ts';
import {undo} from './history.ts';
import {commitNotes} from './commands.ts';
import {endGesture} from './pointer.ts';
import {setTool} from './toolbar.ts';
import {state} from './state.ts';



export function installKeyboard(){
document.onkeydown=e=>{if((e.target as HTMLElement).matches('input,select,textarea'))return;
 if(e.key==='Escape'){endGesture(true);state.selection.clear();info();draw();return;}
 if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();if(state.selection.size){commitNotes(state.project.notes.filter(n=>!state.selection.has(n.id)));state.selection.clear();info();}return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo(e.shiftKey);return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();state.selection=new Set(state.project.notes.filter(n=>n.instrument===state.active).map(n=>n.id));info();draw();return;}
 if(e.key.toLowerCase()==='d')setTool('draw');if(e.key.toLowerCase()==='s'&&!e.ctrlKey)setTool('select');
};

}

