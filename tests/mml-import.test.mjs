import test from 'node:test';
import assert from 'node:assert/strict';
import {importMml} from '../dist/import/mml.js';
import {generateMml} from '../dist/music/mml.js';
import {parse} from '../dist/model/serialization.js';
test('MML notes, accidentals, defaults, numbered notes, ties and global tempo',()=>{
 const r=importMml('MML@o4v12l8c+t300&c+r8n61, t300o3g1;');
 assert.deepEqual(r.project.notes.filter(n=>n.instrument===0).map(n=>[n.start,n.length,n.pitch]),[[0,32,61],[48,16,61],[0,128,55]]);
 assert.equal(r.project.instruments[1].isInstructions,true);
 assert.equal(r.project.notes.at(-1).tempo,300);
 assert.deepEqual(parse(JSON.stringify(r.project)),r.project);
});
test('arbitrary denominators and fractional timing report conversion',()=>{
 assert.equal(importMml('c25.').project.notes[0].length,8); assert.throws(()=>importMml('c25.6')); 
});
test('MML containers preserve channels and names',()=>{
 const xml=importMml('<?xml version="1.0"?><ms2><melody><![CDATA[o4c4t170&c4]]></melody><chord index="1">o3g1</chord></ms2>');
 assert.equal(xml.noteCount,2);assert.equal(xml.project.notes[0].length,64);
 const mne=importMml('// FORMAT: MNE\n// PART 1 NAME: Lead\n// PART 1 INSTRUMENT: 5\nMML@c4,e4,;\n// PART 2 NAME: Bass\n// PART 2 INSTRUMENT: 28\nMML@o2g1;');
 assert.equal(mne.noteCount,3);assert.equal(mne.project.instruments[1].midiProgram,28);
 const three=importMml('[Settings]\nTrackName1 = Flute\n[Channel1]\nt170c4\n[Channel2]\no3g1\n[3MLE EXTENSION]\nData=ignored');
 assert.equal(three.noteCount,2);assert.equal(three.project.instruments[0].name,'Flute');
});
test('malformed MML fails atomically, tempo-only input supported',()=>{
 for(const s of ['hello world','c0','t0c','t120.5c','v16c','c&d','c&','MML@c','c4@7d','<ms2><melody>c</chord></ms2>'])assert.throws(()=>importMml(s),s);
 assert.equal(importMml('r4t20').project.instruments.at(-1).isInstructions,true);
 assert.throws(()=>importMml('t120c,t170e'),/Conflicting/);
});
test('generated MML round-trips non-grid lengths and held tempo boundaries',()=>{
 const project=importMml('t120o4c4t170&c4r8d8').project;
 const result=importMml(generateMml(project,0).channels.join(','));
 assert.deepEqual(result.project.notes.map(n=>[n.start,n.length,n.pitch,n.tempo]),project.notes.map(n=>[n.start,n.length,n.pitch,n.tempo]));
 const odd=importMml('c24d24e24');assert.deepEqual(odd.project.notes.map(n=>n.start),[0,5,11]);assert.ok(odd.warnings.some(w=>w.includes('rounded')));
 assert.equal(importMml('l64.c').project.notes[0].length,3);
});


test('large MML and unlimited channel counts are retained',()=>{
 assert.equal(importMml('c128'.repeat(20001)).noteCount,20001);
 assert.equal(importMml('MML@'+Array(20).fill('c4').join(',')+';').noteCount,20);
 assert.equal(importMml('o-1c4').project.notes[0].pitch,0);
});

test('real MS2 sheets: chord attributes, repeated ties, pedal switches, measure labels and a bare L',()=>{
 // MS2 exports label channels chord="N"; only index="N" used to be recognised, so every sheet failed.
 const xml='<?xml version="1.0" encoding="utf-8"?><ms2><melody><![CDATA[l8cde]]></melody><chord chord="1"><![CDATA[l8gab]]></chord><chord chord="2"><![CDATA[]]></chord></ms2>';
 const sheet=importMml(xml,'Sheet');
 assert.deepEqual(sheet.project.notes.map(n=>[n.start,n.length,n.pitch]),[[0,16,60],[16,16,62],[32,16,64],[0,16,67],[16,16,69],[32,16,71]]);
 assert.equal(sheet.project.instruments.length,1);
 // Annotations a converter leaves behind: none of them may move a note.
 const plain=importMml('l8cdefg'),annotated=importMml('l8cdeM29s1lfgs0');
 assert.deepEqual(annotated.project.notes.map(n=>[n.start,n.length,n.pitch]),plain.project.notes.map(n=>[n.start,n.length,n.pitch]));
 assert.ok(annotated.warnings.some(w=>/Measure labels/.test(w)));
 assert.ok(annotated.warnings.some(w=>/'s' commands/.test(w)));
 assert.ok(annotated.warnings.some(w=>/L with no length/.test(w)));
 // A doubled tie is redundant, not broken: one note comes out, not an error.
 const doubled=importMml('l8c&&c');
 assert.deepEqual(doubled.project.notes.map(n=>[n.start,n.length,n.pitch]),[[0,32,60]]);
 assert.ok(doubled.warnings.some(w=>/Repeated tie/.test(w)));
 // A tie still has to continue the same pitch, and unknown letters still fail atomically.
 assert.throws(()=>importMml('c&d'));
 assert.throws(()=>importMml('cqe'));
});

test('MS2 +/- accidentals work on every letter and boundary notes use O0 C- / O8 B+',()=>{
 const natural={c:0,d:2,e:4,f:5,g:7,a:9,b:11};
 for(let octave=0;octave<=8;octave++)for(const [letter,offset] of Object.entries(natural))for(const accidental of ['','+','-']){
  const p=importMml(`o${octave}${letter}${accidental}4`).project,pitch=(octave+1)*12+offset+(accidental==='+'?1:accidental==='-'?-1:0);
  assert.equal(p.notes[0].pitch,pitch);const generated=generateMml(p,0);assert.ok(!generated.warnings.some(w=>w.startsWith('Pitch outside')));assert.ok(!/o(?:-|9)|#/.test(generated.channels.join('')));assert.equal(importMml(generated.channels[0]).project.notes[0].pitch,pitch);
 }
 assert.equal(importMml('o4d-').project.notes[0].pitch,importMml('o4c+').project.notes[0].pitch);
 for(const pitch of [11,120]){const p=importMml(pitch===11?'o0c-1':'o8b+1').project;p.notes[0].length=300;const result=generateMml(p,0);assert.match(result.channels[0],pitch===11?/o0.*c-/:/o8.*b\+/);const back=importMml(result.channels[0]);assert.equal(back.project.notes[0].pitch,pitch);assert.equal(back.project.notes[0].length,300);}
 const alias=importMml('o4c#4').project;assert.equal(alias.notes[0].pitch,61);const normalized=generateMml(alias,0).channels[0];assert.ok(!normalized.includes('#'));assert.match(normalized,/c\+/);
 // Import remains permissive about out-of-target numeric pitches; export warns.
 const outside=importMml('o9c+').project;assert.equal(outside.notes[0].pitch,121);assert.match(generateMml(outside,0).warnings.join(' '),/Pitch outside/);
});
