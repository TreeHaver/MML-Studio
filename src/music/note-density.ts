import type {Note} from '../model/types.ts';
/** Warning definition: identical onset, pitch and owner, regardless of length. */
export function hasOverlappingNotes(notes:Note[]):boolean{
 const seen=new Set<string>();
 for(const n of notes){const key=`${n.instrument}:${n.start}:${n.pitch}`;if(seen.has(key))return true;seen.add(key);}
 return false;
}
/** Half-open intervals: a note ending at t does not overlap one starting at t. */
export function crowdedRegions(notes:Note[],limit=10):{start:number,end:number}[]{
 const events=new Map<number,number>();
 for(const n of notes){events.set(n.start,(events.get(n.start)??0)+1);const end=n.start+n.length;events.set(end,(events.get(end)??0)-1);}
 const regions:{start:number,end:number}[]=[];let count=0,start:number|undefined;
 for(const [tick,delta] of [...events].sort((a,b)=>a[0]-b[0])){
  const next=count+delta;
  if(count<=limit&&next>limit)start=tick;
  if(count>limit&&next<=limit&&start!==undefined){regions.push({start,end:tick});start=undefined;}
  count=next;
 }
 return regions;
}
