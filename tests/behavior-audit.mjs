// Standalone diagnostic, not a regression suite that endorses current bugs.
// Run after node build.cjs. Differences are written as findings for review.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {fresh} from '../dist/model/project.js';
import {parse} from '../dist/model/serialization.js';
import {generateMml} from '../dist/music/mml.js';
import {volumeAt} from '../dist/music/volume.js';
import {projectSegment,mergeSegment} from '../dist/model/segment-view.js';
import {compilePlayback,heldPlaybackNotes} from '../dist/playback/midi.js';
import {readSMF} from '../dist/import/smf.js';
import {importMidi} from '../dist/import/midi.js';
import {importMml} from '../dist/import/mml.js';
import {sliceProject} from '../dist/music/structure.js';
import {expandLoops} from '../dist/music/loops.js';
import {SoundBankLoader,SpessaSynthProcessor} from 'spessasynth_core';

const output='.validation/behavior-audit';fs.mkdirSync(output,{recursive:true});
const checks=[];
const compare=(id,expected,actual)=>checks.push({id,matches:isDeepStrictEqual(expected,actual),expected,actual});
const note=(id,start,length,pitch=60,volume=null,instrument=0)=>({id,start,length,pitch,volume,instrument});
const project=notes=>({...fresh(),notes});
const noteOns=p=>readSMF(new Uint8Array(compilePlayback(p).binary)).events.filter(e=>(e.status>>4)===9).map(e=>({tick:e.tick,pitch:e.data[0],velocity:e.data[1],port:e.port,channel:e.status&15}));
const velocities=p=>noteOns(p).map(e=>e.velocity);
const overlap=p=>generateMml(p,0).warnings.some(w=>w.startsWith('Overlapping notes:'));
const addMarkers=p=>{
 p.instruments.push({name:'Instructions',color:'#f4d35e',isInstructions:true});
 p.notes.push({...note(101,32,1,60,0,1),section:'Audit segment'}, {...note(102,96,1,60,0,1),section:'After segment'});
 return p;
};
const fixture=(name,p)=>fs.writeFileSync(`${output}/${name}.json`,JSON.stringify(p,null,2));

// Controls: instruction ordering, instrument-instance isolation, V0 and restoration.
const sequence=project([note(1,0,16,60,13),note(2,16,16,62,5),note(3,32,16,64),note(4,48,16,65,0),note(5,64,16,67,13)]);
compare('control-sequential-V-before-note-on',[110,42,42,110],velocities(sequence));
compare('control-sequential-MML-volumes',[13,5,5,0,13],importMml('MML@'+generateMml(sequence,0).channels.join(',')+';').project.notes.map(n=>n.volume));
compare('control-held-note-keeps-onset-V',[110,42],heldPlaybackNotes(project([note(1,0,128,60,13),note(2,16,128,64,5)]),[{instrument:0,channel:0,noteIds:[1,2]}],32).map(n=>n.velocity));
const instances=project([note(1,0,32,60,13),note(2,0,32,60,5,1)]);instances.instruments.push({...instances.instruments[0]});
compare('control-same-preset-different-instances',false,overlap(instances));
compare('control-instance-volumes',[110,42],velocities(instances));
compare('control-same-instrument-same-onset-same-pitch',true,overlap(project([note(1,0,32),note(2,0,16)])));
compare('control-same-instrument-different-pitches',false,overlap(project([note(1,0,32),note(2,0,16,64)])));
compare('control-sustained-notes-different-onsets',false,overlap(project([note(1,0,128),note(2,16,32)])));

const chord=project([note(1,0,32,60,13),note(2,0,32,64,5)]);fixture('explicit-volumes',chord);
compare('A1-explicit-chord-volumes',[110,42],velocities(chord));
compare('A1-inspector-effective-V',[13,5],chord.notes.map(n=>volumeAt(chord,n)));
compare('A1-generated-MML-explicit-V',[13,5],importMml('MML@'+generateMml(chord,0).channels.join(',')+';').project.notes.map(n=>n.volume));
// Build two valid simultaneous MIDI notes independently, so the compiler's own
// volume collision cannot contaminate the input used to check MIDI import.
const imported=importMidi(new Uint8Array(compilePlayback(instances).binary));
compare('control-MIDI-instance-separation',[13,5],imported.project.notes.map(n=>n.volume));
const chordBytes=new Uint8Array([77,84,104,100,0,0,0,6,0,0,0,1,0,32,77,84,114,107,0,0,0,20,0,144,60,110,0,144,64,42,32,128,60,0,0,128,64,0,0,255,47,0]);
const importedChord=importMidi(chordBytes);
compare('control-MIDI-keeps-explicit-chord-V',[13,5],importedChord.project.notes.map(n=>n.volume));
compare('A1-imported-MIDI-chord-plays-explicit-V',[110,42],velocities(importedChord.project));
const midi=readSMF(new Uint8Array(compilePlayback(sequence).binary));
compare('control-MIDI-note-on-order',[0,16,32,64],midi.events.filter(e=>(e.status>>4)===9).map(e=>e.tick));

const crossing=addMarkers(project([note(1,0,128,60,13),note(2,16,128,60,5)]));fixture('crossing-notes',crossing);
const range={kind:'segment',name:'Audit segment',start:32,end:96};
const projection=projectSegment(crossing,range),scoped=projection.project;
compare('control-A2-scope-warns-for-clipped-overlap',true,overlap(scoped));
compare('A1-scoped-crossing-note-volumes',[110,42],velocities(scoped));
compare('A1-section-export-crossing-note-volumes',[110,42],velocities(sliceProject(crossing,32,96)));
compare('control-unedited-scope-save',crossing,mergeSegment(crossing,projection,scoped,scoped.instruments.map((_,i)=>i)));
compare('control-version-2-roundtrip',crossing,parse(JSON.stringify(crossing)));

const inherited=addMarkers(project([note(1,0,128,60,13),note(2,16,16,64,5),note(3,64,16,67)]));fixture('scope-inheritance',inherited);
compare('A3-scope-preserves-later-inherited-V',42,noteOns(projectSegment(inherited,range).project).find(n=>n.pitch===67).velocity);
const loop=structuredClone(crossing);loop.notes=loop.notes.filter(n=>n.instrument===0);
loop.notes.push({...note(101,32,1,60,0,1),loopEntry:true,loopCount:2},{...note(102,64,1,60,0,1),loopExit:true});fixture('untied-loop-volumes',loop);
const expanded=expandLoops(loop).project;
compare('A1-loop-repeat-restores-both-onset-volumes',[110,42],noteOns(expanded).filter(n=>n.tick===64).map(n=>n.velocity));
compare('control-A2-loop-warns-for-restarted-overlap',true,overlap(loop));

// Drive actual bundled synthesis with the nested-note compiler's emitted events.
const bytes=fs.readFileSync('assets/TimGM6mb.sf2');
const bank=SoundBankLoader.fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const makeSynth=async()=>{const s=new SpessaSynthProcessor(22050);await s.processorInitialized;s.soundBankManager.addSoundBank(bank,'gm');s.programChange(0,0);return s;};
const left=new Float32Array(128),right=new Float32Array(128);
const render=(s,blocks)=>{for(let i=0;i<blocks;i++){left.fill(0);right.fill(0);s.process(left,right);}};
const nested=project([note(1,0,128,60,13),note(2,16,16,60,5)]);fixture('nested-same-pitch',nested);
const events=readSMF(new Uint8Array(compilePlayback(nested).binary)).events.filter(e=>[8,9].includes(e.status>>4));
const synth=await makeSynth();let tick=0,longVoices=[];
for(const e of events){if(e.tick>32)break;render(synth,Math.round((e.tick-tick)/64*22050/128));tick=e.tick;if((e.status>>4)===9)synth.noteOn(e.status&15,...e.data);else synth.noteOff(e.status&15,e.data[0]);if(e.tick===0){render(synth,2);longVoices=synth.synthCore.voices.filter(v=>v.isActive&&!v.isInRelease&&v.releaseStartTime===Infinity).slice();}} 
render(synth,2);
const heldIDs=[...new Set(synth.synthCore.voices.filter(v=>v.isActive&&!v.isInRelease&&v.releaseStartTime===Infinity&&v.midiNote===60).map(v=>longVoices.includes(v)?'original long note':'later short note'))];
compare('A4-short-note-off-retains-older-long-voice',['original long note'],heldIDs);synth.stopAllChannels(true);

const peaks={};
for(const pitch of [108,109]){const s=await makeSynth();s.noteOn(0,pitch,100);let peak=0;for(let i=0;i<80;i++){render(s,1);for(const v of left)peak=Math.max(peak,Math.abs(v));}peaks[pitch]=peak;s.stopAllChannels(true);}
assert.ok(peaks[108]>0.001,'Audible C8 control');
const highSynth=await makeSynth();
for(const e of readSMF(new Uint8Array(compilePlayback(project([note(1,0,128,109,13)])).binary)).events){if(e.tick!==0)continue;const ch=e.status&15,type=e.status>>4;if(type===11)highSynth.controllerChange(ch,...e.data);else if(type===12)highSynth.programChange(ch,e.data[0]);else if(type===14)highSynth.pitchWheel(ch,e.data[0]+(e.data[1]<<7));else if(type===9)highSynth.noteOn(ch,...e.data);}
let compiledPeak=0;for(let i=0;i<80;i++){render(highSynth,1);for(const v of left)compiledPeak=Math.max(compiledPeak,Math.abs(v));}highSynth.stopAllChannels(true);peaks.compiled109=compiledPeak;
compare('A5-piano-C-sharp-8-song-sounds',true,compiledPeak>0.000001);
fixture('high-piano-note',project([note(1,0,128,109,13)]));

assert.ok(checks.filter(c=>c.id.startsWith('control-')).every(c=>c.matches),'Control checks must pass');
const report={date:'2026-09-07',mode:'diagnostic; mismatches are findings, not approved behavior',checks,peaks};
fs.writeFileSync(`${output}/results.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({controls:checks.filter(c=>c.id.startsWith('control-')).length,findings:checks.filter(c=>!c.matches).map(c=>({id:c.id,expected:c.expected,actual:c.actual})),peaks},null,2));
