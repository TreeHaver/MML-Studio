import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateMml} from '../dist/music/mml.js';
const note=(id,start,length,pitch=60,volume=null,instrument=0,tempo=null)=>({id,start,length,pitch,volume,instrument,tempo});
const project=notes=>({format:'mml-studio',version:2,grid:4,instruments:[{name:'Piano',color:'#fff'},{name:'Instructions',color:'#fff',isInstructions:true}],notes});
// Independent reader checks actual emitted timing, pitch, ties and controller state.
function read(text){
 let tick=0,octave=4,volume=8,tempo=120,tie=false;const notes=[],tempos=[];
 const tokens=text.match(/[tov]-?\d+|[a-gr][+]?\d+\.?|&/g)??[];
 assert.equal(tokens.join(''),text);
 for(const token of tokens){const c=token[0],value=Number(token.slice(1));
  if(tie)assert.match(token,/^[a-g]\+?\d+\.?$/,'& must immediately prefix its continued note');
  if(c==='t'){tempo=value;tempos.push([tick,tempo]);continue;}if(c==='o'){octave=value;continue;}if(c==='v'){volume=value;continue;}if(c==='&'){tie=true;continue;}
  const m=token.match(/^([a-gr])(\+?)(\d+)(\.?)$/),length=128/Number(m[3])*(m[4]?1.5:1);
  if(c!=='r'){const pitch=(octave+1)*12+({c:0,d:2,e:4,f:5,g:7,a:9,b:11}[c])+(m[2]?1:0);if(tie){assert.equal(notes.at(-1).pitch,pitch);notes.at(-1).length+=length;}else notes.push({start:tick,length,pitch,volume});}
  tie=false;tick+=length;
 }
 return {notes,tempos,tick};
}
test('MML preserves every integer duration, initial rests, sharps and byte counts',()=>{
 for(let length=1;length<=400;length++){
  const p=project([note(1,7,length,61,11)]),before=JSON.stringify(p),r=generateMml(p,0);
  assert.deepEqual(read(r.channels[0]).notes,[{start:7,length,pitch:61,volume:11}]);
  assert.equal(r.bytes,Buffer.byteLength(r.channels.join(''),'utf8'));assert.equal(JSON.stringify(p),before);
 }
});
test('MML allocates overlapping voices, retains >10 channels, and inherits volume across voices',()=>{
 const notes=Array.from({length:11},(_,i)=>note(i,0,32,60+i,i===10?13:null));notes.push(note(12,32,7,80));
 const r=generateMml(project(notes),0);assert.equal(r.channels.length,11);assert.match(r.warnings.join(' '),/Over 10 Channels/);
 const decoded=r.channels.flatMap(c=>read(c).notes);assert.equal(decoded.length,12);assert.ok(decoded.every(n=>n.volume===13));
 assert.equal(generateMml(project([note(1,0,32),note(2,32,32)]),0).channels.length,1);
});
test('MML synchronizes global tempo through rests and ties without sounding Instructions',()=>{
 const p=project([note(1,0,64),note(2,32,64,64),note(3,7,1,60,0,1,90),note(4,40,1,60,0,1,180)]);
 const r=generateMml(p,0);assert.equal(r.channels.length,2);
 for(const channel of r.channels)assert.deepEqual(read(channel).tempos,[[0,120],[7,90],[40,180]]);
 assert.deepEqual(r.channels.flatMap(c=>read(c).notes),[{start:0,length:64,pitch:60,volume:8},{start:32,length:64,pitch:64,volume:8}]);
 assert.equal(generateMml(p,1).channels.length,0);
});
test('MML compatibility warnings never clamp source data or truncate output',()=>{
 const p=project([note(1,0,11,0,0,0,300)]);p.instruments[0].isDrum=true;
 const r=generateMml(p,0);assert.equal(r.warnings.length,3);assert.match(r.channels[0],/t300o-1v0/);
 assert.equal(generateMml(project([]),0).bytes,0);
});

test('instrument result bytes exclude notes from other instruments',()=>{
 const p=project([note(1,0,32,60),note(2,0,32,64,null,1)]);
 const one=generateMml(p,0),two=generateMml(p,1);
 assert.equal(one.bytes,one.channels.join('').length);assert.equal(two.bytes,two.channels.join('').length);assert.equal(one.bytes,generateMml({...p,notes:p.notes.filter(n=>n.instrument===0)},0).bytes);
});

test('note-bound tempo reaches every channel and precedes tied continuations',()=>{
 const p=project([note(1,0,96),note(2,32,32,64,null,0,150),note(3,64,32,67,null,0,180),note(4,0,96,48,null,2)]);
 p.instruments.push({name:'Bass',color:'#fff'});
 const r=generateMml(p,0),bass=generateMml(p,2);
 assert.equal(r.channels[0],'t120o4v8c4t150&c4t180&c4');
 assert.equal(bass.channels[0],'t120o3v8c4t150&c4t180&c4');
 for(const text of [...r.channels,...bass.channels]){
  assert.deepEqual(read(text).tempos,[[0,120],[32,150],[64,180]]);
  assert.doesNotMatch(text,/&t/);
 }
 assert.equal(read(r.channels[0]).notes[0].length,96);
 assert.equal(read(r.channels[1]).notes.length,2,'adjacent separate notes must not be tied');
});
