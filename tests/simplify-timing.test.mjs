import {test} from 'node:test';
import assert from 'node:assert/strict';
import {simplifyTiming} from '../dist/music/simplify-timing.js';
const note=(id,start,length,extra={})=>({id,start,length,instrument:0,pitch:60,volume:8,...extra});
const project=notes=>({instruments:[{}, {}, {isInstructions:true}],notes});
test('simplification rounds starts down and ends up on every offered grid without changing other data',()=>{
 for(const denominator of [4,8,16,32,64]){
  const p=project([note(1,1,2,{volume:11,tempo:140}),note(2,1,1,{instrument:1}),note(3,1,1,{instrument:2,section:'Solo'})]);
  const before=JSON.stringify(p),step=128/denominator,r=simplifyTiming(p,0,denominator);
  assert.equal(r.notes[0].start,0);assert.equal(r.notes[0].length,Math.ceil(3/step)*step);
  assert.equal(r.notes[0].volume,11);assert.equal(r.notes[0].tempo,140);
  assert.deepEqual(r.notes.slice(1),p.notes.slice(1));assert.equal(JSON.stringify(p),before);
 }
});
test('collision fallback shortens the first end across pitches and preserves existing polyphony',()=>{
 const p=project([note(1,1,4),note(2,5,3,{pitch:64}),note(3,5,3,{pitch:67})]);
 const r=simplifyTiming(p,0,64);
 assert.deepEqual(r.notes.map(n=>[n.start,n.length]),[[0,4],[4,4],[4,4]]);
 assert.equal(r.skipped,0);assert.equal(simplifyTiming({...p,notes:r.notes},0,64).changed,0);
 const held=simplifyTiming(project([note(1,0,20),note(2,5,2)]),0,64);
 assert.equal(held.notes[0].length,20,'existing overlap must not truncate held chords');
});
test('zero-length collision keeps original notes and protects them from their following neighbor',()=>{
 const p=project([note(1,0,1),note(2,1,1),note(3,3,1)]),r=simplifyTiming(p,0,64);
 assert.deepEqual(r.notes.map(n=>[n.start,n.length]),[[0,1],[1,1],[2,2]]);
 assert.equal(r.skipped,2);assert.equal(r.changed,1);
});
test('view end rounds down; Instructions and no-op edits stay untouched',()=>{
 const p=project([note(1,3,4)]),r=simplifyTiming(p,0,64,7);
 assert.deepEqual(r.notes.map(n=>[n.start,n.length]),[[2,4]]);
 assert.equal(simplifyTiming(p,2,64).notes,p.notes);
 assert.equal(simplifyTiming(project([note(1,0,2)]),0,64).changed,0);
 assert.throws(()=>simplifyTiming(p,0,128));
});
