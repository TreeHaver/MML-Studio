import {test} from 'node:test';
import assert from 'node:assert/strict';
import fixture from './midi-fixtures.cjs';
import {importMidi} from '../dist/import/midi.js';
import {readSMF} from '../dist/import/smf.js';
import {parse} from '../dist/model/serialization.js';
import {compilePlayback} from '../dist/playback/midi.js';
import {tempoAt} from '../dist/music/tempo.js';
const {midi,event:e,end}=fixture;

test('exporter overflow in velocity and pitch bend recovers with notices without changing source bytes',()=>{
 const bytes=midi([[e(0,224,80,147),e(0,80,130),e(5,144,60,129),e(0,64,135),e(7,128,60,0),e(4,64,0),end()]]);
 const original=bytes.slice(),{project,noteCount,warnings}=importMidi(bytes);
 assert.equal(noteCount,2);
 assert.deepEqual(project.notes.map(n=>[n.start,n.length,n.pitch,n.volume]),[[5,7,60,15],[5,11,64,15]]);
 assert.ok(warnings.includes('2 invalid MIDI note-on velocities above 127 were reduced to 127 (maximum volume).'));
 assert.ok(warnings.includes('2 invalid MIDI pitch-bend events were skipped; pitch bend is not imported.'));
 assert.deepEqual(bytes,original);
 assert.deepEqual(parse(JSON.stringify(project)),project);
});

test('invalid channel instructions are skipped and release velocity preserves note-off timing',()=>{
 for(const data of [[144,128,100],[128,60,129],[176,7,129],[192,129],[224,128,64]]){
  assert.ok(readSMF(midi([[e(0,...data),end()]])).warnings.some(w=>/invalid MIDI/.test(w)));
 }
 for(const status of [144,224])assert.throws(()=>readSMF(midi([[e(0,status,60)]])),/Truncated MIDI/);
 const bytes=midi([[e(0,192,40),e(0,192,200),e(0,176,64,127),e(0,176,64,200),e(0,176,200,0),e(5,144,60,100),e(7,128,60,200),e(3,176,64,0),e(0,160,60,200),e(0,208,200),end(9)]]);
 const original=bytes.slice(),{project,warnings}=importMidi(bytes);
 assert.equal(project.instruments[0].midiProgram,40);
 assert.deepEqual(project.notes.map(n=>[n.start,n.length]),[[5,10]]);
 for(const kind of ['program change','controller','release velocities','polyphonic aftertouch','channel aftertouch'])assert.ok(warnings.some(w=>w.includes(kind)),kind);
 assert.deepEqual(bytes,original);assert.deepEqual(parse(JSON.stringify(project)),project);
 const off=importMidi(midi([[e(0,144,60,100),e(7,128,60,200),end(20)]]));
 assert.equal(off.project.notes[0].length,7);
});

test('malformed metadata retains previous instructions and port, with counted notices',()=>{
 const bytes=midi([[e(0,255,33,1,2),e(0,255,81,3,15,66,64),e(0,255,88,4,3,2,24,8),
  e(0,144,60,100),e(4,255,33,1,200),e(0,255,33,0),e(0,255,81,3,0,0,0),e(0,255,81,2,1,2),
  e(0,255,88,4,0,2,24,8),e(0,255,88,3,4,2,24),e(3,128,60,0),e(0,255,47,1,99)]]);
 const original=bytes.slice(),{project,warnings}=importMidi(bytes);
 assert.equal(project.notes.find(n=>n.volume>0).length,7);
 assert.equal(tempoAt(project.notes,10),60);
 assert.deepEqual(project.notes.filter(n=>n.timeSignature).map(n=>n.timeSignature),['3/4']);
 for(const kind of ['port','tempo','time signature'])assert.ok(warnings.some(w=>w.startsWith(`2 invalid MIDI ${kind} events`)),kind);
 assert.ok(warnings.some(w=>/end-of-track.*payloads/.test(w)));
 assert.deepEqual(bytes,original);assert.deepEqual(parse(JSON.stringify(project)),project);
 // Declared payload lengths remain structural: do not read into another chunk.
 assert.throws(()=>readSMF(midi([[e(0,255,81,3,1,2)]])),/Truncated/);
});

test('MIDI time signatures become silent persistent Instructions, including signature-only files',()=>{
 const bytes=midi([[e(0,255,88,4,4,2,24,8),e(0,144,60,100),e(32,255,81,3,15,66,64),e(0,255,88,4,6,3,36,8),e(64,128,60,0),end()]]);
 const {project,noteCount,warnings}=importMidi(bytes),markers=project.notes.filter(n=>project.instruments[n.instrument].isInstructions);
 assert.equal(noteCount,1);assert.deepEqual(markers.map(n=>[n.start,n.timeSignature,n.volume]),[[0,'4/4',0],[32,'6/8',0]]);
 assert.equal(markers[1].tempo,60);assert.equal(project.notes.find(n=>n.instrument===0).timeSignature,undefined);
 assert.deepEqual(parse(JSON.stringify(project)),project);assert.ok(!warnings.some(w=>/signature/i.test(w)));
 assert.equal(readSMF(new Uint8Array(compilePlayback(project).binary)).events.filter(e=>(e.status>>4)===9).length,1);
 const only=importMidi(midi([[e(0,255,88,4,3,2,24,8),end()]]));assert.equal(only.noteCount,0);assert.equal(only.project.notes[0].timeSignature,'3/4');assert.equal(only.project.instruments[0].isInstructions,true);
});

test('MIDI signature conversion reports rounded positions, conflicts and unsupported denominators',()=>{
 const {project,warnings}=importMidi(midi([[e(1,255,88,4,3,2,24,8),e(0,255,88,4,5,3,24,8),e(1,255,88,4,7,8,24,8),end()]],96));
 assert.deepEqual(project.notes.map(n=>[n.start,n.timeSignature]),[[0,'5/8']]);
 assert.ok(warnings.some(w=>/Timing was rounded/.test(w)));assert.ok(warnings.some(w=>/Coincident time signature/.test(w)));assert.ok(warnings.some(w=>/not representable/.test(w)));
 for(const data of [[3,4,2,24],[4,0,2,24,8]])assert.ok(readSMF(midi([[e(0,255,88,...data),end()]])).warnings.some(w=>/invalid MIDI time signature/.test(w)));
});

test('large imports exceed the former note/event caps and still save and compile',()=>{
 const {project,noteCount}=importMidi(fixture.repeatedMidi(130000));
 assert.equal(noteCount,130000);assert.equal(project.notes.at(-1).start,129999);
 assert.equal(parse(JSON.stringify(project)).notes.length,130000);
 assert.equal(compilePlayback(project).end,130000);
});
test('files over 16 MiB and projects over 256 tracks / 512 lanes import intact',()=>{
 const padded=fixture.padMidi(fixture.repeatedMidi(2),17*1024*1024);
 assert.equal(importMidi(padded).noteCount,2);
 const tracks=Array.from({length:513},()=>[e(0,144,60,100),e(7,128,60,0),end()]);
 const {project}=importMidi(midi(tracks));
 assert.equal(project.instruments.length,513);assert.equal(project.notes.length,513);
});
test('MIDI tempos round to integer BPM without export-range clamping',()=>{
 for(const micros of [3000000,200000,487805,0xffffff,1]){
  const bytes=midi([[e(0,255,81,3,micros>>16,(micros>>8)&255,micros&255),e(0,144,60,100),e(7,128,60,0),end()]]);
  const {project,warnings}=importMidi(bytes),bpm=Math.round(60000000/micros);
  assert.equal(project.notes[0].tempo,bpm);
  assert.equal(parse(JSON.stringify(project)).notes[0].tempo,bpm);
  const decoded=readSMF(new Uint8Array(compilePlayback(project).binary));
  const event=decoded.events.find(e=>e.meta===81);
  const expected=Math.round(60000000/bpm);
  assert.deepEqual([...event.data],[expected>>16,(expected>>8)&255,expected&255]);
  assert.equal(warnings.some(w=>w.includes('nearest whole BPM')),Math.abs(60000000/micros-bpm)>1e-8);
  assert.ok(!warnings.some(w=>/tempo.*(clamp|limit)/i.test(w)));
 }
});

test('MIDI preserves leading rests, arbitrary integer lengths, running status, programs and velocities',()=>{
 const result=importMidi(midi([[e(0,192,40),e(5,144,60,100),e(7,60,0),e(3,144,64,127),e(11,128,64,0),end()]]));
 assert.deepEqual(result.project.notes.map(n=>[n.start,n.length,n.pitch,n.volume]),[[5,7,60,12],[15,11,64,15]]);
 assert.equal(result.project.instruments[0].midiProgram,40);
 assert.deepEqual(parse(JSON.stringify(result.project)),result.project);
 const roundtrip=importMidi(new Uint8Array(compilePlayback(result.project).binary));
 assert.deepEqual(roundtrip.project.notes.map(n=>[n.start,n.length]),[[5,7],[15,11]]);
 assert.ok(!result.warnings.some(w=>w.includes('Timing was rounded')));
});
test('MIDI only rounds to model units, never to the L4 grid',()=>{
 const {project,warnings}=importMidi(midi([[e(1,144,60,1),e(29,128,60,0),e(1,144,62,1),e(1,128,62,0),end()]],96));
 assert.deepEqual(project.notes.map(n=>[n.start,n.length,n.volume]),[[0,10,1],[10,1,1]]);
 assert.ok(warnings.some(w=>w.includes('nearest 1/128')));
});
test('format 1 ports, tracks and changes of program create distinct instruments',()=>{
 const {project}=importMidi(midi([
  [e(0,255,3,4,76,101,97,100),e(0,192,40),e(0,144,60,100),e(7,128,60,0),e(0,192,73),e(0,144,62,100),e(9,128,62,0),end()],
  [e(0,255,33,1,1),e(0,192,24),e(0,144,60,100),e(11,128,60,0),end()]
 ]));
 assert.deepEqual(new Set(project.instruments.map(i=>i.midiProgram)),new Set([40,73,24]));
 assert.ok(project.instruments.some(i=>i.name.startsWith('Lead')));
 assert.equal(project.notes.length,3);assert.doesNotThrow(()=>parse(JSON.stringify(project)));
});
test('sustain and same-pitch overlap are retained without trimming notes',()=>{
 const {project,warnings}=importMidi(midi([[e(0,176,64,127),e(0,144,60,100),e(5,128,60,0),e(1,144,60,100),e(4,128,60,0),e(3,176,64,0),end()]]));
 assert.deepEqual(project.notes.map(n=>[n.start,n.length]),[[0,13],[6,7]]);
 assert.equal(project.instruments.length,1);assert.equal(warnings.some(w=>w.includes('Overlapping')),false);
 assert.doesNotThrow(()=>parse(JSON.stringify(project)));
});
test('tempo changes in a rest and inside a held note use silent markers, without retriggering',()=>{
 const {project}=importMidi(midi([[e(0,255,81,3,15,66,64),e(5,144,60,100),e(5,255,81,3,7,161,32),e(27,128,60,0),end()]]));
 const audible=project.notes.filter(n=>n.volume>0);assert.deepEqual(audible.map(n=>[n.start,n.length]),[[5,32]]);
 assert.equal(tempoAt(project.notes,0),60);assert.equal(tempoAt(project.notes,10),120);
 assert.equal(project.notes.filter(n=>n.volume===0).length,2);
 assert.doesNotThrow(()=>parse(JSON.stringify(project)));
});
test('coincident tempo and unsupported controls are reported without export-limit warnings',()=>{
 const {project,warnings}=importMidi(midi([[e(0,255,81,3,0,0,1),e(0,255,81,3,15,66,64),e(0,176,7,50),e(0,224,0,64),e(0,240,1,247),e(0,153,36,90),e(10,137,36,0),end()]]));
 assert.equal(tempoAt(project.notes,0),60);
 for(const text of ['Coincident','Controllers','Pitch bend','System-exclusive','Not a valid MS2 instrument'])assert.ok(warnings.some(w=>w.includes(text)),text);
 assert.ok(!warnings.some(w=>w.includes('clamp')));
});
test('MIDI channel 10 imports as a playable standard drum kit with an MS2 warning',()=>{
 const {project,warnings}=importMidi(midi([[e(0,201,8),e(0,153,36,100),e(8,137,36,0),end()]]));
 assert.equal(project.instruments[0].isDrum,true);assert.equal(project.instruments[0].midiProgram,0);
 assert.ok(warnings.some(w=>w.includes('Not a valid MS2 instrument')));
 assert.ok(warnings.some(w=>w.includes('Alternate MIDI drum kits')));
 assert.deepEqual(parse(JSON.stringify(project)),project);
 const again=importMidi(new Uint8Array(compilePlayback(project).binary));assert.equal(again.project.instruments[0].isDrum,true);
});
test('dangling notes end at file end and velocity-zero note-ons act as note-offs',()=>{
 const {project,warnings}=importMidi(midi([[e(0,144,60,100),e(3,144,62,100),e(5,144,62,0),end(9)]]));
 assert.deepEqual(project.notes.map(n=>[n.pitch,n.length]),[[60,17],[62,5]]);
 assert.ok(warnings.some(w=>w.includes('Unreleased')));
});
test('invalid, truncated, empty, format 2 and SMPTE inputs fail clearly',()=>{
 const good=midi([[e(0,144,60,100),e(7,128,60,0),end()]]);
 for(let i=0;i<good.length-3;i++)assert.throws(()=>importMidi(good.subarray(0,i)),`truncation ${i}`);
 assert.throws(()=>importMidi(midi([[end()]])),/no supported notes/);
 assert.throws(()=>importMidi(midi([[end()]],32,2)),/formats 0 and 1/);
 assert.throws(()=>importMidi(midi([[end()]],0xe728)),/SMPTE/);
 assert.throws(()=>readSMF(midi([[e(0,60,100),end()]])),/running status/);
 assert.throws(()=>readSMF(midi([[[128,128,128,128,0],end()]])),/variable-length/);
 assert.ok(readSMF(midi([[e(0,144,255,100),end()]])).warnings.some(w=>/invalid MIDI note-on/.test(w)));
});

