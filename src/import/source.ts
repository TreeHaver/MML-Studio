import {importMidi} from './midi.ts';
import {importMml} from './mml.ts';
import {importAbc} from './abc.ts';
import {condenseImportInstructions} from './instructions.ts';
import type {Project} from '../model/types.ts';

export type ImportedSong={project:Project,noteCount:number,warnings:string[]};
export function importSong(bytes:Uint8Array,name:string):ImportedSong{
 let song:ImportedSong;
 if(/\.(mid|midi)$/i.test(name))song=importMidi(bytes);
 else{
  let text:string;const warnings:string[]=[];
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
  catch{text=new TextDecoder('windows-1252').decode(bytes);warnings.push('Text was not valid UTF-8; Windows-1252 decoding was attempted. Check names and symbols.');}
  const title=name.replace(/\.[^.]+$/,'');
  song=/\.abc$/i.test(name)?importAbc(text,title,{recover:true}):importMml(text,title,{tempoConflicts:'last'});
  song.warnings.push(...warnings);
 }
 condenseImportInstructions(song.project,song.warnings);return song;
}
