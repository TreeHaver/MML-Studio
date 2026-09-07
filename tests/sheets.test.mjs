import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSheetPlanner,ms2Xml} from '../dist/music/sheets.js';
import {importMml} from '../dist/import/mml.js';
const note=(id,start,length,pitch=60,volume=null,tempo=null,instrument=0)=>({id,start,length,pitch,volume,tempo,instrument});
const project=notes=>({format:'mml-studio',version:2,grid:4,instruments:[{name:'Piano',color:'#abcdef'},{name:'Instructions',color:'#abcdef',isInstructions:true}],notes});
function read(text){
 let tick=0,octave=4,volume=8,tie=false;const notes=[],tempos=[];
 const tokens=text.match(/[tov]-?\d+|[a-gr][+]?\d+\.?|&/g)??[];assert.equal(tokens.join(''),text);
 for(const token of tokens){const c=token[0],value=Number(token.slice(1));
  if(tie)assert.match(token,/^[a-g]\+?\d+\.?$/);
  if(c==='t'){tempos.push([tick,value]);continue;}if(c==='o'){octave=value;continue;}if(c==='v'){volume=value;continue;}if(c==='&'){tie=true;continue;}
  const m=token.match(/^([a-gr])(\+?)(\d+)(\.?)$/),length=128/Number(m[3])*(m[4]?1.5:1);
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
 const p=project([note(1,1200,400,60,10),note(2,1250,32,67,null),note(3,200,1,60,0,160,1)]);
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
