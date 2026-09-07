import {sharp} from './pitch.ts';

export const pitchHeight=(pitch:number)=>sharp(pitch)?15:20;
const offsets=[0];
for(let pitch=0;pitch<12;pitch++)offsets.push(offsets[pitch]+pitchHeight(pitch));
const octaveHeight=offsets[12];
// Absolute pitch coordinates also cover negative and above-MIDI editor pitches.
function boundary(pitch:number){const octave=Math.floor(pitch/12);return octave*octaveHeight+offsets[pitch-octave*12];}
export const pitchTop=(top:number,pitch:number)=>boundary(top+1)-boundary(pitch+1);
export function pitchAtY(top:number,y:number){
 const position=boundary(top+1)-y,octave=Math.ceil(position/octaveHeight)-1,remainder=position-octave*octaveHeight;
 let pitch=0;while(pitch<11&&offsets[pitch+1]<remainder)pitch++;
 return octave*12+pitch;
}
