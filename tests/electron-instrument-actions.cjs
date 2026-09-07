const {app}=require('electron'),fs=require('node:fs'),assert=require('node:assert/strict');
fs.mkdirSync('.validation',{recursive:true});app.setPath('userData',require('node:path').resolve(fs.mkdtempSync('.validation/instrument-test-')));
let stage='startup';const timer=setTimeout(()=>finish(Error('Timed out: '+stage)),30000);let started=false;
function finish(error){clearTimeout(timer);fs.mkdirSync('.validation',{recursive:true});fs.writeFileSync('.validation/electron-instrument-actions.json',JSON.stringify({passed:!error,error:error?String(error.stack):undefined},null,2));app.exit(error?1:0);}
app.on('browser-window-created',(_,win)=>{if(started)return;started=true;win.webContents.once('did-finish-load',async()=>{try{
 const evaluate=code=>{stage=code;return win.webContents.executeJavaScript(code,true);};
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/commands.js')]).then(([{state,instrumentView},{refresh}])=>{
 window.s=state;window.prefs=instrumentView;window.refresh=refresh;window.approve=false;window.confirm=message=>{window.confirmation=message;return window.approve;};
 s.project.instruments=[{name:'Grand Piano',color:'#F4A34E',midiProgram:0},{name:'Strings',color:'#65BFDC',midiProgram:48},{name:'Instructions',color:'#f4d35e',isInstructions:true}];
 s.project.notes=[{id:1,instrument:0,start:0,length:32,pitch:60,volume:10,tempo:120},{id:2,instrument:1,start:32,length:32,pitch:64,volume:null},{id:3,instrument:2,start:64,length:1,pitch:60,volume:0,tempo:90}];refresh();
 })`);
 const before=await evaluate('JSON.stringify(s.project)');
 await evaluate(`s.selection=new Set([1]);document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'c',ctrlKey:true,bubbles:true}));document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'v',ctrlKey:true,bubbles:true}));`);
 assert.deepEqual(await evaluate('[s.project.notes.length,s.project.notes.at(-1).start,s.selection.has(s.project.notes.at(-1).id)]'),[4,32,true],await evaluate('document.getElementById("status").textContent'));
 await evaluate(`document.getElementById('undo').click()`);assert.equal(await evaluate('JSON.stringify(s.project)'),before);
 await evaluate(`document.querySelector('.instrument-row-delete').click()`);assert.equal(await evaluate('JSON.stringify(s.project)'),before);
 assert.match(await evaluate('confirmation'),/global tempo/);
 assert.equal(await evaluate(`document.querySelectorAll('.instrument-destination')[2].disabled`),true);
 await evaluate(`document.querySelector('.instrument-name').click()`);
 assert.equal(await evaluate(`getComputedStyle(document.querySelector('.instrument-actions')).display`),'none');
 await evaluate(`document.querySelector('.instrument-name').click();prefs.muted.add(1);prefs.collapsed.add(2);refresh();
 const select=document.querySelector('.instrument-destination');select.value='1';select.dispatchEvent(new Event('change'));`);
 assert.equal(await evaluate(`document.querySelector('.instrument-actions button').disabled`),false);
 await evaluate(`approve=true;document.querySelector('.instrument-actions button').click()`);
 assert.deepEqual(await evaluate('[s.project.instruments.length,s.project.notes.length,s.active,prefs.muted.has(0),prefs.collapsed.has(1)]'),[2,3,0,true,true]);
 assert.equal(await evaluate(`s.project.notes.find(n=>n.id===3).tempo`),90);
 await evaluate(`document.getElementById('undo').click()`);assert.equal(await evaluate('JSON.stringify(s.project)'),before);
 await evaluate(`document.getElementById('redo').click();document.querySelector('.instrument-row-delete').click()`);
 assert.deepEqual(await evaluate('[s.project.instruments.length,s.project.notes.length,s.project.notes[0].instrument]'),[1,1,0]);
 await evaluate(`document.querySelector('.instrument-row-delete').click()`);
 assert.deepEqual(await evaluate('[s.project.instruments.length,s.project.notes.length,s.active]'),[1,0,0]);
 await evaluate(`document.getElementById('undo').click();document.getElementById('undo').click();document.getElementById('undo').click();`);
 assert.equal(await evaluate('JSON.stringify(s.project)'),before);
 win.setSize(1100,800);
 await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
 assert.equal(await evaluate(`document.querySelector('aside').scrollWidth<=document.querySelector('aside').clientWidth`),true);
 fs.mkdirSync('.validation',{recursive:true});fs.writeFileSync('.validation/electron-instrument-actions.png',(await win.webContents.capturePage()).toPNG());
 finish();
 }catch(error){finish(error);}});});require('../main.cjs');

