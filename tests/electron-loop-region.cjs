// Native check of the rehearsal loop: shift-dragging the ruler marks a stretch, and
// playback comes round at its end instead of running past it.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
fs.mkdirSync('.validation',{recursive:true});
const profile=fs.mkdtempSync(path.resolve('.validation/loop-region-'));
app.setPath('userData',profile);app.disableHardwareAcceleration();
let started=false,stage='startup';const checks=[];const timer=setTimeout(()=>finish(Error('Timed out: '+stage)),45000);
function finish(error){clearTimeout(timer);fs.writeFileSync('.validation/electron-loop-region.json',JSON.stringify({passed:!error,error:error?.stack,stage,checks},null,2));app.exit(error?1:0);}
app.on('browser-window-created',(_,win)=>{if(started)return;started=true;win.webContents.once('did-finish-load',async()=>{try{
 const evaluate=code=>{stage=code;return win.webContents.executeJavaScript(code,true);};
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/commands.js'),import('./dist/playback/transport.js'),import('./dist/playback/loop-region.js')]).then(([{state},{refresh},transport,loop])=>{
  window.s=state;window.refresh=refresh;window.transport=transport;window.loop=loop;
  s.project.instruments=[{name:'Piano',color:'#ff9c33',midiProgram:0}];
  s.project.notes=[{id:1,instrument:0,start:0,length:2048,pitch:60,volume:9}];
  s.project.grid=4;s.zoom=3;s.active=0;refresh();document.getElementById('view').scrollLeft=0;
 })`);
 await evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);

 // Shift-dragging the bar numbers marks the stretch; a plain drag still moves the playhead.
 const box=await evaluate(`(()=>{const r=document.getElementById('canvas').getBoundingClientRect();return {left:Math.round(r.left),top:Math.round(r.top)};})()`);
 const atTick=tick=>box.left+62+Math.round(tick*3);
 const rulerY=box.top+12;
 const drag=async(from,to,modifiers)=>{
  win.webContents.sendInputEvent({type:'mouseMove',x:from,y:rulerY,modifiers});
  win.webContents.sendInputEvent({type:'mouseDown',x:from,y:rulerY,button:'left',clickCount:1,modifiers});
  for(const x of [from+(to-from)/2,to])win.webContents.sendInputEvent({type:'mouseMove',x:Math.round(x),y:rulerY,button:'left',modifiers:[...modifiers,'leftButtonDown']});
  win.webContents.sendInputEvent({type:'mouseUp',x:to,y:rulerY,button:'left',clickCount:1,modifiers});
  await evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
 };
 await drag(atTick(64),atTick(128),['shift']);
 let region=await evaluate(`({start:loop.loopRegion.start,end:loop.loopRegion.end,on:loop.loopRegion.on})`);
 assert.deepEqual(region,{start:64,end:128,on:true},'Shift-drag marks the stretch, snapped to the grid');
 assert.equal(await evaluate(`!!document.getElementById('loop-toggle')`),false,'The loop is worked by keys, not by a button in the transport');
 checks.push({markedByDrag:region});

 // Grabbing an end needs no key, and moves that end alone.
 await drag(atTick(128),atTick(192),[]);
 region=await evaluate(`({start:loop.loopRegion.start,end:loop.loopRegion.end})`);
 assert.deepEqual(region,{start:64,end:192},'The end can be dragged wider without a modifier');
 assert.equal(await evaluate(`transport.playback.tick`),null,'Dragging an end does not move the playhead');
 checks.push({widenedEnd:region});

 // The ends are free: a loop that starts between two cells stays between them.
 await drag(atTick(70),atTick(138),['shift']);
 assert.deepEqual(await evaluate(`[loop.loopRegion.start,loop.loopRegion.end]`),[70,138],`A shift-drag lands on the exact ticks, not on the grid`);
 checks.push({freeDrag:[70,138]});

 // B and N trim the loop at the playhead, the way a work area is trimmed in a video editor.
 const key=(code,modifiers=[])=>{
  win.webContents.sendInputEvent({type:'keyDown',keyCode:code,modifiers});
  win.webContents.sendInputEvent({type:'char',keyCode:code,modifiers});
  win.webContents.sendInputEvent({type:'keyUp',keyCode:code,modifiers});
  return evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
 };
 await evaluate(`transport.seekToTick(96)`);await key('b');
 assert.equal(await evaluate(`loop.loopRegion.start`),96,'B marks the start at the playhead');
 await evaluate(`transport.seekToTick(224)`);await key('n');
 assert.deepEqual(await evaluate(`[loop.loopRegion.start,loop.loopRegion.end]`),[96,224],'N marks the end and keeps the start');
 checks.push({markedByKeys:[96,224]});

 // The grid is an action now, not a mode: draw where you like, then ask for it with G.
 assert.equal(await evaluate(`!!document.getElementById('snap-grid')`),false,'the magnet button is gone');
 await evaluate(`loop.setLoopRegion(70,138)`);
 await key('g');
 assert.deepEqual(await evaluate(`[loop.loopRegion.start,loop.loopRegion.end]`),[64,128],'G puts both ends onto the current grid');
 await evaluate(`s.project.grid=2;loop.setLoopRegion(70,138)`);await key('g');
 assert.deepEqual(await evaluate(`[loop.loopRegion.start,loop.loopRegion.end]`),[64,128],'it follows the grid the project is set to');
 await evaluate(`s.project.grid=4;loop.clearLoopRegion()`);await key('g');
 assert.equal(await evaluate(`loop.loopSpan()`),0,'with nothing marked G does nothing');
 checks.push({alignedByKey:[64,128]});

 // A plain drag away from the ends is still a scrub.
 await drag(atTick(220),atTick(240),[]);
 assert.ok(await evaluate(`transport.playback.tick`)>0,'A plain ruler drag still moves the playhead');
 await evaluate(`loop.setLoopRegion(64,128)`);

 // Playing comes round: the playhead stays inside and turns back at least once.
 await evaluate(`transport.play()`);await wait(300);
 const samples=[];
 for(let i=0;i<26;i++){await wait(100);samples.push(await evaluate(`transport.playback.tick`));}
 await evaluate(`transport.stopPlayback(false)`);
 const inside=samples.filter(t=>t!==null);
 checks.push({samples:inside});

 // With the editor behind another window Chromium stops painting it, so the frame callback
 // stops too. The loop has to come round on the sequencer clock alone: the frame callback is
 // taken away here and the audio position must still stay inside the loop.
 await evaluate(`loop.setLoopRegion(64,128);transport.seekToTick(64);transport.play()`);await wait(500);
 await evaluate(`window.__raf=window.requestAnimationFrame;window.requestAnimationFrame=()=>0;true`);
 const heard=()=>evaluate(`import('./dist/playback/engine.js').then(e=>e.getEngine()).then(g=>g.seq.currentHighResolutionTime)`);
 const times=[];for(let i=0;i<18;i++){await wait(150);times.push(await heard());}
 await evaluate(`window.requestAnimationFrame=window.__raf;transport.stopPlayback(false)`);
 // 120 BPM: the loop covers 1.0s to 2.0s of the performance, so nothing may reach 2.2s.
 checks.push({unpaintedSeconds:times.map(s=>+s.toFixed(2))});
 assert.ok(times.every(s=>s<2.2),`The loop held with no frames painted: ${JSON.stringify(times)}`);
 assert.ok(times.some(s=>s<1.4),`The clock was taken back to the loop start: ${JSON.stringify(times)}`);
 assert.ok(inside.length>20,`Playback kept running (${inside.length} samples)`);
 assert.ok(inside.every(t=>t>=64&&t<=132),`Every position stayed inside the loop: ${JSON.stringify(inside)}`);
 assert.ok(inside.some((t,i)=>i>0&&t<inside[i-1]),'The playhead turned back at the end of the loop');

 // Reported: a loop drawn past the end of the music froze after one turn, with the last
 // notes left sounding. The sequencer had finished the song, and putting its clock back is
 // not enough on its own - it has to be told to play again.
 await evaluate(`s.project.notes=[{id:1,instrument:0,start:0,length:160,pitch:60,volume:9}];refresh();loop.setLoopRegion(0,1024);transport.seekToTick(0);transport.play()`);
 const past=[];for(let i=0;i<70;i++){await wait(80);past.push(await evaluate(`transport.playback.tick`));}
 await evaluate(`transport.stopPlayback(false)`);
 const moving=past.filter(t=>t!==null);
 checks.push({pastTheEnd:moving.filter((t,i)=>i%9===0)});
 assert.ok(moving.some((t,i)=>i>0&&t<moving[i-1]),`The loop came round: ${JSON.stringify(moving.slice(0,20))}`);
 assert.ok(new Set(moving.map(t=>Math.round(t))).size>20,`Playback kept moving instead of freezing: ${JSON.stringify(moving.slice(0,20))}`);

 // Back to the long note and the short loop for the checks that follow.
 await evaluate(`s.project.notes=[{id:1,instrument:0,start:0,length:2048,pitch:60,volume:9}];refresh();loop.setLoopRegion(64,128)`);

 // Switched off with L, the marks stay and playback is free to run past them.
 await key('l');
 assert.equal(await evaluate(`loop.looping()`),false);
 assert.deepEqual(await evaluate(`[loop.loopRegion.start,loop.loopRegion.end]`),[64,128],'Switching off keeps the marks');
 await evaluate(`transport.seekToTick(120);transport.play()`);await wait(1200);
 const free=await evaluate(`transport.playback.tick`);await evaluate(`transport.stopPlayback(false)`);
 assert.ok(free>140,`With the loop off playback runs past the end (${free})`);
 checks.push({loopOffTick:free});

 fs.writeFileSync('.validation/electron-loop-region.png',(await win.webContents.capturePage()).toPNG());
 stage='completed shift-drag marking, end dragging, scrubbing, looped playback and the off switch';finish();
 }catch(error){finish(error);}});});
require('../main.cjs');
