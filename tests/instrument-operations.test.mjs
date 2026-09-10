import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deleteInstrument,mergeInstruments,instrumentVolumes,shiftInstrumentVolumes,projectVolumes,shiftProjectVolumes} from '../dist/model/instrument-operations.js';
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
test('merge preserves simultaneous volume differences, retains overlaps and protects silent event roles',()=>{
 const p=fixture();p.notes[1].start=0;p.notes[1].pitch=60;
 const result=mergeInstruments(p,0,1);assert.equal(result.volumeConflict,false);assert.equal(result.project.notes.length,4);
 assert.deepEqual(result.project.notes.slice(0,2).map(n=>volumeAt(result.project,n)),[12,8]);
 p.instruments[0].isInstructions=true;assert.throws(()=>mergeInstruments(p,0,1),/silent Instructions/);
 p.instruments[1].isInstructions=true;assert.throws(()=>mergeInstruments(p,0,1),/silent Instructions/);
 assert.throws(()=>mergeInstruments(p,0,0),/different/);assert.throws(()=>deleteInstrument(p,-1),/existing/);
});

import {splitNotes,splitDrumkit,parseSplitPitch} from '../dist/model/instrument-operations.js';
import {MS2_DRUMS} from '../dist/playback/drums.js';
import {generateMml} from '../dist/music/mml.js';
import {compilePlayback} from '../dist/playback/midi.js';
import {readSMF} from '../dist/import/smf.js';
test('MS2 drums persist, play fixed percussion keys and export only C4 without changing notes',()=>{
 for(const [key,preset] of Object.entries(MS2_DRUMS)){
  const p=fixture();p.instruments[0].ms2Drum=key;const before=JSON.stringify(p);
  assert.deepEqual(parse(before),p);
  const midi=readSMF(new Uint8Array(compilePlayback(p).binary));
  const hits=midi.events.filter(e=>(e.status>>4)===9&&(e.status&15)===9);
  assert.equal(hits.length,2);assert.ok(hits.every(e=>e.data[0]===preset.pitch));
  const mml=generateMml(p,0);assert.ok(mml.channels.every(s=>s.includes('o4')&&!/[abdefg]/.test(s)));assert.equal(mml.warnings.some(w=>w.includes('not a valid MS2')),false);
  assert.equal(JSON.stringify(p),before);
 }
 const p=fixture();p.instruments[0].ms2Drum='invalid';assert.throws(()=>parse(JSON.stringify(p)),/MS2 drum/);
 p.instruments[0].ms2Drum='bass';p.instruments[0].isDrum=true;assert.throws(()=>parse(JSON.stringify(p)),/MS2 drum/);
});
test('Instructions cannot be deleted or merged; deleting the last musical lane retains its events',()=>{
 const p=fixture();p.instruments=p.instruments.slice(0,2);p.instruments[1].isInstructions=true;p.instruments[1].color="#579dff";
 p.notes=p.notes.filter(n=>n.instrument<2);p.notes[1].tempo=90;
 assert.throws(()=>deleteInstrument(p,1),/permanent lane/);
 assert.throws(()=>mergeInstruments(p,0,1),/silent Instructions/);
 const result=deleteInstrument(p,0);
 assert.equal(result.instruments.length,2);assert.equal(result.instruments[0].name,'Piano');
 assert.deepEqual(result.notes,p.notes.filter(n=>n.instrument===1));
 assert.deepEqual(parse(JSON.stringify(result)),result);
});
test('legacy version-2 Instructions lanes consolidate without losing events or musical routing',()=>{
 const p=fixture();p.instruments[0].isInstructions=true;p.instruments[2].isInstructions=true;
 const loaded=parse(JSON.stringify(p));
 assert.equal(loaded.instruments.filter(i=>i.isInstructions).length,1);
 assert.equal(loaded.notes.length,p.notes.length);assert.deepEqual(tempoMap(loaded.notes),tempoMap(p.notes));
 for(const n of loaded.notes){const before=p.notes.find(o=>o.id===n.id);assert.deepEqual({...n,instrument:before.instrument},before);assert.equal(!!loaded.instruments[n.instrument].isInstructions,!!p.instruments[before.instrument].isInstructions);}
});
test('split exact pitch preserves source and destination inheritance, tempos, IDs and timing',()=>{
 const p=fixture(),before=JSON.stringify(p);const r=splitNotes(p,0,1,60);
 assert.equal(r.count,2);assert.equal(r.project.instruments.length,3);assert.equal(r.project.notes.filter(n=>n.instrument===0).length,0);
 for(const n of r.project.notes){const original=p.notes.find(o=>o.id===n.id);assert.deepEqual([n.start,n.length,n.pitch,n.tempo],[original.start,original.length,original.pitch,original.tempo]);assert.equal(volumeAt(r.project,n),volumeAt(p,original));}
 assert.equal(JSON.stringify(p),before);assert.equal(splitNotes(p,0,1,35).project,p);
 assert.equal(parseSplitPitch('B1'),35);assert.equal(parseSplitPitch(' C#3 '),49);assert.throws(()=>parseSplitPitch('wat'));
 p.notes[1].start=0;assert.equal(splitNotes(p,0,1,60).volumeConflict,false);
});
test('Split Drumkit categorizes kicks, snares and all cymbals; retains other percussion and skips empty categories',()=>{
 const p=fixture();p.instruments[0].isDrum=true;
 const pitches=[35,36,38,40,42,44,46,49,51,52,53,55,57,59,37,39,41,54,60];
 p.notes=pitches.map((pitch,id)=>({id,instrument:0,start:id*7,length:5,pitch,volume:id===0?11:null,...(id===2?{tempo:150}:{})}));
 const r=splitDrumkit(p,0);assert.equal(r.count,14);assert.equal(r.project.instruments.length,6);
 assert.deepEqual(r.project.notes.filter(n=>n.instrument===0).map(n=>n.pitch),[37,39,41,54,60]);
 for(const n of r.project.notes){assert.equal(n.volume,11);assert.equal(n.id,p.notes[n.id].id);assert.equal(n.tempo,p.notes[n.id].tempo);}
 assert.deepEqual(parse(JSON.stringify(r.project)),r.project);
 p.notes=p.notes.filter(n=>n.pitch===36);const one=splitDrumkit(p,0);assert.equal(one.project.instruments.length,4);assert.equal(one.project.instruments[3].ms2Drum,'bass');
 assert.equal(splitDrumkit(one.project,0).count,0);
});

test('shifting an instrument moves every note by the same amount, keeping the differences',()=>{
  const project=parse(JSON.stringify({...fixture(),notes:[
    {id:1,instrument:0,start:0,length:8,pitch:60,volume:4},
    {id:2,instrument:0,start:8,length:8,pitch:62,volume:null},
    {id:3,instrument:0,start:16,length:8,pitch:64,volume:9},
    {id:4,instrument:1,start:0,length:8,pitch:48,volume:2}]}));
  assert.deepEqual(instrumentVolumes(project,0),{min:4,max:9,headroom:6,floor:4});

  // Up by four: the six between the two notes survives, and the inheriting note follows.
  const raised={...project,notes:shiftInstrumentVolumes(project,0,4)};
  assert.deepEqual(raised.notes.map(n=>volumeAt(raised,n)),[8,8,13,2]);
  assert.equal(raised.notes[3].volume,2,'other instruments are left alone');

  // Down again, and negative amounts are the same operation in the other direction.
  const lowered={...raised,notes:shiftInstrumentVolumes(raised,0,-4)};
  assert.deepEqual(lowered.notes.map(n=>volumeAt(lowered,n)),[4,4,9,2]);
});

test('an instrument that never had a volume set gets one written once, and inheritance spreads it',()=>{
  const project=parse(JSON.stringify({...fixture(),notes:[
    {id:1,instrument:0,start:0,length:8,pitch:60,volume:null},
    {id:2,instrument:0,start:8,length:8,pitch:62,volume:null}]}));
  assert.deepEqual(instrumentVolumes(project,0),{min:8,max:8,headroom:7,floor:8});
  const raised={...project,notes:shiftInstrumentVolumes(project,0,3)};
  assert.equal(raised.notes[0].volume,11,'written on the first note');
  assert.equal(raised.notes[1].volume,null,'the second still inherits');
  assert.deepEqual(raised.notes.map(n=>volumeAt(raised,n)),[11,11]);
});

test('nothing leaves the V0 to V15 range, however far it is pushed',()=>{
  const project=parse(JSON.stringify({...fixture(),notes:[
    {id:1,instrument:0,start:0,length:8,pitch:60,volume:2},
    {id:2,instrument:0,start:8,length:8,pitch:62,volume:14}]}));
  const up={...project,notes:shiftInstrumentVolumes(project,0,99)};
  assert.deepEqual(up.notes.map(n=>n.volume),[15,15],'clamped, and the difference is lost - the interface warns but permits this step');
  const down={...project,notes:shiftInstrumentVolumes(project,0,-99)};
  assert.deepEqual(down.notes.map(n=>n.volume),[0,0]);
  assert.equal(shiftInstrumentVolumes(project,0,0),project.notes,'no amount, no work');
});

test('the whole piece moves as one, keeping the distance between the parts',()=>{
  const project=parse(JSON.stringify({...fixture(),notes:[
    {id:1,instrument:0,start:0,length:8,pitch:60,volume:5},
    {id:2,instrument:0,start:8,length:8,pitch:62,volume:9},
    {id:3,instrument:1,start:0,length:8,pitch:48,volume:3},
    {id:4,instrument:2,start:0,length:8,pitch:72,volume:12}]}));
  const before=projectVolumes(project);
  assert.equal(before.min,3);
  assert.equal(before.max,12);
  assert.equal(before.headroom,3,'the loudest instrument decides how much room is left');
  assert.equal(before.loudestInstrument,2);
  assert.equal(before.quietestInstrument,1);

  const raised={...project,notes:shiftProjectVolumes(project,3)};
  assert.deepEqual(raised.notes.map(n=>n.volume),[8,12,6,15]);
  // Every gap survives: four inside the first instrument, and nine between the quietest
  // part and the loudest, which is the balance of the arrangement.
  assert.equal(raised.notes[1].volume-raised.notes[0].volume,4);
  assert.equal(raised.notes[3].volume-raised.notes[2].volume,9);

  const lowered={...raised,notes:shiftProjectVolumes(raised,-3)};
  assert.deepEqual(lowered.notes.map(n=>n.volume),[5,9,3,12],'and back again');
});

test('the silent Instructions lane is left out of the reading and the move',()=>{
  const project=parse(JSON.stringify({format:'mml-studio',version:2,grid:4,
    instruments:[{name:'Piano',color:'#77baff',midiProgram:0},{name:'Instructions',color:'#f4d35e',isInstructions:true}],
    notes:[{id:1,instrument:0,start:0,length:8,pitch:60,volume:6},
      {id:2,instrument:1,start:0,length:1,pitch:60,volume:0,tempo:120}]}));
  assert.equal(projectVolumes(project).min,6,'the V0 marker is not the quietest note, it is an instruction');
  const raised={...project,notes:shiftProjectVolumes(project,2)};
  assert.deepEqual(raised.notes.map(n=>n.volume),[8,0],'the instruction keeps its V0');
});

test('instrument volume shifts inherited default notes before later explicit carriers',()=>{
 const project={...fixture(),notes:[{id:1,instrument:0,start:0,length:8,pitch:60,volume:null},{id:2,instrument:0,start:8,length:8,pitch:62,volume:14}]};
 const raised={...project,notes:shiftInstrumentVolumes(project,0,5)};
 assert.deepEqual(raised.notes.map(n=>volumeAt(raised,n)),[13,15]);
});
