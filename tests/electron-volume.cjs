// Native DOM + real compiler regression; no physical-speaker claim.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
fs.mkdirSync('.validation',{recursive:true});app.setPath('userData',fs.mkdtempSync(path.resolve('.validation/volume-')));app.disableHardwareAcceleration();
let started=false;const checks=[];const timer=setTimeout(()=>finish(Error('Native volume test timed out')),30000);
function finish(error){clearTimeout(timer);fs.writeFileSync('.validation/electron-volume.json',JSON.stringify({passed:!error,error:error?.stack,checks},null,2));app.exit(error?1:0);}
app.on('browser-window-created',(_,win)=>{if(started)return;started=true;win.webContents.once('did-finish-load',async()=>{try{
 const evaluate=code=>win.webContents.executeJavaScript(code,true);
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/commands.js'),import('./dist/playback/midi.js'),import('./dist/import/smf.js'),import('./dist/note-clipboard.js'),import('./dist/history.js')]).then(([{state,resetInstrumentView},commands,midi,smf,clipboard,history])=>{window.s=state;window.commands=commands;window.midi=midi;window.smf=smf;window.clip=clipboard;window.historyApi=history;resetInstrumentView();s.project={format:'mml-studio',version:2,grid:4,name:'Volume verification',instruments:[{name:'Piano',color:'#ffaa33',midiProgram:0}],notes:[{id:1,instrument:0,start:0,length:128,pitch:60,volume:13},{id:2,instrument:0,start:0,length:128,pitch:64,volume:5},{id:3,instrument:0,start:32,length:16,pitch:67,volume:null}]};s.active=0;s.selection=new Set([1]);commands.refresh();})`);
 assert.equal(await evaluate(`document.getElementById('volume').value`),'13');assert.match(await evaluate(`document.getElementById('info').textContent`),/effective V13/);
 const velocities=await evaluate(`smf.readSMF(new Uint8Array(midi.compilePlayback(s.project).binary)).events.filter(e=>(e.status>>4)===9).map(e=>[e.tick,e.data[0],e.data[1]])`);
 assert.deepEqual(velocities,[[0,60,110],[0,64,42],[32,67,42]]);checks.push({velocities});
 await evaluate(`const v=document.getElementById('volume');v.value='12';v.dispatchEvent(new Event('change'))`);
 assert.match(await evaluate(`document.getElementById('info').textContent`),/effective V12/);
 await evaluate(`historyApi.undo();s.selection=new Set([1,2]);commands.refresh();clip.copyNotes();clip.setPastePosition(160);clip.pasteNotes()`);
 assert.deepEqual(await evaluate(`s.project.notes.slice(-2).map(n=>n.volume)`),[13,5]);
 await evaluate(`historyApi.undo();s.selection=new Set([1]);commands.refresh();new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
 assert.equal(await evaluate(`s.project.notes.length`),3);checks.push('Inspector change, Undo and clipboard preserve distinct chord volumes');
 fs.writeFileSync('.validation/electron-volume.png',(await win.webContents.capturePage()).toPNG());finish();
 }catch(error){finish(error);}});});require('../main.cjs');
