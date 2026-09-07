import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fresh} from '../dist/model/project.js';
import {parse} from '../dist/model/serialization.js';
import {valid} from '../dist/model/validation.js';
import {move} from '../dist/music/note-operations.js';
import {tempoMap,secondsAtTick,tickAtSeconds,tempoAt} from '../dist/music/tempo.js';
import {compilePlayback,heldPlaybackNotes} from '../dist/playback/midi.js';
import {GM_PROGRAMS} from '../dist/playback/gm-programs.js';
import {BasicMIDI,SoundBankLoader,SpessaSynthProcessor} from 'spessasynth_core';
import {StbVorbis} from 'stb-vorbis';
import {readSMF} from '../dist/import/smf.js';
import {drumName} from '../dist/playback/drums.js';
test('compressed SF3 decoding is explicitly disabled without loading a decoder',async()=>{
 await StbVorbis.ready;
 assert.throws(()=>StbVorbis.decode(new Uint8Array([79,103,103,83])),/SF3\/Vorbis sound banks are disabled/);
 const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
 assert.ok(!Object.values(lock.packages).some(p=>/registry.*stb-vorbis/.test(p.resolved??'')));
});
const note=(id,start,length,pitch=60,tempo=null)=>({id,start,length,pitch,tempo,instrument:0,volume:null});
test('seek restoration retains original onset volume, mapped drums and exact note boundaries',()=>{
 const p=fresh();p.instruments.push({name:'Snare',color:'#ff9900',ms2Drum:'snare'},{name:'Instructions',color:'#f4d35e',isInstructions:true});
 p.notes=[{...note(1,0,128),volume:5},{...note(2,0,8,62),volume:9},{...note(3,8,2,64),volume:0},note(4,32,32,65),{...note(5,0,128),instrument:1,volume:12},{...note(6,0,128),instrument:2,volume:15}];
 const channels=compilePlayback(p).channels;
 assert.deepEqual(heldPlaybackNotes(p,channels,32),[{channel:0,pitch:60,velocity:76},{channel:9,pitch:38,velocity:102}]);
 assert.deepEqual(heldPlaybackNotes(p,channels,128),[]);assert.deepEqual(heldPlaybackNotes(p,channels,0),[]);
});
test('tempo boundaries, conflicts, default and exact held-note timing',()=>{
 const p=fresh();p.notes=[note(1,0,128),note(2,32,32,64,60)];
 const map=tempoMap(p.notes);assert.equal(tempoAt(p.notes,0),120);assert.equal(secondsAtTick(map,128),3.5);assert.equal(tickAtSeconds(map,3.5),128);
 for(const t of [20,32,255,300,null])assert.ok(valid([{...p.notes[0],tempo:t}]));
 for(const t of [0,-1,32.5,Infinity,NaN,'120'])assert.ok(!valid([{...p.notes[0],tempo:t}]));
 assert.throws(()=>parse(JSON.stringify({...p,notes:[{...p.notes[0],tempo:120.5}]})),/Invalid timing/);
 assert.ok(!valid([note(1,0,32,60,100),note(2,0,32,64,90)]));
 assert.ok(valid([note(1,0,32,60,100),note(2,0,32,64,100)]));
 const moved=move(p.notes,new Set([2]),2,32,0,4);assert.equal(tempoAt(moved,32),120);assert.equal(tempoAt(moved,64),60);
 assert.equal(tempoAt(p.notes.filter(n=>n.id!==2),100),120);
});
test('SMF preserves rests, program changes, V zero, tempo and note-off timing',()=>{
 const p=fresh();p.instruments[0].midiProgram=127;p.notes=[note(1,32,96),note(2,64,32,64,60),{...note(3,128,32,65),volume:0}];
 const plan=compilePlayback(p),midi=BasicMIDI.fromArrayBuffer(plan.binary);
 assert.equal(midi.timeDivision,32);assert.equal(plan.duration,4);assert.equal(plan.skipped,0);
 const bytes=[...new Uint8Array(plan.binary)];assert.ok(bytes.some((v,i)=>v===192&&bytes[i+1]===127));
 assert.ok(bytes.some((v,i)=>v===144&&bytes[i+1]===60&&bytes[i+2]===68));
 assert.ok(!bytes.some((v,i)=>v===144&&bytes[i+1]===65));
});
test('old JSON defaults to GM piano, and new GM/T fields roundtrip',()=>{
 const p=fresh();delete p.instruments[0].midiProgram;p.notes=[note(1,0,32)];delete p.notes[0].tempo;
 assert.equal(parse(JSON.stringify(p)).instruments[0].midiProgram??0,0);
 p.instruments[0].midiProgram=40;p.notes[0].tempo=255;assert.deepEqual(parse(JSON.stringify(p)),p);
 p.instruments[0].midiProgram=128;assert.throws(()=>parse(JSON.stringify(p)));
});
test('GM programs stay melodic across MIDI ports; out-of-range pitches are reported',()=>{
 const p=fresh();p.instruments=Array.from({length:17},(_,i)=>({name:'I'+i,color:'#ff9900',midiProgram:i}));
 p.notes=p.instruments.map((_,i)=>({...note(i+1,0,32),instrument:i}));
 p.notes.push({...note(50,64,32,140),instrument:0});const result=compilePlayback(p);assert.equal(result.skipped,1);
 const midi=BasicMIDI.fromArrayBuffer(result.binary);assert.ok(midi.tracks.length>=18);
});
test('drum flags round-trip and multiple drum lanes use isolated channel-10 ports',()=>{
 const p=fresh();p.instruments=[{name:'Kit A',color:'#ff9900',isDrum:true},{name:'Piano',color:'#ff9900',midiProgram:0},{name:'Kit B',color:'#ff9900',isDrum:true}];
 p.notes=p.instruments.map((_,i)=>({...note(i+1,0,32,36),instrument:i}));
 assert.deepEqual(parse(JSON.stringify(p)),p);
 const decoded=readSMF(new Uint8Array(compilePlayback(p).binary));
 assert.deepEqual(decoded.events.filter(e=>(e.status>>4)===9).map(e=>[e.port,e.status&15]),[[0,9],[0,0],[1,9]]);
 p.instruments[0].isDrum='yes';assert.throws(()=>parse(JSON.stringify(p)),/drum kit flag/);
});
test('the bundled Standard Drum Kit synthesizes all 47 GM percussion keys',async()=>{
 const bytes=fs.readFileSync('assets/TimGM6mb.sf2');const bank=SoundBankLoader.fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 assert.ok(bank.presets.some(p=>p.isGMGSDrum&&p.program===0));
 const synth=new SpessaSynthProcessor(22050);await synth.processorInitialized;synth.soundBankManager.addSoundBank(bank,'gm');
 const left=new Float32Array(128),right=new Float32Array(128),silent=[];
 synth.programChange(9,0);
 for(let pitch=35;pitch<=81;pitch++){
  synth.stopAllChannels(true);synth.noteOn(9,pitch,100);let peak=0;
  for(let block=0;block<40;block++){left.fill(0);right.fill(0);synth.process(left,right);for(let i=0;i<128;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));}
  if(peak<1e-6)silent.push(pitch);
 }
 assert.deepEqual(silent,[]);assert.equal(drumName(36),'Bass Drum 1');assert.equal(drumName(81),'Open Triangle');
 synth.stopAllChannels(true);
});
test('bundled bank has all 128 GM presets and every preset renders non-silent PCM',async()=>{
 assert.equal(GM_PROGRAMS.length,128);assert.equal(new Set(GM_PROGRAMS).size,128);
 const bytes=fs.readFileSync('assets/TimGM6mb.sf2');const bank=SoundBankLoader.fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const melodic=bank.presets.filter(p=>!p.isGMGSDrum&&p.bankMSB===0&&p.bankLSB===0);
 assert.equal(new Set(melodic.map(p=>p.program)).size,128);
 const synth=new SpessaSynthProcessor(22050);await synth.processorInitialized;synth.soundBankManager.addSoundBank(bank,'gm');
 const left=new Float32Array(128),right=new Float32Array(128);const silent=[];
 for(let program=0;program<128;program++){
  synth.stopAllChannels(true);synth.programChange(0,program);synth.noteOn(0,60,100);let peak=0;
  for(let block=0;block<80;block++){left.fill(0);right.fill(0);synth.process(left,right);for(let i=0;i<128;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));}
  if(peak<1e-6)silent.push(program+1);
 }
 assert.deepEqual(silent,[]);synth.stopAllChannels(true);
});
test('C#8 preview fallback transposes C8 instead of using the silent high bank zone',async()=>{
 const bytes=fs.readFileSync('assets/TimGM6mb.sf2');const bank=SoundBankLoader.fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const synth=new SpessaSynthProcessor(22050);await synth.processorInitialized;synth.soundBankManager.addSoundBank(bank,'gm');synth.programChange(0,0);synth.midiChannels[0].setMIDIParameter('pitchWheelRange',2);synth.pitchWheel(0,12288);synth.noteOn(0,108,100);
 const left=new Float32Array(128),right=new Float32Array(128);let peak=0;for(let block=0;block<80;block++){left.fill(0);right.fill(0);synth.process(left,right);for(let i=0;i<128;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));}
 assert.ok(peak>0.001,`C#8 fallback was silent: ${peak}`);synth.stopAllChannels(true);
});
