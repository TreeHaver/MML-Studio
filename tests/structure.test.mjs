import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fresh} from '../dist/model/project.js';
import {parse} from '../dist/model/serialization.js';
import {measureLines,sections,exportSegments,signatureChangeTick} from '../dist/music/structure.js';
import {generateMml} from '../dist/music/mml.js';
import {createSheetPlanner} from '../dist/music/sheets.js';
const fixture=()=>({...fresh(),name:'Song of Storms',instruments:[{name:'Piano',color:'#abcdef'},{name:'Flute',color:'#abcdef'},{name:'Instructions',color:'#579dff',isInstructions:true}],notes:[]});
const marker=(id,start,extra={})=>({id,start,instrument:2,length:1,pitch:60,volume:0,...extra});
const note=(id,start,length,extra={})=>({id,start,length,instrument:0,pitch:60,volume:null,...extra});

test('header signature edits establish initial meter or target the current measure start',()=>{
 const p=fixture();p.notes=[marker(1,150,{section:'Song',resetMeasures:true})];
 assert.equal(signatureChangeTick(p,400),0);
 p.notes.push(marker(2,500,{timeSignature:'3/4'}));
 assert.equal(signatureChangeTick(p,140),128,'future signature means current default measures apply');
 assert.equal(signatureChangeTick(p,400),278,'Song resets anchor the measure');
 assert.equal(signatureChangeTick(p,600),596);
 assert.equal(signatureChangeTick(p,596),596);
 p.notes.push(marker(3,620,{section:'Segment'}));assert.equal(signatureChangeTick(p,630),596);
 p.notes.push(marker(4,650,{timeSignature:'6/8'}));assert.equal(signatureChangeTick(p,700),650);
 for(const tick of [0,140,150,400,500,600,630,700]){
  const expected=measureLines(p,0,tick+1).filter(l=>l.major).at(-1).tick;
  assert.equal(signatureChangeTick(p,tick),expected);
 }
});
test('names and optional visual instructions roundtrip in version 2; malformed fields fail',()=>{
 const p=fixture();p.notes=[marker(1,128,{timeSignature:'3/4',section:'Second song',resetMeasures:true})];
 assert.deepEqual(parse(JSON.stringify(p)),p);delete p.name;assert.equal(parse(JSON.stringify(p)).version,2);
 for(const extra of [{timeSignature:'0/4'},{timeSignature:'3/0'},{timeSignature:'3/3'},{section:3},{resetMeasures:'true'}])assert.throws(()=>parse(JSON.stringify({...p,notes:[marker(1,0,extra)]})));
 assert.throws(()=>parse(JSON.stringify({...p,name:2})));
 assert.throws(()=>parse(JSON.stringify({...p,notes:[marker(1,0,{timeSignature:'3/4'}),marker(2,0,{timeSignature:'4/4'})]})));
});
test('signature applies at the exact marker; section reset realigns and renumbers there',()=>{
 const p=fixture();p.notes=[marker(1,128,{timeSignature:'3/4'}),marker(2,250,{section:'New song',resetMeasures:true}),marker(3,360,{section:'Chorus',resetMeasures:false})];
 const bars=measureLines(p,0,550).filter(l=>l.major).map(l=>[l.tick,l.bar,l.signature]);
 assert.deepEqual(bars,[[0,1,'4/4'],[128,2,'3/4'],[224,3,'3/4'],[250,1,'3/4'],[346,2,'3/4'],[442,3,'3/4'],[538,4,'3/4']]);
 assert.deepEqual(measureLines(p,330,455).filter(l=>l.major).map(l=>[l.tick,l.bar]),[[346,2],[442,3]]);
 p.notes=[marker(1,128,{timeSignature:'6/8',section:'Song',resetMeasures:true})];
 assert.deepEqual(measureLines(p,128,225).map(l=>l.tick),[128,144,160,176,192,208,224]);
 p.notes=[marker(1,150,{section:' ',resetMeasures:true})];assert.deepEqual(sections(p),[]);
 assert.deepEqual(measureLines(p,0,300).filter(l=>l.major).map(l=>l.tick),[0,128,256]);
});
test('visual markers leave musical MML unchanged and segment slicing carries tempo and held notes',()=>{
 const p=fixture();p.notes=[note(1,0,32,{volume:12,tempo:90}),note(2,100,200),note(3,160,7,{instrument:1,volume:6}),marker(4,50,{tempo:150})];
 const before=generateMml(p,0).channels;
 p.notes.push(marker(5,128,{section:'One',timeSignature:'3/4',resetMeasures:true}),marker(6,256,{section:'Two'}));
 assert.deepEqual(generateMml(p,0).channels,before);const saved=JSON.stringify(p),parts=exportSegments(p,true);
 assert.deepEqual(parts.map(p=>p.name),['01-Opening','02-One','03-Two']);
 const middle=parts[1].project,last=parts[2].project;
 assert.deepEqual(middle.notes.filter(n=>n.instrument===0).map(n=>[n.start,n.length,n.volume]),[[0,128,12]]);
 assert.deepEqual(last.notes.filter(n=>n.instrument===0).map(n=>[n.start,n.length,n.volume]),[[0,44,12]]);
 assert.equal(middle.notes.find(n=>n.instrument===1).start,32);
 assert.match(generateMml(middle,0).channels[0],/^t150/);
 assert.deepEqual(generateMml(last,1).channels,[]);
 for(const part of parts)for(let i=0;i<2;i++)for(const sheet of createSheetPlanner(part.project,i,40).split())assert.ok(sheet.bytes<=40);
 assert.equal(JSON.stringify(p),saved);assert.equal(exportSegments(p,false)[0].project,p);
});
