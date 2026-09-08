import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateMml} from '../dist/music/mml.js';
import {optimizeInstructions} from '../dist/music/mml-optimizer.js';
const note=(id,start,length,pitch=60,volume=null,instrument=0,tempo=null)=>({id,start,length,pitch,volume,instrument,tempo});
const project=notes=>({format:'mml-studio',version:2,grid:4,instruments:[{name:'Piano',color:'#fff'},{name:'Instructions',color:'#fff',isInstructions:true}],notes});
test('speed zones shorten rests and held notes without multiplying MML tempo',()=>{
 const p=project([note(1,0,128),note(2,64,64,64),{...note(3,32,1,60,0,1),speedEntry:true,speedMultiplier:2},{...note(4,96,1,60,0,1),speedExit:true},note(5,64,1,60,0,1,150)]);
 const before=JSON.stringify(p),result=generateMml(p,0),decoded=result.channels.map(read);
 assert.deepEqual(decoded.flatMap(c=>c.notes),[{start:0,length:96,pitch:60,volume:8},{start:48,length:48,pitch:64,volume:8}]);
 for(const c of decoded)assert.deepEqual(c.tempos,[[0,120],[48,150]]);
 assert.equal(JSON.stringify(p),before);
});
test('decimal multipliers and sub-tick lengths are exact, with fine-resolution warnings',()=>{
 for(const multiplier of [0.5,1.5,2,3,4])for(const length of [1,7,32,129]){
  const p=project([note(1,7,length),{...note(2,0,1,60,0,1),speedEntry:true,speedMultiplier:multiplier}]);
  const r=generateMml(p,0),decoded=read(r.channels[0]);
  assert.ok(Math.abs(decoded.notes[0].start-7/multiplier)<1e-10);
  assert.ok(Math.abs(decoded.notes[0].length-length/multiplier)<1e-10);
  assert.deepEqual(decoded.tempos,[[0,120]]);
 }
 assert.match(generateMml(project([note(1,0,1),{...note(2,0,1,60,0,1),speedEntry:true}]),0).warnings.join(' '),/finer than 1\/128/);
});
// Independent reader checks actual emitted timing, pitch, ties and controller state.
function read(text){
 let tick=0,octave=4,volume=8,tempo=120,defaultLength=32,tie=false;const notes=[],tempos=[];
 const tokens=text.match(/[tov]-?\d+|l\d+\.?|[a-gr][+]?\d*\.?|&/g)??[];
 assert.equal(tokens.join(''),text);
 for(const token of tokens){const c=token[0],value=Number(token.slice(1));
  if(tie)assert.match(token,/^[a-g]\+?\d*\.?$/,'& must immediately prefix its continued note');
  if(c==='l'){assert.ok(value>=1&&value<=64,'MS2 default length must be L1–L64');defaultLength=128/value*(token.endsWith('.')?1.5:1);continue;}
  if(c==='t'){tempo=value;tempos.push([tick,tempo]);continue;}if(c==='o'){octave=value;continue;}if(c==='v'){volume=value;continue;}if(c==='&'){tie=true;continue;}
  const m=token.match(/^([a-gr])(\+?)(\d*)(\.?)$/),length=(m[3]?128/Number(m[3]):defaultLength)*(m[4]?1.5:1);
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
 assert.match(result,/l16/);assert.match(result,/l8/);
 assert.doesNotMatch(result,/&[ltov]/);assert.ok(result.length<source.length-25);
 assert.equal(optimizeInstructions('c8c4c8'),'c8cc8','an isolated length must not introduce unprofitable L');
 assert.equal(optimizeInstructions('c4'.repeat(20)),'c'.repeat(20));
});

test('128th notes and rests stay explicit while L64 remains available',()=>{
 for(const source of ['c128'.repeat(12),'r128'.repeat(12),('c64r64').repeat(8)+('c128r128').repeat(8)+('d64r64').repeat(8),('c128t150&c128').repeat(8)]){
  const result=optimizeInstructions(source);
  assert.deepEqual(read(result),read(source));
  assert.equal((result.match(/(?:[a-gr])128/g)??[]).length,(source.match(/(?:[a-gr])128/g)??[]).length);
 }
 assert.equal(optimizeInstructions('c64'.repeat(12)),'l64'+'c'.repeat(12));
 const p=project([note(1,0,4),note(2,5,1),note(3,7,1),note(4,9,1),...Array.from({length:3},(_,i)=>note(10+i,i+1,1,60,0,1,130+i*10))]);
 const result=generateMml(p,0),decoded=read(result.channels[0]);
 assert.deepEqual(decoded.notes,p.notes.filter(n=>n.instrument===0).map(n=>({start:n.start,length:n.length,pitch:n.pitch,volume:8})));
 assert.deepEqual(decoded.tempos,[[0,120],[1,130],[2,140],[3,150]]);
 assert.match(result.channels[0],/t130&c128t140&c128t150&c128/);
 assert.match(result.channels[0],/r128c128/);
 assert.equal(result.bytes,Buffer.byteLength(result.channels.join('')));
});

test('dotted L defaults lengthen inherited notes and preserve explicit overrides',()=>{
 assert.equal(optimizeInstructions('c1.'.repeat(12)),'l1.'+'c'.repeat(12));
 for(const source of [('c1.r1.').repeat(8)+'c1c128r128'+('d1.').repeat(8),('c64.r64.').repeat(8)+'c64'+('e64.').repeat(8),('c1.t150&c1.').repeat(8)]){
  assert.deepEqual(read(optimizeInstructions(source)),read(source));
 }
 const result=generateMml(project(Array.from({length:8},(_,i)=>note(i,i*192,192))),0);
 assert.match(result.channels[0],/l1\./);
 assert.deepEqual(read(result.channels[0]).notes.map(n=>n.length),Array(8).fill(192));
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
 const lengths=['4','64','128'];
 function best(sequence,state='4',index=0){
  if(index===sequence.length)return 0;
  const length=sequence[index];
  return Math.min((length===state?0:length.length)+best(sequence,state,index+1),Number(length)<=64?1+length.length+best(sequence,length,index+1):Infinity);
 }
 for(let code=0;code<729;code++){
  let value=code;const sequence=Array.from({length:6},()=>{const length=lengths[value%3];value=Math.floor(value/3);return length;});
  const source=sequence.map(length=>'c'+length).join(''),result=optimizeInstructions(source);
  assert.equal(result.length,6+best(sequence));assert.deepEqual(read(result),read(source));
 }
});
