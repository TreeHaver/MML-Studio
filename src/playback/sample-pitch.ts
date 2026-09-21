// Audible key zones measured with effects disabled in the bundled TimGM6mb.sf2.
// Revalidate these ranges if the sound bank changes. GM programs are zero-based.
const ranges:Record<number,number[][]>={10:[[12,119]],56:[[12,119]],44:[[0,120]],48:[[0,127]],49:[[0,127]],52:[[0,127]],60:[[0,127]],65:[[0,127]],66:[[0,127]],50:[[0,116]],64:[[0,119]],67:[[0,79]],68:[[36,108]],77:[[21,108]],96:[[21,108]],124:[[21,108]],78:[[0,78],[102,108]],113:[[0,89]],122:[[36,86]],123:[[21,127]]};
export type SamplePolicy=boolean|readonly number[];
// The editor requests bank 0. Other banks and drum kits must not disable its melodic fallback.
export function overridePrograms(presets:{program:number,bankMSB:number,bankLSB:number,isDrum:boolean}[]){
 return presets.filter(p=>!p.isDrum&&p.bankMSB===0&&p.bankLSB===0).map(p=>p.program);
}
export const usesBundledSamples=(program:number,policy:SamplePolicy=true)=>typeof policy==='boolean'?policy:!policy.includes(program);
export function samplePitch(pitch:number,program=0,isDrum=false,bundledBank=true){
 if(!bundledBank||isDrum||pitch<0||pitch>127)return {pitch,tuning:0};
 const zones=ranges[program]??[[0,108]],audible=(key:number)=>zones.some(([low,high])=>key>=low&&key<=high);
 if(audible(pitch))return {pitch,tuning:0};
 // Octave-equivalent samples minimize the number of fixed-tuning MIDI routes.
 for(let shift=12;shift<=60;shift+=12){
  if(audible(pitch-shift))return {pitch:pitch-shift,tuning:shift};
  if(audible(pitch+shift))return {pitch:pitch+shift,tuning:-shift};
 }
 throw Error('No audible sample for this pitch in the bundled sound bank.');
}
// Fixed range keeps release tails stable. The bundled SF2 modulator scales
// sensitivity by 127/128 and truncates modulation to whole cents. Round away
// from center so an integer-semitone offset does not lose its final cent.
// Coarse-tuning RPN would select a different sample in this synth, so use the wheel.
export const tuningControllers=()=>[[101,0],[100,0],[6,64],[38,0],[101,127],[100,127]];
export const tuningWheel=(semitones:number)=>8192+Math.sign(semitones)*Math.ceil(Math.abs(semitones)*8192*128/(64*127));
