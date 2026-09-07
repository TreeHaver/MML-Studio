import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fresh} from '../dist/model/project.js';
import {rangeAt,projectSegment,mergeSegment,projectEnd} from '../dist/model/segment-view.js';
import {generateMml} from '../dist/music/mml.js';
import {createSheetPlanner} from '../dist/music/sheets.js';
import {tempoAt} from '../dist/music/tempo.js';
import {signatureAt,measureLines} from '../dist/music/structure.js';
import {parse} from '../dist/model/serialization.js';
import {compilePlayback} from '../dist/playback/midi.js';
const marker=(id,start,section,resetMeasures=false,extra={})=>({id,start,section,resetMeasures,instrument:1,pitch:60,length:1,volume:0,...extra});
const note=(id,start,length,extra={})=>({id,start,length,instrument:0,pitch:60,volume:null,...extra});
const album=()=>({...fresh(),name:'Album',instruments:[{name:'Piano',color:'#abcdef',midiProgram:0},{name:'Instructions',color:'#f4d35e',isInstructions:true}],notes:[
 note(1,0,16,{volume:5,tempo:90}),note(2,70,150),note(3,110,12,{pitch:64}),note(4,230,100,{pitch:67}),marker(5,0,'First song',true,{timeSignature:'6/8'}),marker(6,96,'Solo'),marker(7,160,'Chorus',false,{tempo:150}),marker(8,256,'Second song',true,{timeSignature:'3/4'}),marker(9,400,'Ending tempo',false,{tempo:100})]});
const indexes=p=>p.instruments.map((_,i)=>i);

test('view generation and later edits rebuild compact L/V instructions and limit counts',()=>{
 const p={...album(),notes:[marker(100,0,'Song',true),marker(101,256,'Solo'),
  ...Array.from({length:16},(_,i)=>note(i+1,256+i*8,8,{volume:11}))]};
 const before=JSON.stringify(p),view=projectSegment(p,rangeAt(p,256,'segment')).project;
 const first=generateMml(view,0);assert.equal(first.channels[0],'t120o4v11l16'+'c'.repeat(16));
 assert.equal(createSheetPlanner(view,0,first.bytes).split().length,1);
 view.notes=view.notes.map(n=>n.instrument===0?{...n,length:4,volume:8}:n);
 const edited=generateMml(view,0);
 assert.match(edited.channels[0],/l32/);assert.doesNotMatch(edited.channels[0],/v/);
 assert.equal(edited.bytes,createSheetPlanner(view,0,10000).whole.bytes);
 assert.notEqual(edited.channels[0],first.channels[0]);assert.equal(JSON.stringify(p),before);
});

test('Song boundaries ignore Segments; Segment boundaries stop at either marker kind',()=>{
 const p=album();assert.deepEqual(rangeAt(p,120,'song'),{kind:'song',name:'First song',start:0,end:256});
 assert.deepEqual(rangeAt(p,120,'segment'),{kind:'segment',name:'Solo',start:96,end:160});
 assert.equal(rangeAt(p,180,'segment').end,256);assert.equal(rangeAt(p,256,'song').name,'Second song');
 assert.equal(rangeAt(p,300,'song').end,401);assert.equal(projectEnd(p),401);
 assert.equal(rangeAt(p,401,'song'),null);
 assert.equal(rangeAt({...p,notes:p.notes.filter(n=>n.id!==5)},0,'segment'),null);
});

test('projection rebases/clips, inherits context, optimizes channels and does not mutate its parent',()=>{
 const p=album(),before=structuredClone(p),range=rangeAt(p,120,'segment'),projection=projectSegment(p,range),v=projection.project;
 assert.deepEqual(v.notes.filter(n=>n.instrument===0).map(n=>[n.id,n.start,n.length,n.volume]),[[2,0,64,5],[3,14,12,null]]);
 assert.equal(tempoAt(v.notes,0),90);assert.equal(signatureAt(v,0),'6/8');assert.equal(measureLines(v,0,1)[0].bar,1);
 assert.ok(!v.notes.some(n=>n.tempo===150));assert.ok(!generateMml(v,0).channels.some(s=>s.includes('t150')));
 assert.equal(generateMml(v,0).bytes,createSheetPlanner(v,0,10000).whole.bytes);
 assert.equal(compilePlayback(v,64).end,64);assert.deepEqual(p,before);assert.deepEqual(mergeSegment(p,projection,v,indexes(v)),p);
 const crowded=structuredClone(p);for(let i=0;i<12;i++)crowded.notes.push(note(20+i,270,40,{pitch:60+i}));
 assert.ok(generateMml(crowded,0).channels.length>10);assert.equal(generateMml(projectSegment(crowded,range).project,0).channels.length,2);
 const rest={...p,notes:[note(1,0,16),marker(2,0,'One',true),marker(3,512,'Two',true)]};
 const restView=projectSegment(rest,rangeAt(rest,0,'song'));assert.equal(compilePlayback(restView.project,512).end,512);
});

test('editing or deleting a clipped note changes only the viewed portion; untouched notes remain whole',()=>{
 const p=album(),range=rangeAt(p,120,'segment'),projection=projectSegment(p,range),v=structuredClone(projection.project);
 v.notes.find(n=>n.id===2).pitch=72;
 const edited=mergeSegment(p,projection,v,indexes(v));
 assert.deepEqual(edited.notes.filter(n=>n.pitch===60&&n.id!==1&&n.instrument===0).map(n=>[n.start,n.length]),[[70,26],[160,60]]);
 const inside=edited.notes.find(n=>n.pitch===72);assert.deepEqual([inside.start,inside.length,inside.volume],[96,64,5]);
 assert.deepEqual(edited.notes.find(n=>n.id===4),p.notes.find(n=>n.id===4));assert.doesNotThrow(()=>parse(JSON.stringify(edited)));
 v.notes=v.notes.filter(n=>n.id!==2);const deleted=mergeSegment(p,projection,v,indexes(v));
 assert.deepEqual(deleted.notes.filter(n=>n.instrument===0&&n.pitch===60&&n.start>0).map(n=>[n.start,n.length]),[[70,26],[160,60]]);
 assert.deepEqual(p.notes.find(n=>n.id===2),note(2,70,150));
});

test('local instructions and added notes map back with unique IDs; automatic context is not saved',()=>{
 const p=album(),range=rangeAt(p,120,'segment'),projection=projectSegment(p,range),v=structuredClone(projection.project);
 const section=v.notes.find(n=>n.id===6);section.tempo=110;section.timeSignature='3/4';
 v.notes.push(note(4,40,7,{pitch:75})); // ID collides with an invisible parent note
 const edited=mergeSegment(p,projection,v,indexes(v));
 assert.equal(edited.notes.find(n=>n.id===6).tempo,110);assert.equal(edited.notes.find(n=>n.pitch===75).start,136);
 assert.equal(new Set(edited.notes.map(n=>n.id)).size,edited.notes.length);
 assert.equal(edited.notes.find(n=>n.id===4).start,230);assert.equal(edited.notes.find(n=>n.id===2).length,150);
 v.notes.find(n=>n.pitch===75).length=100;assert.throws(()=>mergeSegment(p,projection,v,indexes(v)),/beyond the current view/);
});

test('scoped lane removal preserves its outside notes, and voice edits are shared with the parent',()=>{
 const p=album(),projection=projectSegment(p,rangeAt(p,120,'segment')),v=structuredClone(projection.project);
 v.instruments[0].midiProgram=40;assert.equal(mergeSegment(p,projection,v,indexes(v)).instruments[0].midiProgram,40);
 v.notes=v.notes.filter(n=>n.instrument!==0).map(n=>({...n,instrument:0}));v.instruments.splice(0,1);
 const merged=mergeSegment(p,projection,v,[1]);assert.ok(merged.notes.some(n=>n.start===230));assert.ok(!merged.notes.some(n=>n.instrument===0&&n.start>=96&&n.start<160));
 assert.equal(merged.notes.find(n=>n.id===6).instrument,1);assert.doesNotThrow(()=>parse(JSON.stringify(merged)));
});
