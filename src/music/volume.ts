import type {Note,Project} from '../model/types.ts';
/** Explicit V wins for its note. At shared onsets the highest-ID explicit V
 * supplies inheritance for unset notes and subsequent onsets in that owner. */
export function resolveVolumes(notes:readonly Note[]):Map<number,number>{
 const sorted=[...notes].sort((a,b)=>a.start-b.start||a.id-b.id),inherited=new Map<number,number>(),values=new Map<number,number>();
 for(let a=0;a<sorted.length;){
  let b=a;
  while(b<sorted.length&&sorted[b].start===sorted[a].start){const n=sorted[b++];if(n.volume!==null)inherited.set(n.instrument,n.volume);}
  for(;a<b;a++){const n=sorted[a];values.set(n.id,n.volume??inherited.get(n.instrument)??8);}
 }
 return values;
}
export function volumeAt(project:Project,n:Note):number{
 if(n.volume!==null)return n.volume;
 let latest:Note|undefined;
 for(const o of project.notes)if(o.instrument===n.instrument&&o.start<=n.start&&o.volume!==null&&(!latest||o.start>latest.start||o.start===latest.start&&o.id>latest.id))latest=o;
 return latest?.volume??8;
}
