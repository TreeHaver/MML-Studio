import {layout} from './viewport.ts';
import {instruments} from './instruments.ts';
import {info} from './inspector.ts';
import {checkpoint} from './history.ts';
import {input,status} from './dom.ts';
import {state} from './state.ts';
import {valid} from './model/validation.ts';
import type {Note} from './model/types.ts';
import {syncSegment,fitsCurrentView} from './segment-session.ts';

export function refreshTitle(){document.title=`MML Music Studio - ${state.project.name||'Untitled'}`;}
export function refresh(){syncSegment();refreshTitle();input('project-name').value=state.project.name||'Untitled';input('grid').value=String(state.project.grid);instruments();info();layout();}

export function commitNotes(notes:Note[]){if(!fitsCurrentView({...state.project,notes})){status('This edit extends beyond the current view. Return to Project to edit across its boundary.');info();return;}if(!valid(notes)){status('That edit would create invalid timing or conflicting tempo, time signature or section instructions.');info();return;}checkpoint();state.project.notes=notes;refresh();}
