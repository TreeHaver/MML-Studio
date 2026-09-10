import {test} from 'node:test';
import assert from 'node:assert/strict';
import {playheadScroll} from '../dist/playback/follow.js';
import {tempoChanges} from '../dist/music/tempo.js';
import {ensureInstructions} from '../dist/model/instructions.js';
import {fresh} from '../dist/model/project.js';
import {parse} from '../dist/model/serialization.js';
import {compilePlayback} from '../dist/playback/midi.js';
import {readSMF} from '../dist/import/smf.js';
import {importMidi} from '../dist/import/midi.js';
import fixture from './midi-fixtures.cjs';
const {midi,event:e,end}=fixture;

test('playhead follows at the right threshold and returns to the start after a seek',()=>{
 assert.equal(playheadScroll(10,3,900,0,64),0);
 assert.equal(playheadScroll(400,3,900,0,64),573);
 assert.equal(playheadScroll(410,3,900,573,64),603);
 assert.equal(playheadScroll(0,3,900,603,64),0);
 assert.equal(playheadScroll(400,6,900,573,64),1773);
 assert.equal(playheadScroll(NaN,3,900,100,64),100);
});
test('Instructions reuse a silent lane, preserve tempo, and emit no MIDI notes or instrument tracks',()=>{
 const p=fresh(),lane=ensureInstructions(p);assert.equal(ensureInstructions(p),lane);
 p.notes=[{id:1,instrument:0,start:0,length:128,pitch:60,volume:8},
  {id:2,instrument:lane,start:32,length:1,pitch:60,volume:15,tempo:60}];
 assert.deepEqual(parse(JSON.stringify(p)),p);
 const playback=compilePlayback(p),decoded=readSMF(new Uint8Array(playback.binary));
 assert.equal(decoded.names.length,2);assert.equal(decoded.events.filter(e=>(e.status>>4)===9).length,1);
 assert.deepEqual(tempoChanges(p.notes),[{tick:32,bpm:60}]);assert.equal(playback.duration,3.5);
 p.instruments[lane].isInstructions='yes';assert.throws(()=>parse(JSON.stringify(p)),/Instructions flag/);
});
test('legacy silent tempo lanes are recognized while ordinary instruments are untouched',()=>{
 const p=fresh();p.instruments.push({name:'Tempo markers (silent)',color:'#91cdd7',midiProgram:0});
 p.notes=[{id:1,instrument:1,start:32,length:1,pitch:60,volume:0,tempo:60}];
 const loaded=parse(JSON.stringify(p));assert.equal(loaded.instruments[1].name,'Instructions');assert.equal(loaded.instruments[1].isInstructions,true);
 p.notes[0].volume=8;assert.equal(parse(JSON.stringify(p)).instruments[1].isInstructions,undefined);
});
test('tempo markers include note-bound and unbound changes and deduplicate repeated values',()=>{
 const notes=[{start:0,tempo:120},{start:16,tempo:60},{start:16,tempo:60},{start:32,tempo:60},{start:64,tempo:90}];
 assert.deepEqual(tempoChanges(notes),[{tick:16,bpm:60},{tick:64,bpm:90}]);
 assert.deepEqual(tempoChanges([{start:0,tempo:90}]),[{tick:0,bpm:90}]);
});
test('tempo-only MIDI files populate Instructions and import without audible notes',()=>{
 for(const micros of [[7,161,32],[15,66,64]]){
  const {project,noteCount}=importMidi(midi([[e(0,255,81,3,...micros),end()]]));
  assert.equal(noteCount,0);assert.equal(project.instruments[0].name,'Instructions');
  assert.equal(project.instruments[0].isInstructions,true);assert.equal(project.notes[0].volume,0);
  assert.doesNotThrow(()=>parse(JSON.stringify(project)));
  assert.equal(readSMF(new Uint8Array(compilePlayback(project).binary)).events.filter(e=>(e.status>>4)===9).length,0);
 }
});

test('loading version-2 projects normalizes old Instructions colors without changing musical data',()=>{
 for(const color of ['#f4d35e','#ff0000','#123456']){
  const p=fresh();p.instruments[0].color=color;
  p.instruments.push({name:'Instructions',color,isInstructions:true});
  p.notes=[{id:1,instrument:0,start:0,length:128,pitch:60,volume:8},{id:2,instrument:1,start:32,length:1,pitch:60,volume:0,tempo:90}];
  const source=JSON.stringify(p),loaded=parse(source);
  assert.equal(loaded.instruments[1].color,'#579dff');assert.equal(loaded.instruments[0].color,color);
  assert.deepEqual(loaded.notes,p.notes);assert.equal(loaded.version,2);assert.equal(JSON.stringify(p),source);
  assert.deepEqual(parse(JSON.stringify(loaded)),loaded);
 }
 const empty=fresh();empty.instruments.push({name:'Instructions',color:'#f4d35e',isInstructions:true});
 assert.equal(parse(JSON.stringify(empty)).instruments[1].color,'#579dff');
});
