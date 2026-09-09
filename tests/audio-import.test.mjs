import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {importAudio,isAudioFile,audioSampling,estimateAudioCharacters} from '../dist/import/audio.js';
import {generateMml} from '../dist/music/mml.js';
import {createSheetPlanner} from '../dist/music/sheets.js';
import {tempoMap,secondsAtTick} from '../dist/music/tempo.js';
import {parse} from '../dist/model/serialization.js';
import {compilePlayback} from '../dist/playback/midi.js';
const require=createRequire(import.meta.url),{decodeAudio}=require('../audio-import.cjs');
const rate=16000;
function tone(seconds,frequencies=[440],gain=()=>0.2){return Float32Array.from({length:Math.round(seconds*rate)},(_,i)=>frequencies.reduce((v,f)=>v+Math.sin(2*Math.PI*f*i/rate)*gain(i/rate),0));}
function wav(samples){
 const bytes=Buffer.alloc(44+samples.length*2);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(samples.length*2,40);
 samples.forEach((s,i)=>bytes.writeInt16LE(Math.round(Math.max(-1,Math.min(1,s))*32767),44+i*2));return bytes;
}
// Read actual exported channel clocks independently of the editor's tempo helpers.
function channelSeconds(text){
 let bpm=120,denominator=4,defaultDot=1,time=0;
 const tokens=text.match(/[tov]-?\d+|l\d+\.?|[a-gr][+-]?\d*\.?|&/g)??[];assert.equal(tokens.join(''),text);
 for(const token of tokens){
  if(token[0]==='t')bpm=Number(token.slice(1));
  else if(token[0]==='l'){denominator=parseInt(token.slice(1));defaultDot=token.endsWith('.')?1.5:1;}
  else if(/^[a-gr]/.test(token)){const explicit=token.match(/\d+/);time+=240/bpm/(explicit?Number(explicit[0]):denominator)*(token.endsWith('.')?1.5:explicit?1:defaultDot);}
 }
 return time;
}

test('audio decoding uses bundled FFmpeg, preserves samples, and reports malformed/missing input',async()=>{
 const source=tone(0.303),decoded=await decodeAudio(wav(source));
 assert.equal(decoded.sampleRate,rate);assert.equal(decoded.samples.length,source.length);
 assert.ok(Math.max(...decoded.samples.map((s,i)=>Math.abs(s-source[i])))<0.00005);
 await assert.rejects(decodeAudio(Buffer.from('bad audio')),/Could not decode audio/);
 await assert.rejects(decodeAudio(new Uint8Array()),/empty/);
 await assert.rejects(decodeAudio(wav(source),{encoder:'missing-voice-encoder.exe'}),/bundled FFmpeg is missing/);
});
test('five simultaneous spectral tones recover pitches and exact 30 ms T250 ×4 timing',()=>{
 const pitches=[48,55,64,76,88],frequencies=pitches.map(p=>440*2**((p-69)/12));
 const {project,warnings}=importAudio(tone(2.01,frequencies,()=>0.1),rate,'test.wav');
 assert.deepEqual(parse(JSON.stringify(project)),project);
 const notes=project.notes.filter(n=>n.instrument===0),middle=notes.filter(n=>n.start<=320&&n.start+n.length>320);
 assert.deepEqual(middle.map(n=>n.pitch).sort((a,b)=>a-b),pitches);
 assert.equal(project.notes.find(n=>n.speedEntry).tempo,250);assert.equal(project.notes.find(n=>n.speedEntry).speedMultiplier,4);
 const end=Math.max(...notes.filter(n=>n.volume>0).map(n=>n.start+n.length));assert.ok(Math.abs(secondsAtTick(tempoMap(project.notes),end)-3.01)<1e-9);
 for(const n of notes){assert.ok(Number.isInteger(n.start)&&Number.isInteger(n.length));assert.equal((n.start-128)%16,0);}
 const mml=generateMml(project,0);assert.equal(mml.channels.length,5);assert.ok(mml.bytes<10000);
 const durations=mml.channels.map(channelSeconds);assert.ok(Math.abs(durations.reduce((a,b)=>a+b,0)-20)<0.002);
 assert.equal(mml.channels.filter(c=>/r\d*\.?$/.test(c)).length,1);
 assert.ok(mml.channels.every(c=>!c.includes('v0')),'padding is exported as rests');
 assert.equal(notes.filter(n=>n.volume===0).length,1);assert.equal(durations.filter(t=>t>3.01+1e-8).length,1);
 assert.equal(Math.min(...notes.map(n=>n.start)),128);assert.ok(Math.max(...durations)<60);
 assert.ok(mml.channels.every(c=>c.startsWith('t240')));assert.ok(!mml.channels.some(c=>/t1000/.test(c)));
 assert.ok(warnings.some(w=>w.includes(mml.bytes.toLocaleString('en-US')+' characters')));
 assert.ok(notes.length<167*5/2,'stable frames merged');
});
test('clip-relative velocity retains quiet syllables, gaps and trailing silence',()=>{
 const source=tone(1.2,[440],t=>t<0.3?0.6:t<0.6?0.06:0);
 const {project}=importAudio(source,rate,'quiet.wav'),notes=project.notes.filter(n=>n.instrument===0&&n.volume>0);
 const loud=notes.find(n=>n.start<=192&&n.start+n.length>192),quiet=notes.find(n=>n.start<=368&&n.start+n.length>368);
 assert.equal(loud.pitch,69);assert.equal(quiet.pitch,69);assert.ok(loud.volume>quiet.volume+3);
 const planner=createSheetPlanner(project,0,10000),durations=planner.whole.channels.map(channelSeconds);
 assert.ok(Math.abs(durations.reduce((a,b)=>a+b,0)-20)<0.002);
 assert.ok(project.notes.some(n=>n.instrument===0&&n.volume===0&&n.start+n.length===planner.end));
 const plan=compilePlayback(project);assert.ok(Math.abs(plan.duration-Math.max(...durations))<1e-8);
 assert.ok(notes.every(n=>n.start>=128&&n.start<448),'silence does not generate tones');
});
test('short final frame uses sub-1/128 export lengths without fractional editor units',()=>{
 const {project}=importAudio(tone(0.03375),rate,'short.wav');
 const end=Math.max(...project.notes.filter(n=>n.instrument===0&&n.volume>0).map(n=>n.start+n.length));assert.equal(end,146);
 assert.ok(Math.abs(secondsAtTick(tempoMap(project.notes),end)-1.03375)<1e-9);
 assert.match(generateMml(project,0).channels.join(''),/256/);
});
test('10-second changing audio remains intact and reports its actual export size',()=>{
 let seed=17;const samples=Float32Array.from({length:rate*10},()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed/2**32-0.5)*0.4;});
 const {project,warnings}=importAudio(samples,rate,'noise.wav'),mml=generateMml(project,0);
 assert.ok(mml.channels.length<=5);const audibleEnd=Math.max(...project.notes.filter(n=>n.instrument===0&&n.volume>0).map(n=>n.start+n.length));assert.ok(Math.abs(secondsAtTick(tempoMap(project.notes),audibleEnd)-11)<=0.000938);
 assert.ok(mml.channels.map(channelSeconds).reduce((a,b)=>a+b,0)>=20-1e-8);
 assert.ok(warnings.some(w=>w.includes(mml.bytes.toLocaleString('en-US')+' characters')));
 const parts=createSheetPlanner(project,0,10000).split();assert.ok(parts.every(p=>p.bytes<=10000));
 if(mml.bytes>10000)assert.ok(warnings.some(w=>w.includes('exceeds one sheet')));
});
test('clips already above 20 seconds of combined channel time get no extra tail',()=>{
 const {project}=importAudio(tone(15,[220,440,660,1100,1760],()=>0.1),rate,'long.wav');
 assert.equal(project.notes.filter(n=>n.instrument===0&&n.volume===0).length,0);
 assert.ok(Math.abs(compilePlayback(project).duration-16)<1e-8);
 assert.ok(generateMml(project,0).channels.map(channelSeconds).reduce((a,b)=>a+b,0)>60);
});
test('silence, invalid PCM, and unsupported sample rates fail clearly',()=>{
 assert.throws(()=>importAudio(new Float32Array(rate),rate,'silence.wav'),/No audible/);
 assert.throws(()=>importAudio(new Float32Array([NaN]),rate,'bad.wav'),/invalid samples/);
 assert.throws(()=>importAudio(tone(0.1),44100,'bad.wav'),/16 kHz/);
 assert.ok(isAudioFile('VOICE.M4A'));assert.ok(!isAudioFile('voice.mml'));
});
test('sample interval drives analysis timing and the duration-based budget estimate',()=>{
 assert.equal(estimateAudioCharacters(10,30).characters,10620);
 assert.ok(estimateAudioCharacters(10,15).characters>estimateAudioCharacters(10,30).characters);
 assert.ok(estimateAudioCharacters(5,30).characters<estimateAudioCharacters(10,30).characters);
 assert.equal(audioSampling(10).intervalMs,9.375);
 for(const value of [0,NaN,Infinity,1])assert.throws(()=>audioSampling(value),/sample interval/);
 const source=tone(0.6,[440],t=>0.2+0.1*Math.sin(t*80));
 for(const interval of [15,30,45,10]){
  const plan=audioSampling(interval),song=importAudio(source,rate,'rate.wav',interval,100);
  const notes=song.project.notes.filter(n=>n.instrument===0&&n.volume>0);
  assert.ok(notes.every(n=>(n.start-128)%plan.ticks===0));
  assert.ok(Math.abs(1+(Math.max(...notes.map(n=>n.start+n.length))-128)*0.001875-1.6)<1e-9);
  assert.ok(song.warnings.some(w=>w.includes(`${plan.intervalMs} ms analysis steps`)));
  assert.ok(song.warnings.some(w=>w.includes('100-character budget')));
 }
});
test('voice count controls spectral polyphony and estimated cost',()=>{
 const frequencies=Array.from({length:9},(_,i)=>220*2**(i/3)),source=tone(0.6,frequencies,()=>0.06);
 for(const voices of [1,3,5,8,12]){
  const {project,warnings}=importAudio(source,rate,'voices.wav',30,10000,voices);
  const middle=project.notes.filter(n=>n.instrument===0&&n.volume>0&&n.start<=288&&n.start+n.length>288);
  assert.equal(middle.length,Math.min(voices,9));assert.ok(generateMml(project,0).channels.length<=voices);
  assert.ok(warnings.some(w=>w.includes(`up to ${voices} simultaneous tones`)));
  assert.equal(estimateAudioCharacters(10,30,voices).characters,334*voices*6+600);
 }
 for(const voices of [0,-1,1.5,NaN,Infinity]){
  assert.throws(()=>estimateAudioCharacters(10,30,voices),/whole number of voices/);
  assert.throws(()=>importAudio(source,rate,'bad.wav',30,10000,voices),/whole number of voices/);
 }
});
