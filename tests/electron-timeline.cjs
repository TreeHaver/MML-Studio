// Native renderer/AudioWorklet integration; no physical speaker listening test.
const {app}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve('.validation');fs.mkdirSync(output,{recursive:true});
app.setPath('userData',path.join(fs.mkdtempSync(path.join(output,'timeline-ui-')),'profile'));
const result={checks:[]};
const deadline=setTimeout(()=>finish(Error('Timeline test timed out')),45000);
function finish(error){clearTimeout(deadline);result.passed=!error;if(error)result.error=String(error.stack||error);fs.writeFileSync(path.join(output,'electron-timeline.json'),JSON.stringify(result,null,2));app.exit(error?1:0);}
app.on('browser-window-created',(_,win)=>win.webContents.once('did-finish-load',async()=>{
 try{
  const wc=win.webContents,evaluate=code=>wc.executeJavaScript(code,true),wait=ms=>new Promise(r=>setTimeout(r,ms));
  win.show();
  await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/commands.js'),import('./dist/model/serialization.js')]).then(([{state},{refresh},{parse}])=>{
   state.project.instruments=[{name:'Piano',color:'#77baff'},{name:'Instructions',color:'#f4d35e',isInstructions:true}];
   state.project.notes=[{id:1,instrument:0,start:0,length:2048,pitch:60,volume:8,tempo:100},{id:2,instrument:1,start:128,length:1,pitch:60,volume:0,tempo:90}];
   state.project=parse(JSON.stringify(state.project));state.active=1;refresh();document.getElementById('view').scrollTop=1200;
  })`);
  await wait(200);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('#instruments .instrument')].map(card=>[card.classList.contains('instructions-lane'),card.querySelector('.instrument-name').textContent])`),[[false,'Piano'],[true,'Instructions']]);
  const pixel=await evaluate(`Promise.all([import('./dist/constants.js'),import('./dist/state.js')]).then(([{KEY,HEAD},{state}])=>Array.from(document.getElementById('canvas').getContext('2d').getImageData(Math.round((KEY)*devicePixelRatio),Math.round((HEAD+100)*devicePixelRatio),1,1).data))`);
  assert.deepEqual(pixel,[87,157,255,255]);
  assert.equal(await evaluate(`import('./dist/state.js').then(({state})=>state.project.instruments[1].color)`),'#579dff');
  assert.equal(await evaluate(`Promise.all([import('./dist/rendering/instructions.js'),import('./dist/constants.js'),import('./dist/state.js')]).then(([{instructionCaptionHit},{KEY,HEAD},{state}])=>instructionCaptionHit({x:KEY+128*state.zoom+8,y:HEAD+14})?.id)`),2);
  result.checks.push('Blue note-bound tempo line, retroactively normalized Instructions color and caption hit tested in native canvas');
  fs.writeFileSync(path.join(output,'electron-timeline.png'),(await wc.capturePage()).toPNG());
  await evaluate(`import('./dist/playback/transport.js').then(m=>m.play())`);
  await evaluate(`import('./dist/playback/engine.js').then(async m=>{(await m.getEngine()).seq.currentTime=12;})`);
  await wait(350);
  const position=await evaluate(`import('./dist/playback/transport.js').then(({playback})=>{const v=document.getElementById('view');return {left:v.scrollLeft,top:v.scrollTop,tick:playback.tick,width:v.clientWidth};})`);
  assert.ok(position.left>0);assert.equal(position.top,1200);assert.ok(62+position.tick*3-position.left<position.width);
  await evaluate(`document.getElementById('play').click()`);
  const paused=await evaluate(`document.getElementById('view').scrollLeft`);await wait(200);
  assert.equal(await evaluate(`document.getElementById('view').scrollLeft`),paused);
  await evaluate(`import('./dist/playback/transport.js').then(m=>m.play())`);await wait(150);
  assert.equal(await evaluate(`document.getElementById('view').scrollTop`),1200);
  await evaluate(`document.getElementById('stop').click()`);

  result.checks.push({nativePlaybackFollow:position,pauseAndResume:true});
  await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/commands.js'),import('./dist/playback/transport.js')]).then(([{state},{refresh},transport])=>{state.segment=null;state.project.instruments=[{name:'Piano',color:'#77baff'}];state.project.notes=[{id:1,instrument:0,start:0,length:8320,pitch:60,volume:8}];state.active=0;refresh();transport.seekToTick(64);window.durationRoot=structuredClone(state.project);})`);
  assert.equal(await evaluate(`document.getElementById('playback-time').textContent`),'0:01 / 2:10 · ');
  fs.writeFileSync(path.join(output,'electron-playback-duration.png'),(await wc.capturePage()).toPNG());
  for(const [kind,end,expected] of [['song',4160,'1:05'],['segment',128,'0:02']]){
   await evaluate("Promise.all([import('./dist/segment-session.js'),import('./dist/commands.js'),import('./dist/playback/transport.js')]).then(([session,{refresh},transport])=>{transport.stopPlayback(false);session.enterSegment(window.durationRoot,"+JSON.stringify({kind,name:kind,start:0,end})+");refresh();})");
   assert.equal(await evaluate(`document.getElementById('playback-time').textContent`),'0:00 / '+expected+' · ');
  }
  result.checks.push('Native elapsed/total reads 0:01 / 2:10 at root, 1:05 for Song and 0:02 for Segment');finish();
 }catch(error){finish(error);}
}));
require('../main.cjs');
