import {SoundBankLoader,type BasicSoundBank} from 'spessasynth_core';

const ignored=new Set(['CRASH60B','KICK264','FATSD60A']);
/** Exclude only the requested Maplebeats replacements; the GM bank fills these slots. */
export function filterSoundBank(bank:BasicSoundBank,id?:string){
 if(id==='maplebeats-2.dls')for(const preset of [...bank.presets]){
  if(ignored.has(preset.name.trim()))bank.deletePreset(preset);
 }
 return bank;
}
/** The worklet accepts bank bytes. Serialize a filtered in-memory copy, preserving the file. */
export function prepareSoundBank(bytes:Uint8Array,id:string){
 const buffer=new Uint8Array(bytes).buffer;
 if(id!=='maplebeats-2.dls')return buffer;
 return filterSoundBank(SoundBankLoader.fromArrayBuffer(buffer),id).writeSF2();
}
