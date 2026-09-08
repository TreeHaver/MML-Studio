import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {audioPlan,renderAudio,SAMPLE_RATE} from '../dist/audio/render.js';
import {projectSegment} from '../dist/model/segment-view.js';
const n=(id,start,length,pitch=60,extra={})=>({id,start,length,pitch,instrument:0,volume:8,...extra});
const fixture=()=>({format:'mml-studio',version:2,grid:4,instruments:[{name:'Piano',color:'#4488aa',midiProgram:0},{name:'Instructions',color:'#f4d35e',isInstructions:true}],notes:[n(1,16,16),n(2,0,1,60,{instrument:1,volume:0,loopEntry:true,loopCount:3}),n(3,32,1,60,{instrument:1,volume:0,loopExit:true})]});
const request=project=>({project,minimumEnd:0,speed:1,volume:1,muted:[]});
test('audio clock expands loops, keeps leading rests and applies playback speed',()=>{
 const p=fixture(),before=JSON.stringify(p),plan=audioPlan(request(p));
 assert.deepEqual(plan.events.filter(e=>e.message[0]>>4===9).map(e=>e.frame),[.25,.75,1.25].map(t=>t*SAMPLE_RATE));
 const fast=audioPlan({...request(p),speed:2});assert.equal(fast.endFrame,Math.round(plan.endFrame/2));
 assert.equal(JSON.stringify(p),before);
});
test('audio uses the scoped projection and retains tempo from excluded instruments',()=>{
 const p=fixture();p.notes=[n(1,0,192),n(2,64,1,60,{instrument:1,volume:0,tempo:60})];
 const range={kind:'segment',name:'Middle',start:32,end:96},view=projectSegment(p,range).project;
 const plan=audioPlan({...request(view),minimumEnd:64});
 assert.equal(plan.endFrame,1.5*SAMPLE_RATE);
 assert.deepEqual(plan.events.filter(e=>[8,9].includes(e.message[0]>>4)).map(e=>[e.frame,e.message[0]>>4]),[[0,9],[1.5*SAMPLE_RATE,8]]);
 p.instruments.push({name:'Muted',color:'#abcdef'});p.notes.push(n(5,0,32,64,{instrument:2,tempo:90}));
 const muted=audioPlan({...request(p),muted:[2]});assert.ok(muted.mutedChannels.length);
 assert.equal(muted.events.find(e=>e.message[0]>>4===8).frame,Math.round(32/32*60/90*SAMPLE_RATE));
});
test('offline synth streams real PCM, respects silent volume/mutes and cancels',async()=>{
 const bytes=fs.readFileSync('assets/TimGM6mb.sf2'),bank=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 const p=fixture();p.notes=[n(1,16,16)];
 const render=async options=>{const chunks=[];const result=await renderAudio({...request(p),...options},bank,async pcm=>chunks.push(new Float32Array(pcm)));return {result,data:Float32Array.from(chunks.flatMap(c=>Array.from(c)))};};
 const full=await render({}),half=await render({volume:.5}),silent=await render({muted:[0]}),zero=await render({volume:0});
 const peak=data=>data.reduce((v,x)=>Math.max(v,Math.abs(x)),0);
 assert.ok(peak(full.data)>.001);assert.equal(peak(full.data.subarray(0,.24*SAMPLE_RATE*2)),0);
 assert.ok(Math.abs(peak(half.data)/peak(full.data)-.5)<.03);
 assert.equal(peak(silent.data),0);assert.equal(peak(zero.data),0);
 assert.ok(full.result.seconds>full.result.musicSeconds,'Release continues after the final note-off');
 await assert.rejects(renderAudio(request(p),bank,async()=>{},()=>{},()=>true),/canceled/);
});


test('audio worker reports encoder failure without changing the destination',async()=>{
 const {Worker}=await import('node:worker_threads'),path=await import('node:path');
 const root=fs.mkdtempSync(path.resolve('.validation/audio-worker-failure-')),target=path.join(root,'kept.wav'),temporary=path.join(root,'partial.tmp');fs.writeFileSync(target,'original');
 const worker=new Worker(path.resolve('vendor/audio-worker.cjs'),{workerData:{request:request(fixture()),encoder:path.join(root,'missing-encoder.exe'),bank:path.resolve('assets/TimGM6mb.sf2'),target,temporary,codec:['-f','wav']}});
 const messages=[];worker.on('message',message=>messages.push(message));
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{worker.terminate();reject(Error('Worker did not exit after encoder failure'));},10000);worker.on('error',reject);worker.on('exit',()=>{clearTimeout(timer);resolve();});});
 assert.ok(messages.some(m=>m.error));assert.equal(fs.readFileSync(target,'utf8'),'original');assert.equal(fs.existsSync(temporary),false);
});


test('offline routes beyond the first MIDI port retain melodic presets and percussion roles',async()=>{
 const bytes=fs.readFileSync('assets/TimGM6mb.sf2'),bank=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 const render=async project=>{let peak=0;await renderAudio(request(project),bank,async pcm=>{for(const value of pcm)peak=Math.max(peak,Math.abs(value));});return peak;};
 // Silent overlapping notes allocate fifteen melodic routes. The next instrument
 // must sound on channel 16, where a newly-created core channel starts in drum mode.
 for(const role of [{midiProgram:24},{midiProgram:32},{isDrum:true},{ms2Drum:'snare'}])for(const routeCount of (role.midiProgram!==undefined?[15,37]:[15])){
  const p=fixture();p.instruments=[{name:'Silent routing',color:'#4488aa'}, {name:'Audible',color:'#abcdef',...role}];
  p.notes=Array.from({length:routeCount},(_,i)=>n(i+1,0,16,60,{volume:0}));
  p.notes.push(n(routeCount+1,0,16,role.isDrum?38:100,{instrument:1}));
  if(role.isDrum||role.ms2Drum){p.instruments[0]={...p.instruments[0],isDrum:true};}
  const routed=await render(p),solo={...p,notes:[{...p.notes.at(-1),instrument:0}],instruments:[p.instruments[1]]};
  const reference=await render(solo);
  assert.ok(reference>.0001);assert.ok(Math.abs(routed-reference)<reference*.001,'Extra ports must sound like the same preset on the first port: '+JSON.stringify(role));
 }
});
