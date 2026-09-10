import {test} from 'node:test';
import assert from 'node:assert/strict';
import {simplifyHeldNotes,simplifyChords} from '../dist/music/simplify-polyphony.js';
import {resolveVolumes} from '../dist/music/volume.js';
import {removeOverlap} from '../dist/music/remove-overlap.js';
import {simplifyTiming} from '../dist/music/simplify-timing.js';
import {detectScale} from '../dist/music/scale.js';
const n=(id,start=0,length=64,pitch=60+id,volume=8,instrument=0)=>({id,start,length,pitch,volume,instrument});
const p=notes=>({format:'mml-studio',version:2,grid:4,instruments:[{name:'Piano',color:'#ffffff'},{name:'Other',color:'#ffffff'},{name:'Instructions',color:'#579dff',isInstructions:true}],notes});
test('held cuts prioritize exact new pitch, then resolved velocity, then oldest onset',()=>{
 const held=Array.from({length:10},(_,i)=>n(i+1,i,128));
 held[0].volume=1;held[9].volume=15;
 let project=p([...held,n(20,32,8,held[9].pitch)]),before=JSON.stringify(project);
 let r=simplifyHeldNotes(project,0);
 assert.equal(r.changed,1);assert.equal(r.notes.find(n=>n.id===10).length,23);assert.equal(JSON.stringify(project),before);
 project=p([...held,n(20,32,8,90)]);r=simplifyHeldNotes(project,0);
 assert.equal(r.notes.find(n=>n.id===1).length,32);
 held.forEach(n=>n.volume=8);r=simplifyHeldNotes(p([...held,n(20,32,8,90)]),0);
 assert.equal(r.notes.find(n=>n.id===1).length,32);
 assert.equal(simplifyHeldNotes({...project,notes:r.notes},0).changed,0);
});
test('held handles batches, half-open ends, silence, scope and irreducible fresh chords',()=>{
 const held=Array.from({length:10},(_,i)=>n(i+1));
 const project=p([...held,n(20,16,16,90),n(21,16,16,91),n(22,16,16,92),n(30,0,128,60,0),n(31,0,128,60,8,1)]);
 const r=simplifyHeldNotes(project,0,new Set([1,2]));assert.equal(r.changed,2);assert.equal(r.unresolved,1);
 assert.equal(r.notes.find(n=>n.id===3),held[2]);assert.equal(r.notes.find(n=>n.id===30).length,128);
 assert.equal(simplifyHeldNotes(p([...held,n(20,64)]),0).changed,0);
 const fresh=p(Array.from({length:11},(_,i)=>n(i+1)));assert.equal(simplifyHeldNotes(fresh,0).changed,0);assert.equal(simplifyHeldNotes(fresh,0).unresolved,1);
 assert.equal(simplifyHeldNotes(project,2).changed,0);
});
test('held priorities use original inherited onset V, not subsequent volume changes',()=>{
 const held=[n(1,0,128,60,2),n(2,1,128,61,null),...Array.from({length:8},(_,i)=>n(i+3,2,128,62+i,12))];
 const result=simplifyHeldNotes(p([...held,n(20,32,8,90,15)]),0,new Set([2,3]));
 assert.equal(result.notes.find(n=>n.id===2).length,31);assert.equal(result.notes.find(n=>n.id===3).length,128);
});
test('chords require exact onset and length, retain outer pitches and other instruments',()=>{
 const project=p([n(1,0,32,60),n(2,0,32,64),n(3,0,32,67),n(4,1,32,65),n(5,0,33,65),n(6,0,32,65,8,1)]),before=JSON.stringify(project);
 const result=simplifyChords(project,0);assert.deepEqual(result.notes.map(n=>n.id),[1,3,4,5,6]);assert.equal(result.removed,1);assert.equal(JSON.stringify(project),before);
 assert.equal(simplifyChords({...project,notes:result.notes},0).changed,0);
 assert.equal(simplifyChords(project,0,new Set([1,2])).changed,0);
});
test('chord removal preserves inherited V and transfers onset instructions',()=>{
 const project=p([n(1,0,32,60,null),n(2,0,32,72,null),{...n(3,0,32,64,13),tempo:150,timeSignature:'3/4'},n(4,64,8,65,null)]);
 const before=resolveVolumes(project.notes),r=simplifyChords(project,0),after=resolveVolumes(r.notes);
 assert.equal(r.removed,1);assert.equal(r.notes[0].tempo,150);assert.equal(r.notes[0].timeSignature,'3/4');
 for(const note of r.notes)assert.equal(after.get(note.id),before.get(note.id));
});
test('existing note tools restrict edits to selected groups',()=>{
 const project=p([n(1,1,4,60),n(2,5,3,64),n(3,20,64,70),n(4,32,32,70)]);
 const timing=simplifyTiming(project,0,64,Infinity,new Set([1,2]));assert.equal(timing.notes[2],project.notes[2]);assert.equal(timing.notes[3],project.notes[3]);
 const overlap=removeOverlap(project,0,new Set([1,2]));assert.equal(overlap.changed,0);
 assert.equal(removeOverlap(project,0,new Set([3,4])).shortened,1);
});
test('complexity caps chords with evenly spaced pitches and optional scale preference',()=>{
 const project=p([60,62,64,66,68,70,72].map((pitch,i)=>n(i+1,0,32,pitch)));
 assert.deepEqual(simplifyChords(project,0,undefined,4).notes.map(n=>n.pitch),[60,64,68,72]);
 assert.deepEqual(simplifyChords(project,0,undefined,3).notes.map(n=>n.pitch),[60,66,72]);
 const close=p([60,65,66,67,72].map((pitch,i)=>n(i+1,0,32,pitch)));
 assert.deepEqual(simplifyChords(close,0,undefined,3,[0,2,4,5,7,9,11]).notes.map(n=>n.pitch),[60,65,72]);
 assert.equal(simplifyChords(project,0,undefined,8).changed,0);
 assert.throws(()=>simplifyChords(project,0,undefined,1),/at least 2/);
 for(let count=3;count<=20;count++)for(let complexity=2;complexity<count;complexity++){
  const chord=p(Array.from({length:count},(_,i)=>n(i+1,0,32,48+i)));
  const r=simplifyChords(chord,0,undefined,complexity);assert.equal(r.notes.length,complexity);assert.equal(r.notes[0].pitch,48);assert.equal(r.notes.at(-1).pitch,47+count);
 }
});
test('scale estimate uses melodic duration and velocity, ignores silent notes and drums',()=>{
 const project=p([60,62,64,65,67,69,71,72].map((pitch,i)=>n(i+1,0,i===0?128:16,pitch)));
 const estimate=detectScale(project);assert.equal(estimate.name,'C major');assert.equal(estimate.coverage,1);
 project.instruments[1].isDrum=true;project.notes.push(n(20,0,99999,61,15,1),n(21,0,99999,63,15,2),n(22,0,99999,66,0));
 assert.deepEqual(detectScale(project),estimate);assert.equal(detectScale(p([])),null);
});
