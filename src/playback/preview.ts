import {getPreviewEngine} from './engine.ts';
import {status} from '../dom.ts';
import {name} from '../music/pitch.ts';
import {drumName} from './drums.ts';

let generation=0;
export async function previewNote(pitch:number,program:number,isDrum=false,volume=100){
 const token=++generation;
 if(!Number.isInteger(pitch)||pitch<0||pitch>127){status('Preview supports MIDI pitches 0–127.');return;}
 try{
  const engine=await getPreviewEngine();
  if(token!==generation)return;
  await engine.preview(pitch,program,isDrum,volume);
  if(token===generation)status(`Preview: ${isDrum?drumName(pitch):name(pitch)}.`);
 }catch(error){if(token===generation)status('Note preview failed: '+error);}
}
