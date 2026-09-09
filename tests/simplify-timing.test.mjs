import {test} from 'node:test';
import assert from 'node:assert/strict';
import {simplifyTiming} from '../dist/music/simplify-timing.js';
const note=(id,start,length,extra={})=>({id,start,length,instrument:0,pitch:60,volume:8,...extra});
const project=notes=>({instruments:[{}, {}, {isInstructions:true}],notes});
test('simplification extends edge windows above 40% on every offered grid without changing other data',()=>{
 for(const denominator of [4,8,16,32,64]){
  const step=128/denominator;
  const p=project([note(1,1,step,{volume:11,tempo:140}),note(2,1,1,{instrument:1}),note(3,1,1,{instrument:2,section:'Solo'})]);
  const before=JSON.stringify(p),r=simplifyTiming(p,0,denominator);
  assert.equal(r.notes[0].start,0);assert.equal(r.notes[0].length,step+(5>2*step?step:0));
  assert.equal(r.notes[0].volume,11);assert.equal(r.notes[0].tempo,140);
  assert.deepEqual(r.notes.slice(1),p.notes.slice(1));assert.equal(JSON.stringify(p),before);
 }
});

test('edge coverage uses 40% instead of 50% and short notes that cannot fit survive',()=>{
 for(const [start,length,expected] of [[0,44,[0,32]],[0,45,[0,64]],[19,45,[0,64]],[20,44,[32,32]],[20,12,[20,12]],[3,3,[3,3]]]){
  const r=simplifyTiming(project([note(1,start,length)]),0,4);
  assert.deepEqual([r.notes[0].start,r.notes[0].length],expected);
 }
});

test('slightly offset consecutive chords fit the windows without extra tails',()=>{
 const p=project([note(1,33,31),note(2,65,31),note(3,31,32,{pitch:58}),note(4,64,32,{pitch:58}),note(5,33,31,{pitch:55}),note(6,65,31,{pitch:55})]);
 const r=simplifyTiming(p,0,4);
 assert.deepEqual(r.notes.map(n=>[n.start,n.length]),[[32,32],[64,32],[32,32],[64,32],[32,32],[64,32]]);
 assert.equal(r.skipped,0);
});

test('ascending, descending and turning rolls retain the first pitch per condensed window',()=>{
 for(const pitches of [[60,62,64,65,67,69,71,72],[72,71,69,67,65,64,62,60],[60,62,64,62,60,62,64,62]]){
  const p=project(pitches.map((pitch,i)=>note(i+1,i*2,2,{pitch}))),before=JSON.stringify(p);
  const r=simplifyTiming(p,0,16);
  assert.deepEqual(r.notes.map(n=>[n.id,n.start,n.length,n.pitch]),[[1,0,8,pitches[0]],[5,8,8,pitches[4]]]);
  assert.equal(r.changed,8);assert.equal(r.skipped,0);assert.equal(JSON.stringify(p),before);
  assert.equal(simplifyTiming({...p,notes:r.notes},0,16).changed,0);
 }
});

test('hammer-ons remove only short lead-ins with a held note strictly over six times longer',()=>{
 for(const [short,long,removed] of [[1,7,true],[4,25,true],[4,24,false],[5,31,false]]){
  const r=simplifyTiming(project([note(1,0,short),note(2,short,long,{pitch:62})]),0,64);
  assert.equal(r.notes.some(n=>n.id===1),!removed);
  assert.ok(r.notes.some(n=>n.id===2));
 }
 const r=simplifyTiming(project([note(1,0,1,{volume:0}),note(2,1,15,{pitch:62,volume:null}),note(3,32,8,{volume:null})]),0,16);
 assert.deepEqual(r.notes.map(n=>[n.id,n.start,n.length,n.volume]),[[2,0,16,0],[3,32,8,0]]);
});

test('ornament detection protects chords, repeated pitches, gaps, instructions and scoped ends',()=>{
 const fixtures=[
  [note(1,0,1),note(2,1,16)],
  [note(1,0,1),note(2,3,16,{pitch:62})],
  [note(1,0,1),note(2,0,1,{pitch:64}),note(3,1,16,{pitch:62})],
  [note(1,0,1,{tempo:140}),note(2,1,16,{pitch:62})],
  [note(1,0,1,{section:'Keep'}),note(2,1,1,{pitch:62}),note(3,2,1,{pitch:64})],
 ];
 for(const notes of fixtures)assert.equal(simplifyTiming(project(notes),0,64).notes.length,notes.length);
 const roll=project([note(1,0,1),note(2,1,1,{pitch:62}),note(3,2,1,{pitch:64})]);
 assert.equal(simplifyTiming(roll,0,16,3).notes.length,3);
});

test('roll condensation keeps unrelated notes and resolves inherited volume after removed carriers',()=>{
 const p=project([note(1,0,2),note(2,2,2,{pitch:62,volume:0}),note(3,4,2,{pitch:64,volume:null}),note(4,8,8,{volume:null}),note(5,0,4,{instrument:1})]);
 const r=simplifyTiming(p,0,16);
 assert.deepEqual(r.notes.map(n=>[n.id,n.volume]),[[1,8],[4,0],[5,8]]);
 assert.equal(r.notes[2],p.notes[4]);
});
test('collision fallback shortens the first end across pitches and preserves existing polyphony',()=>{
 const p=project([note(1,1,4),note(2,5,3,{pitch:64}),note(3,5,3,{pitch:67})]);
 const r=simplifyTiming(p,0,64);
 assert.deepEqual(r.notes.map(n=>[n.start,n.length]),[[0,4],[4,4],[4,4]]);
 assert.equal(r.skipped,0);assert.equal(simplifyTiming({...p,notes:r.notes},0,64).changed,0);
 const held=simplifyTiming(project([note(1,0,20),note(2,5,2)]),0,64);
 assert.equal(held.notes[0].length,20,'existing overlap must not truncate held chords');
});
test('rapid same-pitch one-unit notes merge into a full window without being skipped',()=>{
 const p=project([note(1,0,1),note(2,1,1),note(3,3,1)]),r=simplifyTiming(p,0,64);
 assert.deepEqual(r.notes.map(n=>[n.start,n.length]),[[0,2],[2,2]]);
 assert.equal(r.skipped,0);assert.equal(r.changed,3);
});

test('two competing notes split a window equally at 40/60 or closer, otherwise the larger share wins',()=>{
 for(const [a,b,expected] of [[4,6,[[1,0,8],[2,8,8]]],[6,4,[[1,0,8],[2,8,8]]],[5,5,[[1,0,8],[2,8,8]]],[3,7,[[2,0,16]]],[7,3,[[1,0,16]]]]){
  const p=project([note(1,0,a),note(2,a,b)]),before=JSON.stringify(p),r=simplifyTiming(p,0,8);
  assert.deepEqual(r.notes.map(n=>[n.id,n.start,n.length]),expected);
  assert.equal(JSON.stringify(p),before);
  assert.equal(simplifyTiming({...p,notes:r.notes},0,8).changed,0);
 }
});

test('competition compares only the shared window and preserves held portions outside it',()=>{
 const r=simplifyTiming(project([note(1,0,21),note(2,21,11)]),0,8);
 assert.deepEqual(r.notes.map(n=>[n.id,n.start,n.length]),[[1,0,16],[2,16,16]]);
 const split=simplifyTiming(project([note(1,0,23),note(2,23,25)]),0,8);
 assert.deepEqual(split.notes.map(n=>[n.id,n.start,n.length]),[[1,0,24],[2,24,24]]);
});

test('rapid two-note windows condense on eligible grids; longer pairs and inherited V0 survive',()=>{
 for(const denominator of [4,8,16,32,64]){
  const step=128/denominator,r=simplifyTiming(project([note(1,0,step/2),note(2,step/2,step/2)]),0,denominator);
  assert.deepEqual(r.notes.map(n=>[n.start,n.length]),step/2<=4?[[0,step]]:[[0,step/2],[step/2,step/2]]);
 }
 const roll=simplifyTiming(project([0,2,4,6].map((start,i)=>note(i+1,start,2,{pitch:60+i}))),0,32);
 assert.deepEqual(roll.notes.map(n=>[n.start,n.length]),[[0,4],[4,4]]);
 const p=project([note(1,0,3,{volume:0}),note(2,3,7,{volume:null}),note(3,32,16,{volume:null})]);
 assert.deepEqual(simplifyTiming(p,0,8).notes.map(n=>[n.id,n.volume]),[[2,0],[3,0]]);
});
test('L32 drawing simplified to L16 matches hammer-on, long-note, repeat and pitch-run examples',()=>{
 const fixtures=[
  {notes:[note(1,0,4,{pitch:62}),note(2,4,28,{pitch:63})],expected:[[2,0,32,63]]},
  {notes:[note(1,0,12),note(2,12,12)],expected:[[1,0,12,60],[2,12,12,60]]},
  {notes:[note(1,0,4),note(2,4,4),note(3,8,4,{pitch:62}),note(4,12,4,{pitch:62})],expected:[[1,0,8,60],[3,8,8,62]]},
  ...[[60,62,64,65],[65,64,62,60],[60,62,64,62,60,62]].map(pitches=>({
   notes:pitches.map((pitch,i)=>note(i+1,i*4,4,{pitch})),
   expected:pitches.flatMap((pitch,i)=>i%2?[]:[[i+1,i*4,8,pitch]])
  }))
 ];
 for(const {notes,expected} of fixtures){
  const p=project(notes),before=JSON.stringify(p),r=simplifyTiming(p,0,16);
  assert.deepEqual(r.notes.map(n=>[n.id,n.start,n.length,n.pitch]),expected);
  assert.equal(r.skipped,0);assert.equal(JSON.stringify(p),before);
  assert.equal(simplifyTiming({...p,notes:r.notes},0,16).changed,0);
 }
});

test('rapid condensation preserves carrier volumes, instructions, chords and view boundaries',()=>{
 const p=project([note(1,0,4,{volume:11}),note(2,4,4,{volume:0}),note(3,8,8,{volume:null}),note(4,0,4,{instrument:1})]);
 const r=simplifyTiming(p,0,16);
 assert.deepEqual(r.notes.map(n=>[n.id,n.volume]),[[1,11],[3,0],[4,8]]);
 for(const extra of [{tempo:140},{speedEntry:true,speedMultiplier:2},{section:'Keep'}]){
  assert.equal(simplifyTiming(project([note(1,0,4),note(2,4,4,extra)]),0,16).notes.length,2);
 }
 const chord=project([note(1,0,4),note(2,0,4,{pitch:64}),note(3,4,4),note(4,4,4,{pitch:64})]);
 assert.equal(simplifyTiming(chord,0,16).notes.length,4);
 const clipped=project([note(1,0,4),note(2,4,2)]);
 assert.equal(simplifyTiming(clipped,0,16,6).notes.length,2);
});

test('view end rounds down; Instructions and no-op edits stay untouched',()=>{
 const p=project([note(1,3,4)]),r=simplifyTiming(p,0,64,7);
 assert.deepEqual(r.notes.map(n=>[n.start,n.length]),[[2,4]]);
 assert.equal(simplifyTiming(p,2,64).notes,p.notes);
 assert.equal(simplifyTiming(project([note(1,0,2)]),0,64).changed,0);
 assert.throws(()=>simplifyTiming(p,0,128));
});
