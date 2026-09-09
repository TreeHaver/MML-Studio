import test from 'node:test';
import assert from 'node:assert/strict';
import {importAbc} from '../dist/import/abc.js';
import {importSong} from '../dist/import/source.js';
import {parse} from '../dist/model/serialization.js';
import {appendImportedSongs} from '../dist/import/append.js';
import {applyImportSpeedMultipliers} from '../dist/import/tempo.js';

const score=(body,header='L:1/4\nK:C')=>`X:1\nT:Test\n${header}\n${body}`;
const notes=r=>r.project.notes.filter(n=>!r.project.instruments[n.instrument].isInstructions);
const music=r=>notes(r).map(n=>[n.start,n.length,n.pitch]);
test('game ABC chords advance by their shortest member while preserving every lifetime and leading rest',()=>{
 const r=importAbc(score('z2 [C2E/2Gz/4] D/4 [C/2E2] F','Z:Transcribed using LotRO MIDI Player\nL:1/4\nQ:120\nK:C'));
 assert.deepEqual(music(r),[[64,64,60],[64,16,64],[64,32,67],[72,8,62],[80,16,60],[80,64,64],[96,32,65]]);
 assert.equal(r.noteCount,7);assert.ok(r.warnings.some(w=>/shortest/.test(w)));
 assert.deepEqual(parse(JSON.stringify(r.project)),r.project);
});
test('standard ABC chord advance, octave-specific accidentals, naturals and bar resets',()=>{
 assert.deepEqual(music(importAbc(score('[C2E/2] D'))),[[0,64,60],[0,16,64],[64,32,62]]);
 assert.deepEqual(music(importAbc(score('^F F f =F F | F _B, ^^c\' __D'))).map(n=>n[2]),[66,66,77,65,65,65,58,86,60]);
 assert.deepEqual(music(importAbc(score('F =F F | F','K:G'))).map(n=>n[2]),[66,65,65,66]);
 assert.deepEqual(music(importAbc(score('B F','K:Dmin'))).map(n=>n[2]),[70,65]);
});
test('unlabelled game rest chords select shortest-member timing for the entire part',()=>{
 const r=importAbc(score('[C2E/4] [G/2z/8] A','Z:Composer name\nL:1/4\nK:C'));
 assert.deepEqual(music(r),[[0,64,60],[0,8,64],[8,16,67],[12,32,69]]);
 assert.ok(r.warnings.some(w=>/shortest/.test(w)));
 const ordinary=importAbc(score('[C2E/4] D % [Cz]\n"[Ez]" E','T:[Cz]\nL:1/4\nK:C'));
 assert.deepEqual(music(ordinary).map(n=>n[0]),[0,0,64,96]);
 assert.ok(!ordinary.warnings.some(w=>/shortest/.test(w)));
});
test('ABC headers and inline instructions retain tempo in rests and held notes without clamping',()=>{
 const r=importAbc(score('C-[Q:1/4=578]C z [M:3/4][L:1/8][K:G]F','M:6/8\nL:1/4\nQ:3/8=120\nK:C'));
 assert.deepEqual(music(r),[[0,64,60],[96,16,66]]);
 assert.deepEqual(r.project.notes.filter(n=>n.tempo).map(n=>[n.start,n.tempo]),[[0,180],[32,578]]);
 assert.deepEqual(r.project.notes.filter(n=>n.timeSignature).map(n=>[n.start,n.timeSignature]),[[0,'6/8'],[96,'3/4']]);
 assert.deepEqual(parse(JSON.stringify(r.project)),r.project);
 assert.equal(notes(importAbc(score('C','M:2/4\nK:C')))[0].length,8);
});
test('ABC rational lengths round cumulative boundaries, retain arbitrary integer durations and reject zero results',()=>{
 const r=importAbc(score('C/3D/3E/3 F// G3/8 A/','L:1/4\nK:C'));
 assert.deepEqual(music(r).map(n=>n.slice(0,2)),[[0,11],[11,10],[21,11],[32,8],[40,12],[52,16]]);
 assert.ok(r.warnings.some(w=>/rounded/.test(w)));
 assert.throws(()=>importAbc(score('C/1000')),/finer/);
 assert.throws(()=>importAbc(score('C0')),/length/);
 assert.throws(()=>importAbc(score('C/0')),/length/);
});
test('ABC dynamics, chord ties and annotation notices retain initial held volume',()=>{
 const r=importAbc(score('!p![CE]- !f![CE] +pp+G "Am"A'));
 assert.deepEqual(music(r),[[0,64,60],[0,64,64],[64,32,67],[96,32,69]]);
 assert.deepEqual(notes(r).map(n=>n.volume),[5,5,3,3]);
 assert.ok(r.warnings.some(w=>/initial onset/.test(w)));
});
test('sub-unit ABC rests may round away without losing notes or accumulating timing drift',()=>{
 const r=importAbc(score('C31/96 z/96 D31/96 z/96 E/3'));
 assert.deepEqual(music(r),[[0,10,60],[11,10,62],[21,11,64]]);
 const tiny=importAbc(score('C z/96 D'));
 assert.deepEqual(music(tiny),[[0,32,60],[32,32,62]]);
 assert.ok(tiny.warnings.some(w=>/rests rounded to zero/.test(w)));
 const chord=importAbc(score('[Cz/96] D'));
 assert.deepEqual(music(chord),[[0,32,60],[0,32,62]]);
 assert.throws(()=>importAbc(score('C/96 D')),/note duration.*finer/);
 assert.deepEqual(parse(JSON.stringify(r.project)),r.project);
});
test('ABC unsupported performance constructs and malformed files fail rather than partially importing',()=>{
 for(const body of ['C |:D:|','C (3DEF','C {D}E','C>D','C- D','C-','[CE','[]','C !trill!D','C\nV:2\nD','C\nX:2\nK:C\nD','C\n%%MIDI program 40','C\nK:C transpose=12','C & D'])assert.throws(()=>importAbc(score(body)),body);
 assert.throws(()=>importAbc('not ABC'),/K:/);
 assert.throws(()=>importAbc(score('z4')),/No ABC notes/);
});
test('ABC filename dispatch and additive imports preserve target and version-2 compatibility',()=>{
 const a=importSong(new TextEncoder().encode(score('C')),'part.ABC'),b=importAbc(score('E'));
 const before=structuredClone(a.project),joined=appendImportedSongs(a.project,[b.project]);
 assert.deepEqual(a.project,before);assert.equal(joined.project.instruments.length,2);
 assert.equal(new Set(joined.project.notes.map(n=>n.id)).size,2);
 assert.deepEqual(parse(JSON.stringify(joined.project)),joined.project);
});
test('file ABC recovery retains tiny notes, ornaments, imperfect ties and music after a bad line',()=>{
 const text=score('!trill!C/1000 D- E\n%%unknown setting\nF @unsupported G\nA {bc} B', 'L:1/4\nQ:120\nM:4/4\nK:C');
 const r=importSong(new TextEncoder().encode(text),'recovery.abc');
 assert.deepEqual(notes(r).map(n=>n.pitch),[60,62,64,65,69,71]);
 assert.equal(notes(r)[0].length,1);
 for(const word of ['expanded','trill','ties','line','grace'])assert.ok(r.warnings.some(w=>w.includes(word)),word);
 assert.deepEqual(parse(JSON.stringify(r.project)),r.project);
 assert.throws(()=>importSong(new TextEncoder().encode('X:1\nK:C\n%%bad'),'empty.abc'),/No ABC notes could be recovered/);
});
test('file ABC tuplets and broken rhythm convert clocks rather than discarding the song',()=>{
 const r=importSong(new TextEncoder().encode(score('(3CDE F>G A<B')),'rhythm.abc');
 assert.deepEqual(music(r).map(n=>n.slice(0,2)),[[0,21],[21,22],[43,21],[64,48],[112,16],[128,16],[144,48]]);
 const repeats=importSong(new TextEncoder().encode(score('|:C [1D:|[2E|]')),'repeats.abc');
 assert.deepEqual(notes(repeats).map(n=>n.pitch),[60,62,64]);assert.ok(repeats.warnings.some(w=>/written order/.test(w)));
});
test('one silent instruction per tick after ABC parsing, speed conversion and additive drops',()=>{
 const r=importAbc(score('C','M:4/4\nL:1/4\nQ:300\nK:C'));
 const marks=p=>p.notes.filter(n=>p.instruments[n.instrument].isInstructions);
 assert.equal(marks(r.project).length,1);assert.equal(marks(r.project)[0].tempo,300);assert.equal(marks(r.project)[0].timeSignature,'4/4');
 const converted=applyImportSpeedMultipliers(r.project);assert.equal(marks(converted).length,1);
 assert.equal(marks(converted)[0].speedMultiplier,2);assert.equal(marks(converted)[0].tempo,150);assert.equal(marks(converted)[0].timeSignature,'4/4');
 const source=importAbc(score('E','M:3/4\nQ:180\nK:C')).project;
 const original=structuredClone(r.project),appended=appendImportedSongs(r.project,[source]);
 assert.deepEqual(r.project,original);assert.equal(marks(appended.project).length,1);
 assert.equal(marks(appended.project)[0].timeSignature,'3/4');assert.equal(marks(appended.project)[0].tempo,180);
 assert.ok(appended.warnings.some(w=>/timeSignature.*conflicting/.test(w)));
 assert.ok(appended.added.includes(marks(appended.project)[0].id));
 assert.ok(appended.added.every(id=>appended.project.notes.some(n=>n.id===id)));
 assert.deepEqual(parse(JSON.stringify(appended.project)),appended.project);
});
test('legacy text encoding is attempted and reported for ABC file imports',()=>{
 const bytes=new TextEncoder().encode(score('C','L:1/4\nK:C').replace('Test','Caf?'));bytes[bytes.indexOf(63)]=233;
 const r=importSong(bytes,'legacy.abc');assert.equal(r.project.instruments[0].name,'Café');assert.equal(r.noteCount,1);assert.ok(r.warnings.some(w=>/Windows-1252/.test(w)));
});
