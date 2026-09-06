import type {Note,Project} from '../model/types.ts';
import {valid} from '../model/validation.ts';
import {snap} from './timing.ts';
export function move(notes:Note[],ids:Set<number>,anchor:number,dt:number,dp:number,grid:number):Note[]{
 const a=notes.find(n=>n.id===anchor)!;const delta=snap(a.start+dt,grid)-a.start;
 const result=notes.map(n=>ids.has(n.id)?{...n,start:n.start+delta,pitch:n.pitch+dp}:n);
 return valid(result)?result:notes;
}
export function resize(notes:Note[],id:number,length:number,grid:number):Note[]{
 const result=notes.map(n=>n.id===id?{...n,length:Math.max(128/grid,snap(length,grid))}:n);
 return valid(result)?result:notes;
}
