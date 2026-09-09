import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fresh} from '../dist/model/project.js';
import {volumeAt,resolveVolumes} from '../dist/music/volume.js';
import {compilePlayback,heldPlaybackNotes} from '../dist/playback/midi.js';
import {readSMF} from '../dist/import/smf.js';
import {importMml} from '../dist/import/mml.js';
import {generateMml} from '../dist/music/mml.js';
import {createSheetPlanner} from '../dist/music/sheets.js';
import {expandLoops} from '../dist/music/loops.js';
import {projectSegment} from '../dist/model/segment-view.js';
import {sliceProject} from '../dist/music/structure.js';
import {mergeInstruments,splitNotes,splitDrumkit} from '../dist/model/instrument-operations.js';

const note=(id,start,length,pitch,volume,instrument=0)=>({id,start,length,pitch,volume,instrument});
const project=notes=>({...fresh(),notes});
const ons=p=>readSMF(new Uint8Array(compilePlayback(p).binary)).events.filter(e=>(e.status>>4)===9).map(e=>[e.tick,e.data[0],e.data[1]]);
const decoded=p=>generateMml(p,0).channels.flatMap(c=>importMml(c).project.notes).sort((a,b)=>a.pitch-b.pitch).map(n=>[n.pitch,n.volume]);
test('unset notes inherit the newest explicit V at the onset and afterward, including V0',()=>{
 const p=project([note(1,0,8,55,9),note(9,16,8,60,13),note(10,16,8,64,5),note(8,16,8,67,null),note(11,32,8,69,null),note(12,48,8,72,0),note(13,48,8,74,13),note(14,64,8,76,null)]);
 for(const reverse of [false,true]){
  if(reverse)p.notes.reverse();const all=resolveVolumes(p.notes);
  const expected=new Map([[1,9],[9,13],[10,5],[8,5],[11,5],[12,0],[13,13],[14,13]]);
  for(const n of p.notes){assert.equal(volumeAt(p,n),expected.get(n.id));assert.equal(all.get(n.id),expected.get(n.id));}
 }
 p.notes.find(n=>n.id===13).volume=0;
 assert.equal(volumeAt(p,p.notes.find(n=>n.id===14)),0);
 assert.equal(resolveVolumes(p.notes).get(14),0);
 const unset=project([note(1,0,8,60,null)]);assert.equal(volumeAt(unset,unset.notes[0]),8);
});
test('each simultaneous explicit V, including V0, controls its own note regardless of IDs or array order',()=>{
 for(const reversed of [false,true]){
  const p=project(Array.from({length:16},(_,v)=>note(reversed?16-v:v+1,0,32,60+v,v)));
  if(reversed)p.notes.reverse();const before=JSON.stringify(p);
  assert.deepEqual(p.notes.map(n=>volumeAt(p,n)),p.notes.map(n=>n.volume));
  assert.deepEqual(ons(p).sort((a,b)=>a[1]-b[1]),Array.from({length:15},(_,i)=>[0,61+i,Math.round((i+1)*127/15)]));
  assert.deepEqual(decoded(p),Array.from({length:16},(_,v)=>[60+v,v]));
  assert.equal(JSON.stringify(p),before);
 }
});
test('seeking retains each held voice onset V despite a later instrument volume change',()=>{
 const p=project([note(1,0,128,60,13),note(2,0,128,64,5),note(3,16,8,67,0)]),plan=compilePlayback(p);
 assert.deepEqual(heldPlaybackNotes(plan.project,plan.channels,32).map(n=>[n.pitch,n.velocity]),[[60,110],[64,42]]);
});
test('MML import keeps independent channel velocities without an obsolete conflict warning',()=>{
 const imported=importMml('MML@v13c4,v5e4;');
 assert.deepEqual(ons(imported.project),[[0,60,110],[0,64,42]]);
 assert.deepEqual(imported.warnings,[]);
});
test('scoped clips, section slices, sheet cuts and loop repeats preserve distinct explicit onset volumes',()=>{
 const p=project([note(1,0,128,60,13),note(2,16,128,64,5)]),expected=[[60,13],[64,5]];
 assert.deepEqual(decoded(projectSegment(p,{kind:'segment',name:'Test',start:32,end:96}).project),expected);
 assert.deepEqual(decoded(sliceProject(p,32,96)),expected);
 const part=createSheetPlanner(p,0,10000).render(32,96);
 assert.deepEqual(part.channels.flatMap(c=>importMml(c).project.notes).map(n=>[n.pitch,n.volume]),expected);
 p.instruments.push({name:'Instructions',color:'#f4d35e',isInstructions:true});
 p.notes.push({...note(3,32,1,60,0,1),loopEntry:true,loopCount:2},{...note(4,64,1,60,0,1),loopExit:true});
 const expanded=expandLoops(p).project;
 assert.deepEqual(ons(expanded).filter(n=>n[0]===64),[[64,60,110],[64,64,42]]);
});
test('merging and splitting instruments materialize each original note volume without flattening chords',()=>{
 const p=project([note(1,0,32,60,13),note(2,0,32,64,5),note(3,0,32,67,9,1)]);
 p.instruments.push({...p.instruments[0],name:'Other'});
 for(const changed of [mergeInstruments(p,0,1).project,splitNotes(p,0,1,60).project]){
  assert.deepEqual(changed.notes.map(n=>volumeAt(changed,n)),[13,5,9]);
 }
 const drums=project([note(1,0,32,35,13),note(2,0,32,38,5),note(3,0,32,49,9)]);drums.instruments[0].isDrum=true;
 const split=splitDrumkit(drums,0).project;
 assert.deepEqual(split.notes.map(n=>volumeAt(split,n)),[13,5,9]);
});

test('optional instrument gain validates and survives version-2 scoped reconciliation',async()=>{
 const {parse}=await import('../dist/model/serialization.js');
 const {mergeSegment}=await import('../dist/model/segment-view.js');
 const p=fresh();p.instruments[0].volume=0;
 assert.equal(parse(JSON.stringify(p)).instruments[0].volume,0);
 for(const volume of [-1,101,0.5,null,'50'])assert.throws(()=>parse(JSON.stringify({...p,instruments:[{...p.instruments[0],volume}]})),/instrument volume/);
 delete p.instruments[0].volume;assert.equal(parse(JSON.stringify(p)).instruments[0].volume,undefined);
 const projection=projectSegment(p,{kind:'segment',name:'Gain',start:0,end:128});projection.project.instruments[0].volume=37;
 assert.equal(mergeSegment(p,projection,projection.project,[0]).instruments[0].volume,37);
});
