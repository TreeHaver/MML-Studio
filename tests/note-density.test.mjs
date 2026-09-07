import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hasOverlappingNotes,crowdedRegions} from '../dist/music/note-density.js';
import {generateMml} from '../dist/music/mml.js';
const note=(id,start,length,pitch=60,instrument=0)=>({id,start,length,pitch,instrument,volume:null});
const project=notes=>({format:'mml-studio',version:2,grid:4,instruments:[{name:'Piano',color:'#abcdef'}],notes});
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
