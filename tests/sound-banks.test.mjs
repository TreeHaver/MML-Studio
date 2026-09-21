import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SoundBankLoader} from 'spessasynth_core';
import banks from '../sound-banks.cjs';
import {fresh} from '../dist/model/project.js';
import {compilePlayback,heldPlaybackNotes} from '../dist/playback/midi.js';
import {renderAudio} from '../dist/audio/render.js';
import {mappedDrums} from '../dist/playback/drums.js';
import {readSMF} from '../dist/import/smf.js';
import {overridePrograms} from '../dist/playback/sample-pitch.js';
import {filterSoundBank,prepareSoundBank} from '../dist/audio/sound-bank.js';

test('bank discovery accepts only local bank IDs',async()=>{
 assert.ok((await banks.listSoundBanks()).some(b=>b.id==='TimGM6mb.sf2'));
 for(const id of ['../package.json','C:\\bank.dls',null,{},'missing.dls'])await assert.rejects(banks.soundBankPath(id),/unavailable/);
 assert.match(await banks.soundBankPath(),/TimGM6mb.sf2$/);
});
test('custom bank playback and held notes retain original pitches',()=>{
 const p=fresh();p.notes=[{id:1,instrument:0,start:0,length:32,pitch:109,volume:8}];
 const original=JSON.stringify(p),bundled=compilePlayback(p),custom=compilePlayback(p,0,false);
 assert.equal(bundled.channels[0].tuning,12);assert.equal(custom.channels[0].tuning,undefined);
 assert.equal(heldPlaybackNotes(p,bundled.channels,16)[0].pitch,97);
 assert.equal(heldPlaybackNotes(p,custom.channels,16)[0].pitch,109);
 assert.equal(JSON.stringify(p),original);
});
test('DLS bank renders nonzero finite PCM through the offline renderer',async()=>{
 const bytes=fs.readFileSync('assets/TimGM6mb.sf2');
 // A repeatable DLS fixture without redistributing the user's bank.
 const parsed=SoundBankLoader.fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const dls=fs.existsSync('assets/ms2.dls')?fs.readFileSync('assets/ms2.dls'):new Uint8Array(await parsed.writeDLS());
 const buffer=dls.buffer.slice(dls.byteOffset,dls.byteOffset+dls.byteLength);
 assert.equal(SoundBankLoader.fromArrayBuffer(buffer).type,'dls');
 const p=fresh();p.notes=[{id:1,instrument:0,start:0,length:8,pitch:60,volume:8}];
 let peak=0,frames=0;
 const result=await renderAudio({project:p,minimumEnd:0,speed:1,volume:1,muted:[],soundBank:'test.dls'},buffer,async pcm=>{
  for(const value of pcm){assert.ok(Number.isFinite(value));peak=Math.max(peak,Math.abs(value));}frames+=pcm.length/2;
 },()=>{},()=>false,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 assert.ok(peak>.001);assert.ok(frames>0);assert.ok(result.musicSeconds>0);
});

test('partial DLS overrides matching programs while missing melodic and drum programs render identically to GM',async()=>{
 const bytes=fs.readFileSync('assets/TimGM6mb.sf2'),gm=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 const custom=SoundBankLoader.fromArrayBuffer(gm);
 // Keep one melodic voice, mapped to piano, with a distinct name and sound.
 const selected=custom.presets.find(p=>p.program===40&&!p.isDrum&&p.bankMSB===0&&p.bankLSB===0);
 for(const preset of [...custom.presets])if(preset!==selected)custom.deletePreset(preset);
 selected.program=0;selected.name='Override violin';
 const dls=await custom.writeDLS(),parsed=SoundBankLoader.fromArrayBuffer(dls);
 assert.deepEqual(overridePrograms(parsed.presets),[0]);
 const p=fresh();p.notes=[{id:1,instrument:0,start:0,length:8,pitch:109,volume:8}];
 const plan=compilePlayback(p,0,[0]);assert.equal(plan.channels[0].tuning,undefined);
 p.instruments[0].midiProgram=73;
 assert.equal(compilePlayback(p,0,[0]).channels[0].tuning,12,'missing high flute uses TimGM fallback');
 const render=async(layered)=>{const data=[];await renderAudio({project:p,minimumEnd:0,speed:1,volume:1,muted:[]},layered?dls:gm,async pcm=>data.push(...pcm),()=>{},()=>false,layered?gm:undefined);return data;};
 assert.deepEqual(await render(true),await render(false),'missing flute PCM matches bundled GM');
 p.instruments[0].isDrum=true;p.notes[0].pitch=38;
 assert.deepEqual(await render(true),await render(false),'missing drum kit PCM matches bundled GM');
 p.instruments[0].isDrum=false;p.instruments[0].midiProgram=0;p.notes[0].pitch=60;
 assert.notDeepEqual(await render(true),await render(false),'matching piano slot is overridden by violin');
});

test('Maplebeats remaps three drum presets while preserving GM melodic slots',async()=>{
 const buffer=bytes=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 const gm=buffer(fs.readFileSync('assets/TimGM6mb.sf2'));
 const fixture=SoundBankLoader.fromArrayBuffer(gm);
 for(const [index,name] of ['CRASH60B','KICK264','FATSD60A'].entries())fixture.presets.find(p=>p.program===121+index&&!p.isDrum).name=name;
 const source=fs.existsSync('assets/maplebeats-2.dls')?buffer(fs.readFileSync('assets/maplebeats-2.dls')):fixture.writeSF2();
 const untouched=SoundBankLoader.fromArrayBuffer(source);
 const filtered=filterSoundBank(SoundBankLoader.fromArrayBuffer(source),'maplebeats-2.dls');
 assert.equal(filtered.presets.length,untouched.presets.length);
 const expected=untouched.presets.filter(p=>!['CRASH60B','KICK264','FATSD60A'].includes(p.name)).map(p=>p.name);
 assert.deepEqual(filtered.presets.filter(p=>!p.isDrum).map(p=>p.name),expected);
 assert.deepEqual(mappedDrums(filtered.presets),{cymbals:{name:'CRASH60B',program:125,pitch:48},bass:{name:'KICK264',program:126,pitch:36},snare:{name:'FATSD60A',program:127,pitch:38}});
 assert.equal(filterSoundBank(untouched,'other.dls').presets.length,untouched.presets.length);
 const worklet=SoundBankLoader.fromArrayBuffer(prepareSoundBank(new Uint8Array(source),'maplebeats-2.dls'));
 assert.deepEqual(worklet.presets.filter(p=>!p.isDrum).map(p=>p.name),expected);
 assert.deepEqual(mappedDrums(worklet.presets),mappedDrums(filtered.presets));
 const p=fresh();p.notes=[{id:1,instrument:0,start:0,length:8,pitch:60,volume:8}];
 for(const program of [121,122,123]){
  assert.ok(!overridePrograms(filtered.presets).includes(program));
  p.instruments[0].midiProgram=program;
  const render=async(custom)=>{const pcm=[];await renderAudio({project:p,minimumEnd:0,speed:1,volume:1,muted:[],soundBank:custom?'maplebeats-2.dls':'TimGM6mb.sf2'},custom?source:gm,async chunk=>pcm.push(...chunk),()=>{},()=>false,custom?gm:undefined);return pcm;};
  assert.deepEqual(await render(true),await render(false),`slot ${program+1} must use the original GM sound`);
 }
});

test('dedicated Maplebeats drums trigger complete hits independently of written length', {skip:!fs.existsSync('assets/maplebeats-2.dls')},async()=>{
 const buffer=file=>{const b=fs.readFileSync(file);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
 const source=buffer('assets/maplebeats-2.dls'),gm=buffer('assets/TimGM6mb.sf2');
 const bank=filterSoundBank(SoundBankLoader.fromArrayBuffer(source),'maplebeats-2.dls'),overrides=mappedDrums(bank.presets);
 for(const role of ['cymbals','bass','snare']){
  const p=fresh();p.instruments[0].ms2Drum=role;p.notes=[{id:1,instrument:0,start:0,length:1,pitch:90,volume:8}];
  const original=JSON.stringify(p),plan=compilePlayback(p,0,overridePrograms(bank.presets),overrides);
  const events=readSMF(new Uint8Array(plan.binary)).events;
  assert.ok(events.some(e=>(e.status&240)===192&&e.data[0]===overrides[role].program));
  assert.ok(events.some(e=>(e.status&240)===144&&e.data[0]===overrides[role].pitch));
  const off=events.find(e=>(e.status&240)===128);assert.equal(off.tick,1,'release starts one fine MIDI tick after onset, not at written end');
  assert.deepEqual(heldPlaybackNotes(plan.project,plan.channels,.5),[],'seeking inside a written hit does not retrigger it');
  assert.equal(JSON.stringify(p),original);
  const render=async length=>{p.notes[0].length=length;const data=[];await renderAudio({project:p,minimumEnd:0,speed:1,volume:1,muted:[],soundBank:'maplebeats-2.dls'},source,async pcm=>data.push(...pcm),()=>{},()=>false,gm);return data;};
  const short=await render(1),long=await render(128);
  assert.deepEqual(short.slice(0,Math.min(short.length,long.length)),long.slice(0,Math.min(short.length,long.length)),`${role}: one-shot sound must not depend on written duration`);
  const after=short.slice(Math.ceil(.025*88200)).reduce((peak,v)=>Math.max(peak,Math.abs(v)),0);
  assert.ok(after>.0001,`${role}: hit continues beyond the 15.625 ms note`);
  assert.ok(short.length<88200*6,`${role}: looped cymbal must decay instead of hanging`);
 }
});
