import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deleteInstrument,mergeInstruments} from '../dist/model/instrument-operations.js';
import {parse} from '../dist/model/serialization.js';
import {tempoMap} from '../dist/music/tempo.js';
import {volumeAt} from '../dist/music/volume.js';
const fixture=()=>({format:'mml-studio',version:2,grid:4,instruments:['A','B','C'].map((name,midiProgram)=>({name,color:'#77baff',midiProgram})),notes:[
 {id:1,instrument:0,start:0,length:7,pitch:60,volume:12,tempo:150},
 {id:2,instrument:1,start:8,length:11,pitch:61,volume:null},
 {id:3,instrument:0,start:16,length:5,pitch:60,volume:null},
 {id:4,instrument:2,start:32,length:32,pitch:64,volume:9,tempo:90}]});
test('delete removes owned events, reindexes survivors and retains a valid final empty instrument',()=>{
 const p=fixture(),before=JSON.stringify(p),r=deleteInstrument(p,0);
 assert.deepEqual(r.instruments.map(i=>i.name),['B','C']);assert.deepEqual(r.notes.map(n=>[n.id,n.instrument]),[[2,0],[4,1]]);
 assert.deepEqual(tempoMap(r.notes),[{tick:0,bpm:120},{tick:32,bpm:90}]);assert.deepEqual(parse(JSON.stringify(r)),r);assert.equal(JSON.stringify(p),before);
 const empty=deleteInstrument(deleteInstrument(r,0),0);assert.equal(empty.instruments.length,1);assert.equal(empty.notes.length,0);parse(JSON.stringify(empty));
});
test('merge preserves timing, IDs, global tempo, inherited volumes and destination settings in either direction',()=>{
 for(const [source,target] of [[0,1],[1,0]]){
  const p=fixture(),before=JSON.stringify(p),{project:r,volumeConflict}=mergeInstruments(p,source,target);
  assert.equal(volumeConflict,false);assert.equal(r.notes.length,p.notes.length);assert.deepEqual(r.instruments[0],p.instruments[target]);
  assert.deepEqual(tempoMap(r.notes),tempoMap(p.notes));
  for(const n of r.notes){const original=p.notes.find(o=>o.id===n.id);assert.deepEqual([n.start,n.length,n.pitch,n.tempo],[original.start,original.length,original.pitch,original.tempo]);assert.equal(volumeAt(r,n),volumeAt(p,original));}
  assert.deepEqual(parse(JSON.stringify(r)),r);assert.equal(JSON.stringify(p),before);
 }
});
test('merge flags simultaneous volume differences, retains overlaps and protects silent event roles',()=>{
 const p=fixture();p.notes[1].start=0;p.notes[1].pitch=60;
 const result=mergeInstruments(p,0,1);assert.equal(result.volumeConflict,true);assert.equal(result.project.notes.length,4);
 p.instruments[0].isInstructions=true;assert.throws(()=>mergeInstruments(p,0,1),/silent Instructions/);
 p.instruments[1].isInstructions=true;assert.equal(mergeInstruments(p,0,1).project.instruments[0].isInstructions,true);
 assert.throws(()=>mergeInstruments(p,0,0),/different/);assert.throws(()=>deleteInstrument(p,-1),/existing/);
});
