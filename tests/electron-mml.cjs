const {app,BrowserWindow,clipboard}=require('electron'),fs=require('node:fs'),assert=require('node:assert/strict');
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
 assert.deepEqual(await evaluate(`import('./dist/painting.js').then(({draw})=>{const ctx=document.getElementById('canvas').getContext('2d'),original=ctx.fillRect,lines=[];ctx.fillRect=function(x,y,w,h){if(this.fillStyle==='#e5484d')lines.push(x);return original.call(this,x,y,w,h)};draw();ctx.fillRect=original;return lines;})`),await evaluate(`import('./dist/constants.js').then(({KEY})=>[KEY+100,KEY+200])`));
 await evaluate(`testState.active=1;testRefresh();window.beforeJump=JSON.stringify([testState.project,testState.history,testState.dirty]);`);
 const box=await evaluate(`(()=>{const r=document.querySelector('.instrument-flag').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
 win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...box});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...box});
 await evaluate(`new Promise(resolve=>setTimeout(resolve,100))`);
 assert.deepEqual(await evaluate(`[testState.active,[...testState.selection]]`),[0,[1,2]]);
 assert.equal(await evaluate(`JSON.stringify([testState.project,testState.history,testState.dirty])===beforeJump`),true);
 assert.equal(await evaluate(`document.getElementById('view').scrollLeft>0&&document.getElementById('view').scrollTop>0`),true);
 fs.writeFileSync('.validation/electron-overlap.png',(await win.webContents.capturePage()).toPNG());
 await evaluate(`document.querySelector('[data-instrument="0"] .instrument-mml input').click();testState.project.notes=testState.project.notes.filter(n=>n.id!==2&&n.id!==4);testRefresh();`);
 assert.equal(await evaluate(`import('./dist/painting.js').then(({draw})=>{const ctx=document.getElementById('canvas').getContext('2d'),original=ctx.fillRect;let lines=0;ctx.fillRect=function(...args){if(this.fillStyle==='#e5484d')lines++;return original.apply(this,args)};draw();ctx.fillRect=original;return lines;})`),0);
 finish();
 }catch(error){finish(error);}});});require('../main.cjs');
