import {$} from './dom.ts';
import {estimateAudioCharacters} from './import/audio.ts';

/** Decode first to obtain the real clip duration; no project changes until accepted. */
export function chooseAudioSampling(name:string,seconds:number,budget:number):Promise<{interval:number,voices:number}|null>{
 const dialog=$('audio-import-options') as HTMLDialogElement,field=$('audio-sample-rate') as HTMLInputElement;
 const accept=$('audio-import-accept') as HTMLButtonElement,estimate=$('audio-import-estimate'),details=$('audio-sample-details');
 const voiceField=$('audio-voice-count') as HTMLInputElement;
 $('audio-import-source').textContent=`${name} · ${seconds.toFixed(3)} seconds`;
 field.value='30';voiceField.value='5';
 let chosen:{interval:number,voices:number}|null=null;
 const update=()=>{
  try{
   const voices=Number(voiceField.value),plan=estimateAudioCharacters(seconds,Number(field.value),voices),over=plan.characters>budget;
   chosen={interval:plan.intervalMs,voices};accept.disabled=false;accept.textContent=over?'Import anyway':'Import';
   details.textContent=`${plan.intervalMs} ms per sample (${(1000/plan.intervalMs).toFixed(1)} samples/second).${plan.intervalMs!==Number(field.value)?' Rounded to the nearest supported timing step.':''}`;
   estimate.textContent=`Estimated ${plan.characters.toLocaleString('en-US')} / ${budget.toLocaleString('en-US')} characters.${over?' Likely over budget. Reduce voices, increase milliseconds per sample or shorten the clip.':' Within the estimated budget.'}`;
   estimate.classList.toggle('over-budget',over);
  }catch(error){chosen=null;accept.disabled=true;details.textContent=String((error as Error).message);estimate.textContent='';estimate.classList.remove('over-budget');}
 };
 field.oninput=update;voiceField.oninput=update;update();
 return new Promise(resolve=>{
  const finish=(value:typeof chosen)=>{dialog.onclose=null;dialog.oncancel=null;field.oninput=null;voiceField.oninput=null;accept.onclick=null;$('audio-import-cancel').onclick=null;dialog.close();resolve(value);};
  accept.onclick=()=>{if(chosen!==null)finish(chosen);};
  $('audio-import-cancel').onclick=()=>finish(null);
  dialog.oncancel=event=>{event.preventDefault();finish(null);};dialog.onclose=()=>finish(null);
  dialog.showModal();field.focus();field.select();
 });
}
