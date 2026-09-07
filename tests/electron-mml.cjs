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
 popup.close();finish();
 }catch(error){finish(error);}});});require('../main.cjs');
