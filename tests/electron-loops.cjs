const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
fs.mkdirSync('.validation',{recursive:true});app.setPath('userData',fs.mkdtempSync(path.resolve('.validation/loops-')));
const timer=setTimeout(()=>finish(Error('Loop UI check timed out')),30000);
function finish(error){clearTimeout(timer);fs.writeFileSync('.validation/electron-loops.json',JSON.stringify({passed:!error,error:error?.stack},null,2));app.exit(error?1:0);}
app.on('browser-window-created',(_,win)=>win.webContents.once('did-finish-load',async()=>{try{
 win.setSize(1450,1000);
 const evaluate=code=>win.webContents.executeJavaScript(code,true);
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/commands.js'),import('./dist/painting.js'),import('./dist/appearance.js')]).then(([{state},commands,painting,appearance])=>{window.s=state;window.commands=commands;window.painting=painting;window.appearance=appearance;
 s.project={format:'mml-studio',version:2,name:'Nested loops',grid:4,instruments:[{name:'Piano',color:'#55a9c8'},{name:'Instructions',color:'#f4d35e',isInstructions:true}],notes:[{id:1,instrument:0,start:0,length:224,pitch:60,volume:8},{id:2,instrument:0,start:64,length:32,pitch:64,volume:8},{id:3,instrument:1,start:32,length:1,pitch:-200,volume:0,loopEntry:true,loopCount:3,section:'Verse',tempo:120},{id:4,instrument:1,start:96,length:1,pitch:300,volume:0,loopEntry:true,loopCount:2},{id:5,instrument:1,start:160,length:1,pitch:300,volume:0,loopExit:true,loopTie:true},{id:6,instrument:1,start:224,length:1,pitch:300,volume:0,loopExit:true,loopTie:true}]};s.active=1;s.selection=new Set([3]);s.zoom=2.5;commands.refresh();document.getElementById('view').scrollLeft=0;document.getElementById('view').scrollTop=980;painting.draw();})`);
 const settle=()=>evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await settle();
 assert.deepEqual(await evaluate(`['pitch-field','length-field','volume-field','loop-count-field','loop-tie-field'].map(id=>getComputedStyle(document.getElementById(id)).display==='none')`),[true,true,true,false,true]);
 const click=async(x,y)=>{const p=await evaluate(`(()=>{const r=document.getElementById('canvas').getBoundingClientRect();return {x:Math.round(r.x+${x}),y:Math.round(r.y+${y})};})()`);win.webContents.sendInputEvent({type:'mouseDown',...p,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...p,button:'left',clickCount:1});await settle();};
 await evaluate('s.active=0;s.selection.clear();commands.refresh();painting.draw()');
 await click(62+96*2.5+5,400);assert.deepEqual(await evaluate('[s.active,[...s.selection][0]]'),[1,4]);
 await evaluate('s.active=0;s.selection.clear();commands.refresh();painting.draw()');
 await click(62+224*2.5+35,44);assert.deepEqual(await evaluate('[s.active,[...s.selection][0]]'),[1,6]);
 assert.deepEqual(await evaluate(`['loop-count-field','loop-tie-field'].map(id=>getComputedStyle(document.getElementById(id)).display==='none')`),[true,false]);
 await evaluate('s.selection=new Set([3]);commands.refresh();painting.draw()');await settle();
 fs.writeFileSync('.validation/electron-loops.png',(await win.webContents.capturePage()).toPNG());
 await evaluate("document.querySelector('[data-theme=night]').click();painting.draw()");await settle();fs.writeFileSync('.validation/electron-loops-night.png',(await win.webContents.capturePage()).toPNG());
 await evaluate(`s.project.notes=s.project.notes.filter(n=>n.id!==6);commands.refresh();painting.draw()`);
 assert.match(await evaluate(`document.getElementById('loop-warning').textContent`),/no Exit/);
 fs.writeFileSync('.validation/electron-loops-unmatched.png',(await win.webContents.capturePage()).toPNG());
 // Native checkbox input, inspector edits and compiler/transport integration for Double Time.
 await evaluate(`s.project.notes=[{id:1,instrument:0,start:0,length:96,pitch:60,volume:8},{id:2,instrument:1,start:0,length:1,pitch:60,volume:0},{id:3,instrument:1,start:64,length:1,pitch:60,volume:0}];s.active=1;s.selection=new Set([2]);commands.refresh();document.getElementById('speed-entry').scrollIntoView();`);await settle();
 const box=await evaluate(`(()=>{const r=document.getElementById('speed-entry').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
 win.webContents.sendInputEvent({type:'mouseDown',...box,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...box,button:'left',clickCount:1});await settle();
 assert.equal(await evaluate('s.project.notes[1].speedEntry'),true);
 assert.equal(await evaluate("document.getElementById('speed-multiplier-field').hidden"),false);
 assert.equal(await evaluate("document.getElementById('playback-bpm').textContent"),'240 BPM');
 await evaluate(`const speed=document.getElementById('speed-multiplier');speed.value='3';speed.dispatchEvent(new Event('change'));`);
 assert.equal(await evaluate('s.project.notes[1].speedMultiplier'),3);
 await evaluate(`import('./dist/history.js').then(h=>h.undo())`);assert.equal(await evaluate('s.project.notes[1].speedMultiplier'),undefined);
 await evaluate(`s.selection=new Set([3]);commands.refresh();const exit=document.getElementById('speed-exit');exit.checked=true;exit.dispatchEvent(new Event('change'));`);
 assert.equal(await evaluate('s.project.notes[2].speedExit'),true);
 const result=await evaluate(`Promise.all([import('./dist/music/mml.js'),import('./dist/playback/midi.js')]).then(([m,p])=>({mml:m.generateMml(s.project,0),map:p.compilePlayback(s.project).map,duration:p.compilePlayback(s.project).duration}))`);
 assert.deepEqual(result.map,[{tick:0,bpm:240},{tick:64,bpm:120}]);assert.equal(result.duration,1);assert.match(result.mml.channels[0],/t120/);assert.doesNotMatch(result.mml.channels[0],/t240/);
 await evaluate('s.selection=new Set([2]);commands.refresh();painting.draw()');await settle();fs.writeFileSync('.validation/electron-speed.png',(await win.webContents.capturePage()).toPNG());
 await evaluate(`import('./dist/segment-session.js').then(v=>{v.enterSegment(s.project,{kind:'segment',name:'Middle',start:32,end:96});s.selection=new Set([s.project.notes.find(n=>n.speedEntry).id]);commands.refresh();})`);
 assert.equal(await evaluate("document.getElementById('speed-multiplier').disabled"),true);
 assert.match(await evaluate("document.getElementById('speed-warning').textContent"),/Inherited multiplier/);
 // A separate automatic Song-start T120 must not reject Tempo on a multiplier.
 await evaluate(`import('./dist/segment-session.js').then(v=>{window.session=v;v.resetSegment();s.project.notes=[{id:1,instrument:0,start:0,length:512,pitch:60,volume:8},{id:2,instrument:1,start:0,length:1,pitch:60,volume:0,section:'Song',resetMeasures:true},{id:3,instrument:1,start:0,length:1,pitch:60,volume:0,speedEntry:true,speedMultiplier:2}];v.enterSegment(s.project,{kind:'song',name:'Song',start:0,end:512});s.selection=new Set([3]);commands.refresh();const tempo=document.getElementById('tempo');tempo.value='90';tempo.dispatchEvent(new Event('change'));})`);
 assert.equal(await evaluate('s.project.notes.find(n=>n.id===3).tempo'),90);
 assert.equal(await evaluate("document.getElementById('playback-bpm').textContent"),'180 BPM');
 assert.equal(await evaluate('session.fullProject().notes.find(n=>n.id===2).tempo'),undefined);
 await evaluate(`import('./dist/history.js').then(h=>h.undo())`);
 assert.equal(await evaluate("document.getElementById('playback-bpm').textContent"),'240 BPM');
 await evaluate(`import('./dist/history.js').then(h=>h.undo(true))`);
 assert.equal(await evaluate("document.getElementById('playback-bpm').textContent"),'180 BPM');
 await evaluate(`import('./dist/playback/transport.js').then(async t=>{window.transport=t;await t.play();})`);
 await new Promise(r=>setTimeout(r,150));const before=await evaluate('({tick:transport.playback.tick,time:performance.now()})');
 await new Promise(r=>setTimeout(r,500));const after=await evaluate('({tick:transport.playback.tick,time:performance.now()})');
 const rate=(after.tick-before.tick)*1000/(after.time-before.time);assert.ok(rate>80&&rate<110,'T90 ×2 runs at 96 ticks/s: '+rate);
 assert.equal(await evaluate("document.getElementById('playback-bpm').textContent"),'180 BPM');
 await evaluate('transport.stopPlayback(false)');
 finish();
 }catch(error){finish(error);}}));
require('../main.cjs');


