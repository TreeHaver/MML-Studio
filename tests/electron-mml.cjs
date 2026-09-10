const {app,BrowserWindow,clipboard}=require('electron'),fs=require('node:fs'),assert=require('node:assert/strict');
fs.mkdirSync('.validation',{recursive:true});app.setPath('userData',require('node:path').resolve(fs.mkdtempSync('.validation/mml-ui-'),'profile'));
const timer=setTimeout(()=>finish(Error('Timed out')),30000);let originalClipboard;
function finish(error){clearTimeout(timer);if(originalClipboard)clipboard.writeBuffer('text/plain',originalClipboard);fs.mkdirSync('.validation',{recursive:true});fs.writeFileSync('.validation/electron-mml.json',JSON.stringify({passed:!error,error:error?String(error.stack):undefined},null,2));app.exit(error?1:0);}
let started=false;
app.on('browser-window-created',(_,win)=>{if(started)return;started=true;win.webContents.once('did-finish-load',async()=>{try{
 const evaluate=code=>win.webContents.executeJavaScript(code,true);
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/commands.js')]).then(([{state},{refresh}])=>{window.testState=state;window.testRefresh=refresh;state.project.notes=Array.from({length:11},(_,i)=>({id:i+1,instrument:0,start:0,length:11,pitch:60+i,volume:i===10?12:null}));refresh();})`);
 assert.match(await evaluate(`document.querySelector('.instrument-flag').getAttribute('data-message')`),/Over 10 Channels/);
 const popupReady=new Promise(resolve=>app.once('browser-window-created',(_,child)=>child.webContents.once('did-finish-load',()=>resolve(child))));
 await evaluate(`document.querySelectorAll('.instrument-mml button')[1].click()`);const popup=await popupReady;
 const inspect=code=>popup.webContents.executeJavaScript(code,true);
 // The ready IPC can arrive just after did-finish-load.
 await inspect(`new Promise(resolve=>{const poll=()=>document.querySelectorAll('[role=tab]').length===11?resolve():setTimeout(poll,20);poll();})`);
 assert.equal(await inspect(`document.querySelectorAll('[role=tab]').length`),11);
 await inspect(`document.querySelectorAll('[role=tab]')[1].click()`);
 const raw=await inspect(`document.getElementById('mml-text').value`);
 originalClipboard=clipboard.readBuffer('text/plain');await inspect(`document.getElementById('mml-copy').click()`);
 await inspect(`new Promise(resolve=>{const poll=()=>document.getElementById('mml-copy-status').textContent?resolve():setTimeout(poll,20);poll();})`);
 assert.equal(clipboard.readText(),raw);
 const initial=await evaluate(`document.querySelector('.instrument-mml small').textContent`);
 await evaluate(`document.querySelector('.instrument-mml input').click();testState.project.notes=testState.project.notes.map(n=>({...n,length:128}));testRefresh();`);
 assert.match(await evaluate(`document.querySelector('.instrument-mml small').textContent`),/Out of date/);
 assert.equal(await inspect(`document.getElementById('mml-text').value`),raw);
 await evaluate(`document.querySelectorAll('.instrument-mml button')[0].click()`);
 assert.doesNotMatch(await evaluate(`document.querySelector('.instrument-mml small').textContent`),/Out of date/);
 assert.notEqual(await inspect(`document.getElementById('mml-text').value`),raw);
 await evaluate(`document.querySelector('.instrument-mml input').click();testState.project.notes=testState.project.notes.slice(0,1);testRefresh();`);
 assert.equal(await inspect(`document.querySelectorAll('[role=tab]').length`),1);
 assert.equal(await inspect(`document.querySelector('[role=tab]').getAttribute('aria-selected')`),'true');
 fs.mkdirSync('.validation',{recursive:true});fs.writeFileSync('.validation/electron-mml.png',(await popup.webContents.capturePage()).toPNG());
 await evaluate(`document.getElementById('new').click()`);
 assert.equal(await inspect(`document.querySelectorAll('[role=tab]').length`),0);
 popup.close();
 await evaluate(`testState.project.instruments=[{name:'Piano',color:'#abcdef'},{name:'Other',color:'#abcdef'}];testState.project.notes=[{id:1,instrument:0,start:600,length:32,pitch:20,volume:8},{id:2,instrument:0,start:600,length:16,pitch:20,volume:8},{id:3,instrument:0,start:700,length:32,pitch:40,volume:8},{id:4,instrument:0,start:700,length:16,pitch:40,volume:8}];testState.active=0;testState.zoom=1;testRefresh();document.getElementById('view').scrollLeft=500;`);
 // Inspect actual canvas draws before any jump; scrolling must retain both lines.
 assert.deepEqual(await evaluate(`import('./dist/painting.js').then(({draw})=>{const ctx=document.getElementById('canvas').getContext('2d'),original=ctx.fillRect,lines=[];ctx.fillRect=function(x,y,w,h){if(this.fillStyle==='#e58a24')lines.push(x);return original.call(this,x,y,w,h)};draw();ctx.fillRect=original;return lines;})`),await evaluate(`import('./dist/constants.js').then(({KEY})=>[KEY+100,KEY+200])`));
 await evaluate(`testState.active=1;testRefresh();window.beforeJump=JSON.stringify([testState.project,testState.history,testState.dirty]);`);
 const box=await evaluate(`(()=>{const r=document.querySelector('.instrument-flag').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
 win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...box});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...box});
 await evaluate(`new Promise(resolve=>setTimeout(resolve,100))`);
 assert.deepEqual(await evaluate(`[testState.active,[...testState.selection]]`),[0,[1,2]]);
 assert.equal(await evaluate(`JSON.stringify([testState.project,testState.history,testState.dirty])===beforeJump`),true);
 assert.equal(await evaluate(`document.getElementById('view').scrollLeft>0&&document.getElementById('view').scrollTop>0`),true);
 fs.writeFileSync('.validation/electron-overlap.png',(await win.webContents.capturePage()).toPNG());
 await evaluate(`document.querySelector('[data-instrument="0"] .instrument-mml input').click();testState.project.notes=testState.project.notes.filter(n=>n.id!==2&&n.id!==4);testRefresh();`);
 assert.equal(await evaluate(`import('./dist/painting.js').then(({draw})=>{const ctx=document.getElementById('canvas').getContext('2d'),original=ctx.fillRect;let lines=0;ctx.fillRect=function(...args){if(this.fillStyle==='#e58a24')lines++;return original.apply(this,args)};draw();ctx.fillRect=original;return lines;})`),0);

 // Real native clicks cycle stacked notes without editing their music.
 await evaluate(`testState.project.instruments=[{name:'Piano',color:'#80adcf'}];testState.project.notes=Array.from({length:12},(_,i)=>({id:i+1,instrument:0,start:32,length:128,pitch:i<3?60:60+i,volume:8}));testState.active=0;testState.selection.clear();testState.tool='select';testState.zoom=3;testRefresh();document.getElementById('view').scrollLeft=0;`);
 await evaluate(`import('./dist/pitch-viewport.js').then(({pitchTop})=>{document.getElementById('view').scrollTop=pitchTop(testState.topPitch,80);})`);
 await evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
 const stackPoint=await evaluate(`import('./dist/geometry.js').then(({rect})=>{const n=rect(testState.project.notes[0]),c=document.getElementById('canvas').getBoundingClientRect();return {x:Math.round(c.left+n.x+20),y:Math.round(c.top+n.y+5)}})`);
 const beforeClicks=await evaluate(`JSON.stringify([testState.project,testState.history,testState.dirty])`);
 for(const id of [3,2,1,3]){win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...stackPoint});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...stackPoint});await evaluate(`new Promise(r=>setTimeout(r,40))`);assert.deepEqual(await evaluate(`[...testState.selection]`),[id]);}
 assert.equal(await evaluate(`JSON.stringify([testState.project,testState.history,testState.dirty])`),beforeClicks);
 const labels=await evaluate(`import('./dist/painting.js').then(({draw})=>{const ctx=document.getElementById('canvas').getContext('2d'),original=ctx.fillText,texts=[];ctx.fillText=function(text,...args){texts.push(text);return original.call(this,text,...args)};draw();ctx.fillText=original;return texts.join(' ');})`);
 assert.match(labels,/Multiple notes start at once/);assert.match(labels,/This area has 12 notes overlapping! The maximum is 10. Simplify chords or shorten held notes!/);
 assert.equal(await evaluate(`import('./dist/model/instructions.js').then(({ensureInstructions})=>testState.project.instruments[ensureInstructions(testState.project)].color)`),'#579dff');
 await evaluate(`testState.project.notes.push({id:13,instrument:1,start:32,length:1,pitch:60,volume:0,tempo:120,section:'Warning area'});testRefresh();`);
 fs.writeFileSync('.validation/electron-warning-captions.png',(await win.webContents.capturePage()).toPNG());

 // Hue-complement rails and temporary selected-note layering in the real renderer.
 await evaluate(`testState.project.instruments=[{name:'Amber',color:'#FF9C33'}];testState.project.notes=[{id:1,instrument:0,start:0,length:128,pitch:60,volume:8},{id:2,instrument:0,start:32,length:32,pitch:60,volume:8}];testState.selection=new Set([1]);testRefresh();`);
 const overlapPaint=await evaluate(`Promise.all([import('./dist/rendering/notes.js'),import('./dist/geometry.js')]).then(([{drawNotes},{rect}])=>{const ctx=document.getElementById('canvas').getContext('2d'),original=ctx.fillRect,fills=[];ctx.fillRect=function(x,y,w,h){fills.push({color:this.fillStyle,x,y,w,h});return original.call(this,x,y,w,h)};drawNotes();ctx.fillRect=original;return {fills,span:rect(testState.project.notes[1])};})`);
 assert.deepEqual(overlapPaint.fills.filter(f=>f.color==='#ff9c33').map(f=>f.w),[95,383]);
 assert.deepEqual(overlapPaint.fills.filter(f=>f.color==='#3396ff').map(f=>[f.x,f.y,f.w,f.h]),[[overlapPaint.span.x,overlapPaint.span.y-3,95,2],[overlapPaint.span.x,overlapPaint.span.y+overlapPaint.span.h+1,95,2]]);
 await evaluate(`import('./dist/painting.js').then(({draw})=>draw())`);
 fs.writeFileSync('.validation/electron-sustained-outline.png',(await win.webContents.capturePage()).toPNG());
 await evaluate(`testState.selection=new Set([2]);testRefresh();`);
 const singleTop=await evaluate(`import('./dist/rendering/notes.js').then(({drawNotes})=>{const ctx=document.getElementById('canvas').getContext('2d'),original=ctx.fillRect,widths=[];ctx.fillRect=function(x,y,w,h){if(this.fillStyle==='#ff9c33')widths.push(w);return original.call(this,x,y,w,h)};drawNotes();ctx.fillRect=original;return widths;})`);
 assert.deepEqual(singleTop,[383,95]);

 await evaluate(`testState.project.notes.push({id:3,instrument:0,start:0,length:128,pitch:61,volume:8},{id:4,instrument:0,start:0,length:128,pitch:59,volume:8});testState.selection=new Set([3]);testRefresh();`);
 const exteriorPixels=await evaluate(`Promise.all([import('./dist/painting.js'),import('./dist/geometry.js')]).then(([{draw},{rect}])=>{draw();const r=rect(testState.project.notes[1]),ctx=document.getElementById('canvas').getContext('2d');return [r.y-2,r.y+r.h+1].map(y=>Array.from(ctx.getImageData(Math.floor((r.x+10)*devicePixelRatio),Math.floor(y*devicePixelRatio),1,1).data));})`);
 assert.deepEqual(exteriorPixels,[[51,150,255,255],[51,150,255,255]]);
 fs.writeFileSync('.validation/electron-sustained-outline.png',(await win.webContents.capturePage()).toPNG());

 // Actual native clicks can select another musical owner, including from Instructions.
 await evaluate(`testState.project.instruments=[{name:'Piano',color:'#FF9C33'},{name:'Flute',color:'#77baff'},{name:'Instructions',color:'#579dff',isInstructions:true}];testState.project.notes=[{id:1,instrument:0,start:0,length:64,pitch:60,volume:8},{id:2,instrument:1,start:128,length:64,pitch:64,volume:8},{id:3,instrument:2,start:128,length:1,pitch:60,volume:0}];testState.active=0;testState.tool='select';testState.selection.clear();testRefresh();`);
 const ownerPoint=await evaluate(`import('./dist/geometry.js').then(({rect})=>{const r=rect(testState.project.notes[1]),c=document.getElementById('canvas').getBoundingClientRect();return {x:Math.round(c.left+r.x+8),y:Math.round(c.top+r.y+5)}})`);
 const ownerData=await evaluate(`JSON.stringify([testState.project,testState.history,testState.dirty])`);
 for(const mode of ['select','draw','spray']){
  if(mode!=='select')await evaluate('testState.active=2;testState.tool='+JSON.stringify(mode)+';testState.selection.clear();testRefresh();');
  win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...ownerPoint});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...ownerPoint});await evaluate(`new Promise(r=>setTimeout(r,40))`);
  assert.deepEqual(await evaluate(`[testState.active,[...testState.selection]]`),[1,[2]]);
  assert.equal(await evaluate(`JSON.stringify([testState.project,testState.history,testState.dirty])`),ownerData);
 }

 // Native promotion and same-gesture group dragging from either selected instrument.
 await evaluate(`testState.active=1;testState.tool='select';testState.selectedInstruments=new Set([0,1]);testState.selection=new Set([1,2]);testRefresh();`);
 const memberPoint=await evaluate(`import('./dist/geometry.js').then(({rect})=>{const r=rect(testState.project.notes[0]),c=document.getElementById('canvas').getBoundingClientRect();return {x:Math.round(c.left+r.x+20),y:Math.round(c.top+r.y+5)}})`);
 win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...memberPoint});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...memberPoint});await evaluate(`new Promise(r=>setTimeout(r,40))`);
 assert.deepEqual(await evaluate(`[testState.active,[...testState.selectedInstruments],[...testState.selection]]`),[0,[1,0],[1,2]]);
 win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...ownerPoint});win.webContents.sendInputEvent({type:'mouseMove',x:ownerPoint.x+96,y:ownerPoint.y});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:ownerPoint.x+96,y:ownerPoint.y});await evaluate(`new Promise(r=>setTimeout(r,40))`);
 assert.deepEqual(await evaluate(`[testState.active,[...testState.selectedInstruments],[...testState.selection]]`),[1,[0,1],[1,2]]);
 assert.deepEqual(await evaluate(`testState.project.notes.slice(0,2).map(n=>[n.instrument,n.start])`),[[0,32],[1,160]]);
 finish();
 }catch(error){finish(error);}});});require('../main.cjs');
