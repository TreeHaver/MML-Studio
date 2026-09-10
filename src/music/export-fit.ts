import type {Project} from '../model/types.ts';
import {expandLoops} from './loops.ts';
import {partitionChannels} from './channels.ts';
import {simplifyHeldNotes,simplifyChords} from './simplify-polyphony.ts';
import {valid} from '../model/validation.ts';

/** Opt-in export transformation; operate on expanded performance, never editor data. */
export function fitExportChannels(source:Project,index:number){
 let project=expandLoops(source).project;
 const count=()=>partitionChannels(project.notes.filter(n=>n.instrument===index)).length;
 if(count()<=10)return {project,shortened:0,removed:0};
 const held=simplifyHeldNotes(project,index);
 project={...project,notes:held.notes};
 let removed=0;
 if(count()>10){const chord=simplifyChords(project,index,undefined,2);project={...project,notes:chord.notes};removed=chord.removed;}
 if(!valid(project.notes))throw Error('Could not fit the export without conflicting instructions. No files were saved.');
 const channels=count();
 if(channels>10)throw Error(`${source.instruments[index].name} still requires ${channels} channels after Held Note Simplifier and Chord Simplifier (complexity 2). Export canceled; no files were saved.`);
 return {project,shortened:held.changed,removed};
}
