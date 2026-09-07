import type {Note,Project} from '../model/types.ts';
export const colors=['#FF9C33','#35C0E8','#A47CF7','#63CE6B','#FF6F8A','#E6D24A'];
export const fresh=():Project=>({format:'mml-studio',version:2,grid:4,instruments:[{name:'Piano',color:colors[0],midiProgram:0}],notes:[]});
