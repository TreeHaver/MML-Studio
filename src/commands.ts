import {layout} from './viewport.ts';
import {instruments} from './instruments.ts';
import {info} from './inspector.ts';
import {checkpoint} from './history.ts';
import {input,status} from './dom.ts';
import {state} from './state.ts';
import {valid} from './model/validation.ts';
import type {Note} from './model/types.ts';

export function refresh(){input('grid').value=String(state.project.grid);instruments();info();layout();}

export function commitNotes(notes:Note[]){if(!valid(notes)){status('That edit would overlap notes or create invalid/conflicting T instructions.');info();return;}checkpoint();state.project.notes=notes;refresh();}
