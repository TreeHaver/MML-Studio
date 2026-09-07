import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hasOverlappingNotes,crowdedRegions} from '../dist/music/note-density.js';
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
 assert.deepEqual(scoped.notes.filter(n=>n.instrument===0).map(n=>[n.start,n.length]),[[0,64],[0,64]]);
 assert.deepEqual(parse(JSON.stringify(scoped)),scoped);assert.doesNotThrow(()=>compilePlayback(scoped));
 assert.deepEqual(mergeSegment(p,projection,scoped,scoped.instruments.map((_,i)=>i<p.instruments.length?i:-1)).notes,p.notes);
 assert.deepEqual(p,before);
 p.instruments.push({name:'Instructions',color:'#f4d35e',isInstructions:true});
 p.notes.push({...note(3,32,1,60,1),loopEntry:true,loopCount:2},{...note(4,64,1,60,1),loopExit:true});
 const loopBefore=structuredClone(p),loopMml=generateMml(p,0);
 assert.match(loopMml.warnings.join(' '),/Overlapping notes/);assert.equal(loopMml.channels.length,2);
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
test('yellow regions identify strictly more than ten sounding notes, with exact endpoint handling',()=>{
 const base=Array.from({length:10},(_,i)=>note(i,0,100,60+i));
 assert.deepEqual(crowdedRegions(base),[]);
 assert.deepEqual(crowdedRegions([...base,note(11,20,10),note(12,30,10),note(13,70,20)]),[{start:20,end:40},{start:70,end:90}]);
 assert.deepEqual(crowdedRegions([...base,note(11,100,10)]),[]);
 assert.deepEqual(crowdedRegions([...base,note(11,20,50),note(12,30,20)]),[{start:20,end:70}]);
});
