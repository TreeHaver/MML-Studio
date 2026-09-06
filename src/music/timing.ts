import type {Note,Project} from '../model/types.ts';
export const snap=(t:number,grid:number)=>Math.round(t/(128/grid))*(128/grid);
