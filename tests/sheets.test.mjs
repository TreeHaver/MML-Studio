import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSheetPlanner,ms2Xml} from '../dist/music/sheets.js';
import {importMml} from '../dist/import/mml.js';
import {createLazyEnsemble} from '../dist/music/lazy-ensemble.js';
import {generateMml} from '../dist/music/mml.js';
import {removeSupersededTempos} from '../dist/music/mml-optimizer.js';
const note=(id,start,length,pitch=60,volume=null,tempo=null,instrument=0)=>({id,start,length,pitch,volume,tempo,instrument});
const project=notes=>({format:'mml-studio',version:2,grid:4,instruments:[{name:'Piano',color:'#abcdef'},{name:'Instructions',color:'#abcdef',isInstructions:true}],notes});
function read(text){
 let tick=0,octave=4,volume=8,defaultLength=32,tie=false;const notes=[],tempos=[];
 const tokens=text.match(/[tov]-?\d+|l\d+\.?|[a-gr][+]?\d*\.?|&/g)??[];assert.equal(tokens.join(''),text);
 for(const token of tokens){const c=token[0],value=Number(token.slice(1));
  if(tie)assert.match(token,/^[a-g]\+?\d*\.?$/);
  if(c==='l'){defaultLength=128/value*(token.endsWith('.')?1.5:1);continue;}
  if(c==='t'){tempos.push([tick,value]);continue;}if(c==='o'){octave=value;continue;}if(c==='v'){volume=value;continue;}if(c==='&'){tie=true;continue;}
  const m=token.match(/^([a-gr])(\+?)(\d*)(\.?)$/),length=(m[3]?128/Number(m[3]):defaultLength)*(m[4]?1.5:1);
  if(c!=='r'){const pitch=(octave+1)*12+({c:0,d:2,e:4,f:5,g:7,a:9,b:11}[c])+(m[2]?1:0);if(tie){assert.equal(notes.at(-1).pitch,pitch);notes.at(-1).length+=length;}else notes.push({start:tick,length,pitch,volume});}tie=false;tick+=length;
 }return {notes,tempos,tick};
}
const sort=notes=>notes.sort((a,b)=>a.start-b.start||a.pitch-b.pitch||a.length-b.length||a.volume-b.volume);
function verify(p,limit){
 const before=JSON.stringify(p),planner=createSheetPlanner(p,0,limit),parts=planner.split();
 const original=planner.whole.channels.flatMap(c=>read(c).notes);
 let start=0;
 for(const part of parts){
  assert.equal(part.start,start);assert.ok(part.end>start);assert.ok(part.bytes<=limit,part.bytes+' > '+limit);
  assert.equal(part.bytes,part.channels.join('').length);
  const decoded=part.channels.map(read);assert.ok(decoded.every(c=>c.tick===part.end-part.start));
  const expected=original.filter(n=>n.start<part.end&&n.start+n.length>start).map(n=>({...n,start:Math.max(n.start,start)-start,length:Math.min(n.start+n.length,part.end)-Math.max(n.start,start)}));
  assert.deepEqual(sort(decoded.flatMap(c=>c.notes)),sort(expected));
  for(const channel of decoded)assert.equal(channel.tempos[0][0],0);
  start=part.end;
 }
 assert.equal(start,planner.end);assert.equal(JSON.stringify(p),before);return parts;
}
test('sheets split dense polyphony on one clock, retaining notes, inherited volume and tempo',()=>{
 const p=project([note(1,0,512,48,4),...Array.from({length:24},(_,i)=>note(i+2,i*20,13,60+i%7,i===10?12:null)),note(90,97,1,60,0,180,1),note(91,240,1,60,0,90,1)]);
 const parts=verify(p,100);assert.ok(parts.length>1);
 for(const part of parts){let bpm=part.start>=240?90:part.start>=97?180:120;for(const channel of part.channels){const decoded=read(channel);assert.equal(decoded.tempos[0][1],bpm);if(part.start<97&&part.end>97)assert.ok(decoded.tempos.some(([tick,v])=>tick===97-part.start&&v===180));}}
});
test('clean nearby note boundaries preferred; forced cuts retain held remainder',()=>{
 const clean=project(Array.from({length:40},(_,i)=>note(i,i*16,12,60+i%2,9)));
 const parts=verify(clean,70);assert.ok(parts.length>1);
 for(const part of parts.slice(0,-1))assert.ok(!clean.notes.some(n=>n.start<part.end&&n.start+n.length>part.end));
 const held=project([note(1,0,4000,60,7)]);const forced=verify(held,45);assert.ok(forced.length>1);assert.equal(forced.reduce((sum,p)=>sum+read(p.channels[0]).notes[0].length,0),4000);
});
test('leading silence and trailing voice rests remain synchronized and count toward limits',()=>{
 // Long enough to require a silent part even after repeated rests use L.
 const p=project([note(1,6000,400,60,10),note(2,6050,32,67,null),note(3,200,1,60,0,160,1)]);
 const parts=verify(p,40);assert.ok(parts.length>1);assert.ok(parts.some(p=>p.channels.every(c=>read(c).notes.length===0)));
});
test('custom limit, exact-limit single export, XML roundtrip and impossible limit',()=>{
 const p=project([note(1,0,32),note(2,0,32,67)]),plan=createSheetPlanner(p,0,10000);
 assert.equal(createSheetPlanner(p,0,plan.whole.bytes).split().length,1);
 assert.equal(importMml(ms2Xml(plan.whole.channels)).noteCount,2);
 assert.throws(()=>createSheetPlanner(p,0,1).split(),/too small/);
 for(const bad of [0,-1,1.5,Infinity])assert.throws(()=>createSheetPlanner(p,0,bad));
 assert.equal(createSheetPlanner(project([]),0,20).split().length,0);
});
test('varied non-grid lengths and crossing voices survive repeated parts',()=>{
 for(let seed=1;seed<=12;seed++){
  const p=project(Array.from({length:28},(_,i)=>note(i,i*11,5+(i*seed)%45,50+i%12,i%8===0?i%15:null)));
  verify(p,90+seed*3);
 }
});

// Decode each file's own clock: compressed rests deliberately have different
// musical tick counts, but note onsets/releases must match in elapsed seconds.
function performance(channels){
 return channels.flatMap(text=>{
  const decoded=read(text);
  const seconds=tick=>{let result=0,previous=0,bpm=120;for(const [at,next] of decoded.tempos){if(at>tick)break;result+=(at-previous)*60/(32*bpm);previous=at;bpm=next;}return result+(tick-previous)*60/(32*bpm);};
  return decoded.notes.map(n=>({start:seconds(n.start),end:seconds(n.start+n.length),pitch:n.pitch,volume:n.volume}));
 }).sort((a,b)=>a.start-b.start||a.pitch-b.pitch||a.end-b.end||a.volume-b.volume);
}
function elapsedEnd(text){
 const decoded=read(text);let seconds=0,tick=0,bpm=120;
 for(const [next,value] of decoded.tempos){seconds+=(next-tick)*60/(32*bpm);tick=next;bpm=value;}
 return seconds+(decoded.tick-tick)*60/(32*bpm);
}
function verifyEnsemble(p,indexes){
 const before=JSON.stringify(p),plan=createLazyEnsemble(p,indexes);
 const expected=performance((indexes??p.instruments.map((_,i)=>i)).filter(i=>!p.instruments[i].isInstructions).flatMap(i=>generateMml(p,i).channels));
 const actual=performance(plan.parts.flatMap(p=>p.channels));
 assert.equal(actual.length,expected.length);
 for(let i=0;i<actual.length;i++){assert.equal(actual[i].pitch,expected[i].pitch);assert.equal(actual[i].volume,expected[i].volume);assert.ok(Math.abs(actual[i].start-expected[i].start)<1e-7);assert.ok(Math.abs(actual[i].end-expected[i].end)<1e-7);}
 const expectedEnd=elapsedEnd(generateMml(p,0,undefined,undefined,{endTick:plan.end}).channels[0]);
 for(const part of plan.parts){assert.ok(part.channels.length<=10);assert.ok(part.bytes<=10000);assert.equal(part.bytes,part.channels.join('').length);for(const channel of part.channels)assert.ok(Math.abs(elapsedEnd(channel)-expectedEnd)<1e-7,'every channel ends on the common timeline');}
 assert.equal(JSON.stringify(p),before);return plan;
}
test('Lazy Ensemble combines sounds, keeps per-instrument V and global clock, and enforces ten channels',()=>{
 const p=project([...Array.from({length:21},(_,i)=>note(i,0,32,48+i,i%15)),note(30,64,7,70,null),note(31,0,1,60,0,150,1)]);
 p.instruments.push({name:'Violin',color:'#123456',midiProgram:40});
 p.notes.push(note(32,40,13,75,3,null,2),note(33,70,11,76,null,null,2));
 const plan=verifyEnsemble(p);assert.equal(plan.parts.length,3);
 assert.equal(verifyEnsemble(p,[2]).parts.length,1);
 assert.deepEqual(createLazyEnsemble(project([])).parts,[]);
});
test('Lazy Ensemble preserves long leading/trailing silence through local rest tempo shifts',()=>{
 const p=project([note(1,0,7,60,5),note(2,100000,11,65,null),note(3,100,1,60,0,173,1),note(4,55555,1,60,0,91,1)]);
 const plan=verifyEnsemble(p);assert.equal(plan.parts.length,1);assert.match(plan.parts[0].channels.join(''),/t32/);
});
test('Lazy Ensemble splits character-heavy music without cutting or shifting notes',()=>{
 const p=project(Array.from({length:2600},(_,i)=>note(i,i*3,1,48+i%36,i%16)));
 const plan=verifyEnsemble(p);assert.ok(plan.parts.length>1);
 assert.ok(performance(plan.parts[1].channels)[0].start>0,'later file retains its absolute delay');
});
test('Lazy Ensemble follows loops and decimal speed zones without modifying version 2 data',()=>{
 const p=project([note(1,0,128,60,5),note(2,128,7,65,null),{...note(3,32,1,60,0,null,1),speedEntry:true,speedMultiplier:1.5},{...note(4,96,1,60,0,null,1),speedExit:true},{...note(5,0,1,60,0,null,1),loopEntry:true,loopCount:2},{...note(6,160,1,60,0,null,1),loopExit:true},note(7,48,1,60,0,150,1)]);
 verifyEnsemble(p);
});

test('export-only extreme compression shortens held notes and preserves elapsed time across clocks',()=>{
 const p=project([note(1,0,24000,60,5),note(2,24013,7011,67,11),note(3,8000,1,60,0,180,1),note(4,20000,1,60,0,90,1),{...note(5,10000,1,60,0,null,1),speedEntry:true,speedMultiplier:1.5},{...note(6,19000,1,60,0,null,1),speedExit:true},note(7,6000,80,72,0)]);
 const before=JSON.stringify(p),ordinary=generateMml(p,0),compressed=createSheetPlanner(p,0,10000,true).whole;
 assert.ok(compressed.bytes<ordinary.bytes);assert.match(compressed.channels.join(''),/t32/);
 const expected=performance(ordinary.channels),actual=performance(compressed.channels);
 assert.equal(actual.length,expected.length);
 for(let i=0;i<actual.length;i++){assert.equal(actual[i].pitch,expected[i].pitch);assert.equal(actual[i].volume,expected[i].volume);assert.ok(Math.abs(actual[i].start-expected[i].start)<1e-7);assert.ok(Math.abs(actual[i].end-expected[i].end)<1e-7);}
 assert.deepEqual(generateMml(p,0),ordinary,'ordinary editor output and counts are unchanged');assert.equal(JSON.stringify(p),before);
 const lazy=createLazyEnsemble(p,undefined,0,true);
 assert.ok(lazy.parts.every(p=>p.bytes<=10000&&p.channels.length<=10));
 for(const channel of lazy.parts.flatMap(p=>p.channels))assert.ok(Math.abs(elapsedEnd(channel)-Math.max(...compressed.channels.map(elapsedEnd)))<1e-7);
});
test('extreme compression keeps already compact music and applies to loops and verified sequential parts',()=>{
 const short=project([note(1,0,32)]);
 assert.deepEqual(createSheetPlanner(short,0,10000,true).whole.channels,generateMml(short,0).channels);
 const p=project([note(1,0,12000),{...note(2,0,1,60,0,null,1),loopEntry:true,loopCount:2},{...note(3,12000,1,60,0,null,1),loopExit:true}]);
 const ordinary=generateMml(p,0),compressed=generateMml(p,0,undefined,undefined,{extremeCompression:true});
 assert.ok(compressed.bytes<ordinary.bytes);
 assert.ok(Math.abs(elapsedEnd(ordinary.channels[0])-elapsedEnd(compressed.channels[0]))<1e-7);
 const planner=createSheetPlanner(p,0,35,true),parts=planner.split();assert.ok(parts.length>1);
 for(const part of parts){assert.ok(part.bytes<=35);const expected=createSheetPlanner(p,0,35).render(part.start,part.end);assert.ok(Math.abs(elapsedEnd(part.channels[0])-elapsedEnd(expected.channels[0]))<1e-7);}
});

test('extreme compression drops superseded tempos across zero-time instructions only',()=>{
 assert.equal(removeSupersededTempos('t120o4v9l1.t90t32c'), 'o4v9l1.t32c');
 assert.equal(removeSupersededTempos('t120c4t90o4l4t32&c4'), 't120c4o4l4t32&c4');
 assert.equal(removeSupersededTempos('t120r4t90c4t32'), 't120r4t90c4t32','notes/rests separate tempos; final restoration remains');
 const p=project([note(1,0,3840)]),ordinary=generateMml(p,0),compressed=createSheetPlanner(p,0,10000,true).whole;
 assert.equal(compressed.channels[0],'o4t32l1.c&c&c&c&c&c2t120');
 assert.ok(Math.abs(elapsedEnd(compressed.channels[0])-60)<1e-7);
 assert.deepEqual(performance(compressed.channels),performance(ordinary.channels));
 assert.match(generateMml(p,0).channels[0],/^t120o4/,'ordinary editor text is unchanged');
});

test('Lazy Ensemble honors custom character limits and refuses more than ten players',()=>{
 const p=project(Array.from({length:2600},(_,i)=>note(i,i*3,1,48+i%36,i%16)));
 const small=createLazyEnsemble(p,undefined,0,false,5000),large=createLazyEnsemble(p,undefined,0,false,50000);
 assert.ok(small.parts.length>large.parts.length);assert.equal(large.parts.length,1);
 assert.ok(small.parts.every(p=>p.bytes<=5000));assert.ok(large.parts[0].bytes>10000);
 assert.deepEqual(performance(small.parts.flatMap(p=>p.channels)),performance(large.parts.flatMap(p=>p.channels)));
 const chord=project(Array.from({length:100},(_,i)=>note(i,0,32,60+i%12)));
 assert.equal(createLazyEnsemble(chord).parts.length,10);
 chord.notes.push(note(100,0,32));assert.throws(()=>createLazyEnsemble(chord),/10 players/);
 assert.throws(()=>createLazyEnsemble(p,undefined,0,false,500),/10 players/,'character pressure alone can exceed the player limit');
 for(const bad of [0,-1,1.5,Infinity,NaN])assert.throws(()=>createLazyEnsemble(p,undefined,0,false,bad),/positive whole number/);
});
