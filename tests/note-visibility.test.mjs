import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNoteVisibility} from '../dist/music/note-visibility.js';
const note=(id,start,length,pitch=60,instrument=0)=>({id,start,length,pitch,instrument,volume:8});
test('culling retains held notes, edge instructions and original paint order',()=>{
 const notes=[note(1,300,4),note(2,0,1000),note(3,95,1,60,1),note(4,110,5,84),note(5,115,5),note(6,0,4)];
 const query=createNoteVisibility(notes,i=>i===1);
 assert.deepEqual(query(100,120,59,61,16).map(n=>n.id),[2,3,5]);
 assert.deepEqual(query(100,120,59,61,4).map(n=>n.id),[2,5]);
});
test('indexed viewport candidates match brute-force filtering across varied pitches and zooms',()=>{
 const notes=Array.from({length:5000},(_,i)=>note(i,(i*73)%9000,1+(i*41)%1200,-12+i%160,i%5));
 const query=createNoteVisibility(notes,i=>i===4);
 for(let i=0;i<100;i++){
  const from=i*87,to=from+200,low=-12+i%100,high=low+24,width=48/(1+i%8);
  const expected=notes.filter(n=>n.pitch>=low&&n.pitch<=high&&n.start<=to&&n.start+(n.instrument===4?width:n.length)>=from);
  assert.deepEqual(query(from,to,low,high,width),expected);
 }
});
test('warm culling queries do not inspect all off-screen notes',()=>{
 let reads=0;
 const notes=Array.from({length:100000},(_,i)=>({...note(i,0,4),get start(){reads++;return i*16;}}));
 const query=createNoteVisibility(notes,()=>false);reads=0;
 const visible=query(800000,800100,60,60,48);
 assert.equal(visible.length,7);assert.ok(reads<150,`${reads} start reads for a 100,000-note song`);
});
