import type {Note,Project} from '../model/types.ts';
export const colors=['#F4A34E','#65BFDC','#B69CEC','#89C78D','#EC8397','#DACA68'];
export const fresh=():Project=>({format:'mml-studio',version:2,grid:4,instruments:[{name:'Piano',color:colors[0],midiProgram:0}],notes:[]});
