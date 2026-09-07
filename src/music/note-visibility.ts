import type {Note} from '../model/types.ts';
type Entry={note:Note,order:number,end:number,instructions:boolean};
type Node={entry:Entry,maxEnd:number,left:Node|null,right:Node|null};
/** Per-pitch interval trees retain long held notes crossing the viewport edge. */
export function createNoteVisibility(notes:Note[],isInstructions:(index:number)=>boolean){
 const pitches=new Map<number,Entry[]>();
 notes.forEach((note,order)=>{
  const instructions=isInstructions(note.instrument),entry={note,order,instructions,end:note.start+(instructions?0:note.length)};
  const list=pitches.get(note.pitch);if(list)list.push(entry);else pitches.set(note.pitch,[entry]);
 });
 const build=(entries:Entry[],low:number,high:number):Node|null=>{
  if(low>=high)return null;const mid=(low+high)>>>1,left=build(entries,low,mid),right=build(entries,mid+1,high),entry=entries[mid];
  return {entry,left,right,maxEnd:Math.max(entry.end,left?.maxEnd??-Infinity,right?.maxEnd??-Infinity)};
 };
 const roots=new Map<number,Node|null>();
 for(const [pitch,entries] of pitches){entries.sort((a,b)=>a.note.start-b.note.start||a.order-b.order);roots.set(pitch,build(entries,0,entries.length));}
 return (from:number,to:number,lowPitch:number,highPitch:number,instructionWidth:number)=>{
  const visible:Entry[]=[],left=from-instructionWidth;
  const visit=(node:Node|null)=>{
   if(!node||node.maxEnd<left)return;
   visit(node.left);const entry=node.entry;
   if(entry.note.start>to)return;
   if((entry.instructions?entry.note.start+instructionWidth:entry.end)>=from)visible.push(entry);
   visit(node.right);
  };
  for(let pitch=lowPitch;pitch<=highPitch;pitch++)visit(roots.get(pitch)??null);
  visible.sort((a,b)=>a.order-b.order);return visible.map(entry=>entry.note);
 };
}
