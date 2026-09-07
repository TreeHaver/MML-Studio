import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateMml} from '../dist/music/mml.js';
import {optimizeInstructions} from '../dist/music/mml-optimizer.js';
const note=(id,start,length,pitch=60,volume=null,instrument=0,tempo=null)=>({id,start,length,pitch,volume,instrument,tempo});
const project=notes=>({format:'mml-studio',version:2,grid:4,instruments:[{name:'Piano',color:'#fff'},{name:'Instructions',color:'#fff',isInstructions:true}],notes});
// Independent reader checks actual emitted timing, pitch, ties and controller state.
function read(text){
 let tick=0,octave=4,volume=8,tempo=120,defaultLength=4,tie=false;const notes=[],tempos=[];
 const tokens=text.match(/[tovl]-?\d+|[a-gr][+]?\d*\.?|&/g)??[];
 assert.equal(tokens.join(''),text);
 for(const token of tokens){const c=token[0],value=Number(token.slice(1));
  if(tie)assert.match(token,/^[a-g]\+?\d*\.?$/,'& must immediately prefix its continued note');
  if(c==='l'){defaultLength=value;continue;}
  if(c==='t'){tempo=value;tempos.push([tick,tempo]);continue;}if(c==='o'){octave=value;continue;}if(c==='v'){volume=value;continue;}if(c==='&'){tie=true;continue;}
  const m=token.match(/^([a-gr])(\+?)(\d*)(\.?)$/),length=128/(m[3]?Number(m[3]):defaultLength)*(m[4]?1.5:1);
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
 assert.equal(r.channels[0],'t120o4ct150&ct180&c');
 assert.equal(bass.channels[0],'t120o3ct150&ct180&c');
 for(const text of [...r.channels,...bass.channels]){
  assert.deepEqual(read(text).tempos,[[0,120],[32,150],[64,180]]);
  assert.doesNotMatch(text,/&t/);
 }
 assert.equal(read(r.channels[0]).notes[0].length,96);
 assert.equal(read(r.channels[1]).notes.length,2,'adjacent separate notes must not be tied');
});

test('optimizer chooses length defaults across interruptions and preserves dots, rests and ties',()=>{
 const source='t120o4v8'+('c16d16r16e16.').repeat(3)+'t150& e16'.replace(' ','')+'c4'+('f8g8').repeat(4);
 const result=optimizeInstructions(source);
 assert.deepEqual(read(result),read(source));
 assert.match(result,/l16/);assert.match(result,/l8/);assert.doesNotMatch(result,/l\d+\./);
 assert.doesNotMatch(result,/&[ltov]/);assert.ok(result.length<source.length-25);
 assert.equal(optimizeInstructions('c8c4c8'),'c8cc8','an isolated length must not introduce unprofitable L');
 assert.equal(optimizeInstructions('c4'.repeat(20)),'c'.repeat(20));
});

test('volume optimization removes only redundant commands and preserves silence and restored dynamics',()=>{
 const source='v8c4v8d4v0e4v0f4v15g4v15a4v8b4';
 const result=optimizeInstructions(source);
 assert.equal(result,'cdv0efv15gav8b');assert.deepEqual(read(result),read(source));
 const p=project([note(1,0,32,60,0),note(2,32,32,62,15),note(3,64,32,64,8),note(4,96,32,65,8)]);
 const original=JSON.stringify(p);
 assert.deepEqual(read(generateMml(p,0).channels[0]).notes.map(n=>n.volume),[0,15,8,8]);
 assert.equal(JSON.stringify(p),original,'explicit repeated project volumes must remain stored');
 assert.deepEqual(p.notes.map(n=>n.volume),[0,15,8,8]);
});

test('length default selection matches exhaustive minimum cost for short mixed phrases',()=>{
 const lengths=['4','8','16'];
 function best(sequence,state='4',index=0){
  if(index===sequence.length)return 0;
  const length=sequence[index];
  return Math.min((length===state?0:length.length)+best(sequence,state,index+1),1+length.length+best(sequence,length,index+1));
 }
 for(let code=0;code<729;code++){
  let value=code;const sequence=Array.from({length:6},()=>{const length=lengths[value%3];value=Math.floor(value/3);return length;});
  const source=sequence.map(length=>'c'+length).join(''),result=optimizeInstructions(source);
  assert.equal(result.length,6+best(sequence));assert.deepEqual(read(result),read(source));
 }
});
