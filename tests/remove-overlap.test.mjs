import {test} from 'node:test';
import assert from 'node:assert/strict';
import {removeOverlap} from '../dist/music/remove-overlap.js';
import {projectSegment,mergeSegment} from '../dist/model/segment-view.js';
const note=(id,start,length,extra={})=>({id,start,length,pitch:60,instrument:0,volume:11,...extra});
const project=notes=>({format:'mml-studio',version:2,grid:4,instruments:[{name:'Piano',color:'#fff'},{name:'Bass',color:'#fff'},{name:'Instructions',color:'#fff',isInstructions:true}],notes});
test('remove overlap cuts nested/chained notes at exact next same-pitch onset, retaining other data',()=>{
 const p=project([note(3,17,4),note(1,0,100,{tempo:140}),note(2,7,30),note(4,3,40,{pitch:72}),note(5,2,40,{instrument:1})]);
 const before=JSON.stringify(p),r=removeOverlap(p,0);
 assert.equal(r.changed,2);assert.deepEqual(r.notes.map(n=>n.length),[4,7,10,40,40]);
 assert.equal(r.notes[1].tempo,140);assert.ok(r.notes.every(n=>n.volume===11));assert.equal(JSON.stringify(p),before);
 assert.equal(removeOverlap({...p,notes:r.notes},0).changed,0);
});
test('touching notes, gaps and Instructions are unchanged; same-onset duplicates leave one positive note',()=>{
 const p=project([note(1,0,5),note(2,5,2),note(3,10,2)]);assert.equal(removeOverlap(p,0).notes,p.notes);
 assert.equal(removeOverlap(p,2).notes,p.notes);
 const r=removeOverlap(project([note(1,0,20),note(2,0,30),note(3,7,4)]),0);
 assert.deepEqual(r.notes.map(n=>[n.id,n.length]),[[2,7],[3,4]]);assert.equal(r.duplicates,1);
});

test('same-onset winner uses length unless the shorter note is at least three V steps louder',()=>{
 for(const [longV,shortV,longLength,shortLength,winner] of [[1,4,128,4,2],[2,4,128,4,1],[8,10,8,8,2],[0,3,128,4,2],[4,4,8,8,1],[4,8,128,4,2]]){
  const notes=[note(1,0,longLength,{volume:longV}),note(2,0,shortLength,{volume:shortV})];
  for(const order of [notes,[...notes].reverse()]){
   const p=project(order),before=JSON.stringify(p),r=removeOverlap(p,0);
   assert.deepEqual(r.notes.map(n=>n.id),[winner]);assert.equal(r.changed,1);assert.equal(r.duplicates,1);
   assert.equal(JSON.stringify(p),before);assert.equal(removeOverlap({...p,notes:r.notes},0).changed,0);
  }
 }
});

test('duplicate groups preserve chords, instrument instances and surviving inherited volumes',()=>{
 const p=project([note(1,0,128,{volume:1}),note(2,0,32,{volume:3}),note(3,0,4,{volume:5}),note(4,0,8,{pitch:64}),note(5,0,8,{instrument:1}),note(6,200,8,{volume:null})]);
 const r=removeOverlap(p,0);
 assert.deepEqual(r.notes.map(n=>n.id),[2,4,5,6]);assert.equal(r.duplicates,2);
 assert.equal(r.notes.find(n=>n.id===6).volume,null);
 const inherited=removeOverlap(project([note(1,0,128,{volume:null}),note(2,0,4,{volume:0}),note(3,200,4,{volume:null})]),0);
 assert.deepEqual(inherited.notes.map(n=>[n.id,n.volume]),[[1,0],[3,0]]);
});
test('scoped overlap edits preserve both outside portions of a crossing parent note',()=>{
 const p=project([note(1,0,100),note(2,40,10)]),before=JSON.stringify(p);
 const projection=projectSegment(p,{kind:'segment',name:'Solo',start:20,end:60});
 const result=removeOverlap(projection.project,0),edited={...projection.project,notes:result.notes};
 const merged=mergeSegment(p,projection,edited,[0,1,2]);
 assert.deepEqual(merged.notes.filter(n=>n.id!==2).map(n=>[n.start,n.length]).sort((a,b)=>a[0]-b[0]),[[0,20],[20,20],[60,40]]);
 assert.equal(JSON.stringify(p),before);
});
