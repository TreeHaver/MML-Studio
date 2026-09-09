const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {transpile}=require('../transpile.cjs');

test('preview ignores invalid pitches and stale initialization, and reports recoverable errors',async()=>{
 const calls=[],messages=[];let resolveEngine,fail=false;
 const pending=new Promise(resolve=>{resolveEngine=resolve;});
 const context=vm.createContext({});
 const exports={
  './engine.ts':{getPreviewEngine:()=>fail?Promise.reject(Error('device unavailable')):pending},
  '../dom.ts':{status:text=>messages.push(text)},
  '../music/pitch.ts':{name:pitch=>String(pitch)},
  './drums.ts':{drumName:pitch=>`Drum ${pitch}`}
 };
 const module=new vm.SourceTextModule(transpile(fs.readFileSync('src/playback/preview.ts','utf8'),'preview.ts'),{context});
 await module.link(spec=>new vm.SyntheticModule(Object.keys(exports[spec]),function(){for(const [k,v] of Object.entries(exports[spec]))this.setExport(k,v);},{context}));
 await module.evaluate();const preview=module.namespace.previewNote;
 await preview(-1,0);assert.match(messages.pop(),/0–127/);
 const first=preview(60,0),second=preview(64,40);
 resolveEngine({preview:async(...args)=>calls.push(args)});await Promise.all([first,second]);
 assert.deepEqual(calls,[[64,40,false,100]]);
 fail=true;await preview(67,73);assert.match(messages.pop(),/device unavailable/);
 fail=false;await preview(69,73);assert.deepEqual(calls[1],[69,73,false,100]);
 await preview(36,0,true);assert.deepEqual(calls[2],[36,0,true,100]);assert.match(messages.pop(),/Drum 36/);
});

test('preview releases notes, replaces rapid clicks, and uses a synth separate from transport',async()=>{
 const calls=[],timers=new Map(),gains=[];let nextTimer=0,nextSynth=0,contexts=0;
 class Context{constructor(){contexts++;this.currentTime=0;this.destination={};this.audioWorklet={addModule:async()=>{}};}createGain(){const output={context:this,connect(){},gain:{value:1,setTargetAtTime(value){this.value=value}}};gains.push(output);return output;}async resume(){}async close(){}}
 class Synth{
  constructor(){this.id=++nextSynth;this.midiChannels=Array.from({length:16},()=>({setSystemParameter(){}}));this.soundBankManager={addSoundBank:async()=>{}};this.isReady=Promise.resolve();}
  connect(){}stopAll(force){calls.push([this.id,'stop',force]);}
  controllerChange(c,cc,v){calls.push([this.id,'cc',c,cc,v]);}
  programChange(c,p){calls.push([this.id,'program',c,p]);}
  pitchWheelRange(c,r){calls.push([this.id,'range',c,r]);}
  pitchWheel(c,v){calls.push([this.id,'bend',c,v]);}
  noteOn(c,p,v){calls.push([this.id,'on',c,p,v]);}
  noteOff(c,p){calls.push([this.id,'off',c,p]);}
 }
 const context=vm.createContext({AudioContext:Context,URL,Uint8Array,window:{files:{soundBank:async()=>new Uint8Array(4)}},
  setTimeout:(fn,ms)=>{assert.equal(ms,500);timers.set(++nextTimer,fn);return nextTimer;},clearTimeout:id=>timers.delete(id)});
 const lib=new vm.SyntheticModule(['WorkletSynthesizer','Sequencer'],function(){this.setExport('WorkletSynthesizer',Synth);this.setExport('Sequencer',class{});},{context});
 await lib.link(()=>{});await lib.evaluate();
 const engine=new vm.SourceTextModule(transpile(fs.readFileSync('src/playback/engine.ts','utf8'),'engine.ts'),{
  context,initializeImportMeta:meta=>{meta.url='file:///studio/dist/playback/engine.js';},importModuleDynamically:()=>lib
 });const samples=new vm.SourceTextModule(transpile(fs.readFileSync('src/playback/sample-pitch.ts','utf8'),'sample-pitch.ts'),{context});await samples.link(()=>{});await samples.evaluate();await engine.link(()=>samples);await engine.evaluate();
 const preview=await engine.namespace.getPreviewEngine();
 await preview.preview(60,40);await preview.preview(62,73);
 assert.equal(timers.size,1);[...timers.values()][0]();
 assert.deepEqual(calls.filter(c=>!['cc','bend'].includes(c[1])),[[1,'stop',false],[1,'program',0,40],[1,'on',0,60,100],[1,'stop',false],[1,'program',0,73],[1,'on',0,62,100],[1,'off',0,62]]);
 calls.length=0;await preview.preview(109,73);[...timers.values()].at(-1)();
 assert.deepEqual(calls.filter(c=>c[1]!=='cc'),[[1,'stop',false],[1,'bend',0,9741],[1,'program',0,73],[1,'on',0,97,100],[1,'off',0,97]]);assert.ok(calls.some(c=>c[1]==='cc'&&c[3]===6&&c[4]===64));
 calls.length=0;await preview.preview(36,73,true);[...timers.values()].at(-1)();
 assert.deepEqual(calls.filter(c=>c[1]!=='cc'),[[1,'stop',false],[1,'bend',9,8192],[1,'program',9,0],[1,'on',9,36,100],[1,'off',9,36]]);
 await engine.namespace.getEngine();assert.equal(nextSynth,2);assert.equal(contexts,2);
 engine.namespace.setMasterVolume(.35);assert.deepEqual(gains.map(g=>g.gain.value),[.35,.35]);
 engine.namespace.setMasterVolume(0);assert.deepEqual(gains.map(g=>g.gain.value),[0,0]);
 assert.equal(await engine.namespace.getPreviewEngine(),preview);
});
