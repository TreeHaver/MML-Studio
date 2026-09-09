import {test} from 'node:test';
import assert from 'node:assert/strict';
import fixture from './midi-fixtures.cjs';
import {importMidi} from '../dist/import/midi.js';
import {readSMF} from '../dist/import/smf.js';
import {parse} from '../dist/model/serialization.js';
import {compilePlayback} from '../dist/playback/midi.js';
import {tempoAt} from '../dist/music/tempo.js';
import {tempoMap,secondsAtTick} from '../dist/music/tempo.js';
import {applyImportSpeedMultipliers,hasOutOfRangeTempo,withoutImportedTempos} from '../dist/import/tempo.js';
import {importMml} from '../dist/import/mml.js';
import {appendImportedSongs} from '../dist/import/append.js';
import {importSong} from '../dist/import/source.js';
const {midi,event:e,end}=fixture;

test('dropped songs append independent lanes and unique IDs atomically, preserving existing music',()=>{
 const target=importMml('t120v5c4').project,before=structuredClone(target);
 const a=importMml('t120v13e4').project,b=importMml('r4t150g4').project;
 const result=appendImportedSongs(target,[a,b]);
 assert.deepEqual(target,before);assert.deepEqual(result.project.notes.slice(0,target.notes.length),target.notes);
 assert.equal(result.instruments.length,2);assert.notEqual(result.instruments[0],result.instruments[1]);
 assert.equal(new Set(result.project.notes.map(n=>n.id)).size,result.project.notes.length);
 assert.deepEqual(parse(JSON.stringify(result.project)),result.project);
 const replaced=appendImportedSongs(target,[importMml('t150c4').project]);assert.equal(tempoAt(replaced.project.notes,0),150);assert.ok(replaced.warnings.some(w=>/replaced/.test(w)));assert.deepEqual(target,before);
 assert.deepEqual(parse(JSON.stringify(replaced.project)),replaced.project);
 const speed=applyImportSpeedMultipliers(importMml('t600c4').project);
 assert.throws(()=>appendImportedSongs(speed,[speed]),/global clocks/);
});

test('file tempo choice can strip T or resolve channel/file conflicts without changing music',()=>{
 const file=importSong(new TextEncoder().encode('t120c4,t150e4'),'conflict.mml');assert.equal(tempoAt(file.project.notes,0),150);assert.ok(file.warnings.some(w=>/last encountered/.test(w)));
 const stripped=withoutImportedTempos(file.project);assert.ok(stripped.notes.every(n=>n.tempo===undefined));assert.equal(stripped.notes.length,2);assert.equal(tempoAt(stripped.notes,0),120);
 const target=importMml('t90g4').project;
 assert.equal(tempoAt(appendImportedSongs(target,[stripped]).project.notes,0),90);
 assert.equal(tempoAt(appendImportedSongs(target,[file.project,importMml('t180a4').project]).project.notes,0),180);
 const carrier=importMml('c4r4t170').project;assert.equal(withoutImportedTempos(carrier).notes.length,1);
 carrier.notes.find(n=>n.tempo===170).timeSignature='3/4';const kept=withoutImportedTempos(carrier);assert.equal(kept.notes.length,2);assert.equal(kept.notes.find(n=>n.timeSignature).timeSignature,'3/4');assert.deepEqual(parse(JSON.stringify(kept)),kept);
});

test('opt-in import speed conversion preserves the clock, held notes and version 2 across tempo changes',()=>{
 const original=importMml('t31c1&t512c1t512r4t32c4t255c4t8c4t600c4').project;
 const snapshot=structuredClone(original),converted=applyImportSpeedMultipliers(original);
 assert.equal(hasOutOfRangeTempo(original),true);assert.equal(hasOutOfRangeTempo(converted),false);
 assert.deepEqual(original,snapshot);
 assert.deepEqual(tempoMap(converted.notes),tempoMap(original.notes));
 for(const tick of [0,32,128,200,256,300,400])assert.equal(secondsAtTick(tempoMap(converted.notes),tick),secondsAtTick(tempoMap(original.notes),tick));
 assert.deepEqual(converted.notes.slice(0,original.notes.length).map(({tempo,...note})=>note),original.notes.map(({tempo,...note})=>note));
 const markers=converted.notes.filter(n=>n.speedEntry||n.speedExit);
 assert.equal(markers.length,5);assert.ok(markers.every(n=>n.length===1&&n.volume===0&&converted.instruments[n.instrument].isInstructions));
 assert.equal(new Set(converted.notes.map(n=>n.id)).size,converted.notes.length);
 assert.deepEqual(parse(JSON.stringify(converted)),converted);
 const ordinary=importMml('t32c4t255c4').project;
 assert.equal(hasOutOfRangeTempo(ordinary),false);assert.equal(applyImportSpeedMultipliers(ordinary),ordinary);
 const delayed=importMml('c4t300r4c4t120c4').project;
 assert.deepEqual(tempoMap(applyImportSpeedMultipliers(delayed).notes),tempoMap(delayed.notes));
 const midiProject=importMidi(midi([[e(0,255,81,3,1,134,160),e(0,144,60,100),e(32,128,60,0),end()]])).project;
 assert.equal(tempoAt(midiProject.notes,0),600);
 assert.equal(tempoAt(applyImportSpeedMultipliers(midiProject).notes,0),600);
 for(const [bpm,base,multiplier,effective] of [[578,145,4,580],[600,150,4,600],[512,128,4,512],[300,150,2,300],[513,128,4,512],[31,62,0.5,31],[16,32,0.5,16],[15,60,0.25,15],[8,32,0.25,8],[257,129,2,258],[510,255,2,510],[511,255,2,510],[1022,255,4,1020]]){
  const notices=[],result=applyImportSpeedMultipliers(importMml(`t${bpm}c4`).project,notices);
  assert.equal(result.notes.find(n=>n.tempo).tempo,base);assert.equal(result.notes.find(n=>n.speedEntry).speedMultiplier,multiplier);
  assert.equal(tempoAt(result.notes,0),effective);assert.equal(notices.length,bpm===effective?0:1);
  if(notices.length){assert.ok(notices[0].includes(`${bpm} BPM was approximated as ${effective} BPM`));assert.ok(Math.abs(effective-bpm)<=2);}
 }
 for(const bpm of [1,7,1023,2048]){const p=importMml(`t${bpm}c4`).project,notices=[];assert.equal(applyImportSpeedMultipliers(p,notices),p);assert.equal(notices.length,1);assert.match(notices[0],/left unchanged/);assert.ok(!p.notes.some(n=>n.speedEntry));}
 const mixed=applyImportSpeedMultipliers(importMml('t578c4t2048c4t31c4').project);
 assert.equal(tempoAt(mixed.notes,0),580);assert.equal(tempoAt(mixed.notes,32),2048);assert.equal(tempoAt(mixed.notes,64),31);
 assert.ok(mixed.notes.filter(n=>n.speedEntry).every(n=>[2,4,0.5,0.25].includes(n.speedMultiplier)));
});

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
