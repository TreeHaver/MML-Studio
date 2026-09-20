import test from 'node:test';
import assert from 'node:assert/strict';
import {metronomeBeats,beatIndexAt} from '../dist/playback/metronome.js';
import {tempoMap} from '../dist/music/tempo.js';

// 128 ticks to a whole note, so a quarter-note beat is 32 ticks and, at 120 BPM, half a second.
const BEAT=32;
const piece=(notes,instruments=[{name:'Piano',color:'#abcdef'},{name:'Instructions',color:'#f4d35e',isInstructions:true}])=>
 ({format:'mml-studio',version:2,grid:4,instruments,notes});
const beatsOf=project=>metronomeBeats(project,tempoMap(project.notes),project.notes.reduce((end,n)=>Math.max(end,n.start+n.length),0));

test('four beats to the bar, the first of each one accented', ()=>{
 const beats=beatsOf(piece([{id:1,instrument:0,start:0,length:BEAT*8,pitch:60,volume:8}]));
 assert.equal(beats.length,8);
 assert.deepEqual(beats.map(b=>b.major),[true,false,false,false,true,false,false,false]);
 // 120 BPM by default, so the beats are half a second apart and the bar is two seconds.
 assert.deepEqual(beats.map(b=>Math.round(b.time*1000)),[0,500,1000,1500,2000,2500,3000,3500]);
});

test('a time signature moves the accent, and a later one moves it again', ()=>{
 const beats=beatsOf(piece([
  {id:1,instrument:0,start:0,length:BEAT*12,pitch:60,volume:8},
  {id:2,instrument:1,start:0,length:1,pitch:60,volume:0,timeSignature:'3/4'},
  {id:3,instrument:1,start:BEAT*6,length:1,pitch:60,volume:0,timeSignature:'2/4'},
 ]));
 // Three beats to the bar, then two: accents on 1 and 4, then on every other beat.
 assert.deepEqual(beats.slice(0,6).map(b=>b.major),[true,false,false,true,false,false]);
 assert.deepEqual(beats.slice(6,12).map(b=>b.major),[true,false,true,false,true,false]);
});

test('the click follows the tempo rather than the clock', ()=>{
 const beats=beatsOf(piece([
  {id:1,instrument:0,start:0,length:BEAT*4,pitch:60,volume:8},
  {id:2,instrument:1,start:0,length:1,pitch:60,volume:0,tempo:240},
 ]));
 // Twice the tempo, so a quarter of a second between beats rather than half.
 assert.deepEqual(beats.map(b=>Math.round(b.time*1000)),[0,250,500,750]);
});

test('a piece with no length has no beats to click', ()=>{
 assert.deepEqual(metronomeBeats(piece([]),[],0),[]);
});

test('picking up after a seek lands on the first beat still to come', ()=>{
 const beats=[0,.5,1,1.5,2].map((time,i)=>({time,major:i%4===0}));
 assert.equal(beatIndexAt(beats,0),0);
 assert.equal(beatIndexAt(beats,.5),1,'a beat exactly at the moment is still to be played');
 assert.equal(beatIndexAt(beats,.6),2);
 assert.equal(beatIndexAt(beats,9),beats.length,'past the end there is nothing left to click');
});
