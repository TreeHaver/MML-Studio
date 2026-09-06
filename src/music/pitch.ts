import type {Note,Project} from '../model/types.ts';
export const name=(p:number)=>['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][((p%12)+12)%12]+(Math.floor(p/12)-1);
export const sharp=(p:number)=>[1,3,6,8,10].includes(((p%12)+12)%12);
