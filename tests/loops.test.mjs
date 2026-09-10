import {test} from 'node:test';
import assert from 'node:assert/strict';
import {expandLoops,loopRegions} from '../dist/music/loops.js';
import {generateMml} from '../dist/music/mml.js';
import {importMml} from '../dist/import/mml.js';
import {createSheetPlanner} from '../dist/music/sheets.js';
import {compilePlayback,heldPlaybackNotes} from '../dist/playback/midi.js';
import {tempoMap} from '../dist/music/tempo.js';
import {parse} from '../dist/model/serialization.js';
import {readSMF} from '../dist/import/smf.js';
import {projectSegment,mergeSegment} from '../dist/model/segment-view.js';
import {sliceProject} from '../dist/music/structure.js';
import {speedMap} from '../dist/music/speed.js';
const note=(id,start,length,pitch=60,extra={})=>({id,start,length,pitch,instrument:0,volume:null,...extra});
const marker=(id,start,extra)=>note(id,start,1,60,{instrument:1,volume:0,...extra});
const project=notes=>({format:'mml-studio',version:2,grid:4,instruments:[{name:'Piano',color:'#4488aa'},{name:'Instructions',color:'#579dff',isInstructions:true}],notes});
const music=p=>p.notes.filter(n=>!p.instruments[n.instrument].isInstructions).sort((a,b)=>a.start-b.start||a.id-b.id).map(n=>[n.start,n.length,n.pitch]);
test('multiplier clock nests, exits, repeats and restores source tempo',()=>{
 const p=project([note(1,0,128),marker(2,16,{speedEntry:true,speedMultiplier:2}),marker(3,32,{speedEntry:true,speedMultiplier:1.5}),marker(4,64,{speedExit:true,tempo:100}),marker(5,96,{speedExit:true}),marker(6,32,{loopEntry:true,loopCount:2}),marker(7,96,{loopExit:true,loopTie:true})]);
 assert.deepEqual(tempoMap(p.notes).map(t=>[t.tick,t.bpm]),[[0,120],[16,240],[32,360],[64,200],[96,100]]);
 const before=JSON.stringify(p),expanded=expandLoops(p),plan=compilePlayback(p);
 assert.deepEqual(tempoMap(expanded.project.notes).map(t=>[t.tick,t.bpm]),[[0,120],[16,240],[32,360],[64,200],[96,360],[128,200],[160,100]]);
 assert.deepEqual(plan.map,tempoMap(expanded.project.notes));
 assert.equal(plan.sourceTick(100),36);assert.equal(plan.end,192);
 const mml=generateMml(p,0);assert.doesNotMatch(mml.channels[0],/t(?:240|360|200)/);
 assert.equal(JSON.stringify(p),before);assert.deepEqual(parse(before),p);
});
test('multiplier projection and export cuts inherit nested zones without parent edits',()=>{
 const p=project([note(1,0,160),marker(2,0,{speedEntry:true,speedMultiplier:2}),marker(3,32,{speedEntry:true,speedMultiplier:3}),marker(4,64,{speedExit:true}),marker(5,128,{speedExit:true})]);
 for(const start of [0,32,48,64,96,128]){
  const view=projectSegment(p,{kind:'segment',name:'Part',start,end:160});
  const expected=tempoMap(p.notes).filter(t=>t.tick>start).map(t=>({tick:t.tick-start,bpm:t.bpm}));
  expected.unshift({tick:0,bpm:tempoMap(p.notes).findLast(t=>t.tick<=start).bpm});
  assert.deepEqual(tempoMap(view.project.notes),expected);
  assert.deepEqual(tempoMap(sliceProject(p,start,160).notes),expected);
  assert.equal(JSON.stringify(mergeSegment(p,view,view.project,[0,1])),JSON.stringify(p));
 }
 const view=projectSegment(p,{kind:'segment',name:'Part',start:48,end:160});
 view.project.notes.find(n=>n.id===4).speedEntry=true;view.project.notes.find(n=>n.id===4).speedMultiplier=0.5;
 const merged=mergeSegment(p,view,view.project,[0,1]);assert.equal(merged.notes.find(n=>n.id===4).speedMultiplier,0.5);assert.equal(merged.notes.length,p.notes.length);
});
test('multiplier sheets rebase speed independently of tempo, and malformed metadata fails',()=>{
 const p=project([note(1,0,128),marker(2,32,{speedEntry:true,speedMultiplier:2}),marker(3,96,{speedExit:true})]);
 const planner=createSheetPlanner(p,0,1000);
 const result=importMml(planner.render(48,112).channels[0]);
 assert.equal(music(result.project)[0][1],40);
 assert.match(generateMml(project([note(1,0,32),marker(2,0,{speedExit:true})]),0).warnings.join(' '),/no Entry/);
 for(const value of [0,-1,'2',null])assert.throws(()=>parse(JSON.stringify(project([marker(1,0,{speedMultiplier:value})]))));
 for(const key of ['speedEntry','speedExit'])assert.throws(()=>parse(JSON.stringify(project([marker(1,0,{[key]:1})]))));
 assert.deepEqual(speedMap(project([marker(1,0,{speedEntry:true})]).notes),[{tick:0,multiplier:2}]);
});
test('nested loops multiply only their region; following notes shift and source remains intact',()=>{
 const p=project([note(1,0,4),note(2,8,4,62),note(3,16,4,64),note(4,24,4,65),note(5,32,4,67),marker(6,0,{loopEntry:true,loopCount:2}),marker(7,8,{loopEntry:true,loopCount:3}),marker(8,16,{loopExit:true}),marker(9,32,{loopExit:true})]);
 const before=JSON.stringify(p),e=expandLoops(p);
 assert.deepEqual(music(e.project).map(n=>[n[0],n[2]]),[[0,60],[8,62],[16,62],[24,62],[32,64],[40,65],[48,60],[56,62],[64,62],[72,62],[80,64],[88,65],[96,67]]);
 assert.equal(e.end,100);assert.equal(e.sourceTick(57),9);assert.equal(e.performanceTick(33),97);assert.equal(JSON.stringify(p),before);
 assert.equal(loopRegions(p).roots[0].children.length,1);
 const result=generateMml(p,0),decoded=importMml(result.channels[0]).project;
 assert.deepEqual(music(decoded),music(e.project));assert.equal(createSheetPlanner(p,0,10000).whole.bytes,result.bytes);
 assert.deepEqual(music(compilePlayback(p).project),music(e.project));
});
test('loop ties implement A, B and C, but exact Entry starts and Exit ends retrigger',()=>{
 for(const [start,end,expected] of [[4,24,[[4,36,60]]],[8,28,[[8,36,60]]],[4,28,[[4,40,60]]],[8,24,[[8,16,60],[24,16,60]]]]){
  const p=project([note(1,start,end-start),marker(2,8,{loopEntry:true,loopCount:2}),marker(3,24,{loopExit:true,loopTie:true})]);
  assert.deepEqual(music(expandLoops(p).project),expected);
  assert.deepEqual(music(importMml(generateMml(p,0).channels[0]).project),expected);
  const midi=readSMF(new Uint8Array(compilePlayback(p).binary));
  assert.deepEqual(midi.events.filter(e=>(e.status&240)===144).map(e=>e.tick),expected.map(n=>n[0]));
  assert.deepEqual(midi.events.filter(e=>(e.status&240)===128).map(e=>e.tick),expected.map(n=>n[0]+n[1]));
 }
 const p=project([note(1,4,24),marker(2,8,{loopEntry:true,loopCount:2}),marker(3,24,{loopExit:true,loopTie:false})]);
 assert.deepEqual(music(expandLoops(p).project),[[4,20,60],[24,20,60]]);
});
test('adjacent loops, count one and trailing loop silence retain the complete performance clock',()=>{
 const p=project([note(1,0,4),note(2,32,4,62),marker(3,0,{loopEntry:true,loopCount:1}),marker(4,32,{loopExit:true,loopEntry:true,loopCount:2}),marker(5,64,{loopExit:true})]);
 assert.deepEqual(music(expandLoops(p).project),[[0,4,60],[32,4,62],[64,4,62]]);
 const plan=createSheetPlanner(p,0,10000);assert.equal(plan.end,96);assert.equal(compilePlayback(p).end,96);assert.deepEqual(plan.whole,generateMml(p,0));
 assert.match(plan.whole.channels[0],/r/);
});
test('ties match different boundary notes one-to-one by instrument and pitch',()=>{
 const p=project([note(1,4,8),note(2,20,4),note(3,20,4),note(4,20,4,62),marker(5,8,{loopEntry:true,loopCount:2}),marker(6,24,{loopExit:true,loopTie:true})]);
 assert.deepEqual(music(expandLoops(p).project),[[4,8,60],[20,8,60],[20,4,60],[20,4,62],[36,4,60],[36,4,60],[36,4,62]]);
});
test('repeated tempo and volume context agree between MML, playback and held-note restoration',()=>{
 const p=project([note(1,0,4,65,{volume:4,tempo:90}),note(2,8,4),note(3,16,4,62,{volume:12,tempo:180}),note(4,24,4,64),marker(5,8,{loopEntry:true,loopCount:2}),marker(6,24,{loopExit:true})]);
 const e=expandLoops(p),map=tempoMap(e.project.notes);
 assert.deepEqual(map, [{tick:0,bpm:90},{tick:8,bpm:90},{tick:16,bpm:180},{tick:24,bpm:90},{tick:32,bpm:180},{tick:40,bpm:180}]);
 assert.deepEqual(e.project.notes.filter(n=>n.instrument===0).map(n=>n.volume),[4,4,12,4,12,12]);
 const plan=compilePlayback(p);assert.deepEqual(plan.map,map);
 assert.deepEqual(heldPlaybackNotes(plan.project,plan.channels,25),[{channel:0,pitch:60,velocity:34}]);
 const decoded=importMml(generateMml(p,0).channels[0]).project;assert.deepEqual(music(decoded),music(e.project));
});
test('unclosed loops warn and remain saveable; complete nested children still run',()=>{
 const p=project([note(1,8,4),marker(2,0,{loopEntry:true,loopCount:5}),marker(3,8,{loopEntry:true,loopCount:2}),marker(4,16,{loopExit:true})]);
 assert.deepEqual(music(expandLoops(p).project),[[8,4,60],[16,4,60]]);
 assert.match(generateMml(p,0).warnings.join(' '),/Entry at 0 has no Exit/);assert.match(compilePlayback(p).warnings.join(' '),/no Exit/);assert.deepEqual(parse(JSON.stringify(p)),p);
 const unmatched=project([note(1,0,8),marker(2,0,{loopEntry:true})]);assert.equal(expandLoops(unmatched).project,unmatched);assert.match(generateMml(unmatched,0).warnings.join(' '),/no Exit/);
 for(const value of [0,-1,1.5,'2',null])assert.throws(()=>parse(JSON.stringify(project([marker(1,0,{loopEntry:true,loopCount:value})]))));
 for(const key of ['loopEntry','loopExit','loopTie'])assert.throws(()=>parse(JSON.stringify(project([marker(1,0,{[key]:1})]))));
});
test('loop edits in segment views reconcile optional metadata into the parent',()=>{
 const p=project([note(1,0,64),marker(2,8,{loopEntry:true,loopCount:2}),marker(3,24,{loopExit:true})]),projection=projectSegment(p,{kind:'segment',name:'Loop',start:0,end:32});
 const edited=structuredClone(projection.project);edited.notes.find(n=>n.id===2).loopCount=4;edited.notes.find(n=>n.id===3).loopTie=true;
 const merged=mergeSegment(p,projection,edited,[0,1]);assert.equal(merged.notes.find(n=>n.id===2).loopCount,4);assert.equal(merged.notes.find(n=>n.id===3).loopTie,true);
});
