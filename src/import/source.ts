import {importMidi} from './midi.ts';
import {importMml} from './mml.ts';
import type {Project} from '../model/types.ts';

export type ImportedSong={project:Project,noteCount:number,warnings:string[]};
export function importSong(bytes:Uint8Array,name:string):ImportedSong{
 return /\.(mid|midi)$/i.test(name)?importMidi(bytes):importMml(new TextDecoder('utf-8',{fatal:true}).decode(bytes),name.replace(/\.[^.]+$/,''),{tempoConflicts:'last'});
}
