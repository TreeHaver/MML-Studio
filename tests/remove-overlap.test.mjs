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
test('touching notes, gaps and Instructions are unchanged; same-onset duplicates remain positive',()=>{
 const p=project([note(1,0,5),note(2,5,2),note(3,10,2)]);assert.equal(removeOverlap(p,0).notes,p.notes);
 assert.equal(removeOverlap(p,2).notes,p.notes);
 const r=removeOverlap(project([note(1,0,20),note(2,0,30),note(3,7,4)]),0);
 assert.deepEqual(r.notes.map(n=>n.length),[7,7,4]);assert.equal(r.duplicates,1);
});
test('scoped overlap edits preserve both outside portions of a crossing parent note',()=>{
 const p=project([note(1,0,100),note(2,40,10)]),before=JSON.stringify(p);
 const projection=projectSegment(p,{kind:'segment',name:'Solo',start:20,end:60});
 const result=removeOverlap(projection.project,0),edited={...projection.project,notes:result.notes};
 const merged=mergeSegment(p,projection,edited,[0,1,2]);
 assert.deepEqual(merged.notes.filter(n=>n.id!==2).map(n=>[n.start,n.length]).sort((a,b)=>a[0]-b[0]),[[0,20],[20,20],[60,40]]);
 assert.equal(JSON.stringify(p),before);
});
