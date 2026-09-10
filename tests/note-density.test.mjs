import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hasOverlappingNotes,crowdedRegions,crowdedRegionCounts,overlapLocations,sustainedOverlapSpans} from '../dist/music/note-density.js';
import {generateMml} from '../dist/music/mml.js';
import {projectSegment,mergeSegment} from '../dist/model/segment-view.js';
import {parse} from '../dist/model/serialization.js';
import {compilePlayback} from '../dist/playback/midi.js';
const note=(id,start,length,pitch=60,instrument=0)=>({id,start,length,pitch,instrument,volume:null});
const project=notes=>({format:'mml-studio',version:2,grid:4,instruments:[{name:'Piano',color:'#abcdef'}],notes});

test('clipped and loop-restarted same-pitch notes warn without correcting or rejecting music',()=>{
 const p=project([note(1,0,128),note(2,16,128)]),before=structuredClone(p);
 assert.doesNotMatch(generateMml(p,0).warnings.join(' '),/Overlapping notes/);
 const projection=projectSegment(p,{kind:'segment',name:'Overlap',start:32,end:96}),scoped=projection.project;
 const mml=generateMml(scoped,0);
 assert.match(mml.warnings.join(' '),/Overlapping notes/);assert.equal(mml.channels.length,2);
 assert.deepEqual(overlapLocations(scoped,0),[{start:0,pitch:60,ids:[1,2]}]);
 assert.deepEqual(scoped.notes.filter(n=>n.instrument===0).map(n=>[n.start,n.length]),[[0,64],[0,64]]);
 assert.deepEqual(parse(JSON.stringify(scoped)),scoped);assert.doesNotThrow(()=>compilePlayback(scoped));
 assert.deepEqual(mergeSegment(p,projection,scoped,scoped.instruments.map((_,i)=>i<p.instruments.length?i:-1)).notes,p.notes);
 assert.deepEqual(p,before);
 p.instruments.push({name:'Instructions',color:'#579dff',isInstructions:true});
 p.notes.push({...note(3,32,1,60,1),loopEntry:true,loopCount:2},{...note(4,64,1,60,1),loopExit:true});
 const loopBefore=structuredClone(p),loopMml=generateMml(p,0);
 assert.match(loopMml.warnings.join(' '),/Overlapping notes/);assert.equal(loopMml.channels.length,2);
 assert.deepEqual(overlapLocations(p,0),[{start:32,pitch:60,ids:[1,2]}]);
 assert.equal(compilePlayback(p).project.notes.filter(n=>n.instrument===0).length,4);
 assert.deepEqual(parse(JSON.stringify(p)),p);assert.deepEqual(p,loopBefore);
});
test('overlap means same onset, pitch and instrument only',()=>{
 const sustained=[note(1,0,100),note(2,10,20)];
 assert.equal(hasOverlappingNotes(sustained),false);assert.equal(generateMml(project(sustained),0).warnings.length,0);
 assert.equal(hasOverlappingNotes([note(1,0,100),note(2,0,20)]),true);
 assert.equal(hasOverlappingNotes([note(1,0,100),note(2,0,20,61)]),false);
 assert.equal(hasOverlappingNotes([note(1,0,100),note(2,0,20,60,1)]),false);
 assert.match(generateMml(project([note(1,0,100),note(2,0,20)]),0).warnings.join(' '),/Overlapping/);
 const drums=project([note(1,0,100),note(2,0,20,61)]);drums.instruments[0].ms2Drum='snare';assert.equal(generateMml(drums,0).warnings.length,0);
});

test('overlap locations are chronological, keep owners separate and ignore Instructions',()=>{
 const p=project([note(1,200,10),note(2,200,20),note(3,10,20,72),note(4,10,30,72),note(5,5,10,60,1),note(6,5,20,60,1),note(7,0,1,60,2),note(8,0,1,60,2)]);
 p.instruments.push({name:'Other',color:'#abcdef'},{name:'Instructions',color:'#abcdef',isInstructions:true});
 const before=structuredClone(p);
 assert.deepEqual(overlapLocations(p,0).map(o=>o.start),[10,200]);
 assert.deepEqual(overlapLocations(p).map(o=>o.start),[5,10,200]);
 assert.deepEqual(overlapLocations(p,2),[]);assert.deepEqual(p,before);
});
test('yellow regions identify strictly more than ten sounding notes, with exact endpoint handling',()=>{
 const base=Array.from({length:10},(_,i)=>note(i,0,100,60+i));
 assert.deepEqual(crowdedRegions(base),[]);
 assert.deepEqual(crowdedRegions([...base,note(11,20,10),note(12,30,10),note(13,70,20)]),[{start:20,end:40},{start:70,end:90}]);
 assert.deepEqual(crowdedRegions([...base,note(11,100,10)]),[]);
 assert.deepEqual(crowdedRegions([...base,note(11,20,50),note(12,30,20)]),[{start:20,end:70}]);
});

test('crowded area count reports the peak and resets between half-open areas',()=>{
 const base=Array.from({length:11},(_,i)=>note(i+1,0,20,60+i));
 const notes=[...base,note(12,4,4),note(13,8,2),...base.map(n=>({...n,id:n.id+20,start:30}))];
 assert.deepEqual(crowdedRegionCounts(notes),[{start:0,end:20,peak:12},{start:30,end:50,peak:11}]);
});

test('sustained rails identify shared lifetimes without confusing duplicates, chords or owners',()=>{
 const notes=[note(1,0,100),note(2,20,10),note(3,40,30),note(4,50,40),note(5,100,10),note(6,0,100,64),note(7,0,100,60,1)];
 const before=structuredClone(notes);
 assert.deepEqual(sustainedOverlapSpans(notes),[{instrument:0,pitch:60,start:20,end:30},{instrument:0,pitch:60,start:40,end:90}]);
 assert.deepEqual(notes,before);
 assert.deepEqual(sustainedOverlapSpans([note(1,0,100),note(2,0,30)]),[]);
 assert.deepEqual(sustainedOverlapSpans([note(1,0,100),note(2,0,30),note(3,50,100)]),[{instrument:0,pitch:60,start:50,end:100}]);
});
test('sustained spans match independent per-tick distinct-onset coverage',()=>{
 const notes=Array.from({length:180},(_,i)=>note(i,(i*37)%200,1+(i*19)%50,60+i%3,i%2));
 const spans=sustainedOverlapSpans(notes);
 for(let instrument=0;instrument<2;instrument++)for(let pitch=60;pitch<63;pitch++)for(let tick=0;tick<250;tick++){
  const starts=new Set(notes.filter(n=>n.instrument===instrument&&n.pitch===pitch&&n.start<=tick&&tick<n.start+n.length).map(n=>n.start));
  assert.equal(spans.some(s=>s.instrument===instrument&&s.pitch===pitch&&s.start<=tick&&tick<s.end),starts.size>1);
 }
});
