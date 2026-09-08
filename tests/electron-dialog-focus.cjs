// Native renderer input and IPC; OS dialogs are stubbed and deliberately blur
// the window to reproduce the missing focus handoff after modal dialogs.
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
fs.mkdirSync('.validation',{recursive:true});const root=fs.mkdtempSync(path.resolve('.validation/dialog-focus-'));app.setPath('userData',path.join(root,'profile'));app.disableHardwareAcceleration();
const fixture=path.join(root,'Focus test.mml');fs.writeFileSync(fixture,'t120o4c4d4');
let selection=null,answer=1,started=false,checks=[];const timer=setTimeout(()=>finish(Error('Focus test timed out')),30000);
function finish(error){clearTimeout(timer);fs.writeFileSync('.validation/electron-dialog-focus.json',JSON.stringify({passed:!error,error:error?.stack,checks},null,2));app.exit(error?1:0);}
const blur=win=>{win.blur();};
dialog.showOpenDialog=async win=>{blur(win);return selection?{canceled:false,filePaths:[selection]}:{canceled:true,filePaths:[]};};
dialog.showSaveDialog=async win=>{blur(win);return {canceled:true};};
dialog.showMessageBoxSync=win=>{blur(win);return answer;};
app.on('browser-window-created',(_,win)=>{if(started)return;started=true;win.webContents.once('did-finish-load',async()=>{try{
 const wc=win.webContents,run=code=>wc.executeJavaScript(code,true),settle=()=>new Promise(r=>setTimeout(r,60));
 const type=async(id,text)=>{
  const {x,y}=await run(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
  wc.sendInputEvent({type:'mouseDown',x,y,button:'left',clickCount:1});wc.sendInputEvent({type:'mouseUp',x,y,button:'left',clickCount:1});await settle();
  assert.equal(await run('document.activeElement.id'),id);assert.equal(wc.isFocused(),true);
  wc.sendInputEvent({type:'keyDown',keyCode:'A',modifiers:['control']});wc.sendInputEvent({type:'keyUp',keyCode:'A',modifiers:['control']});
  for(const character of text)wc.sendInputEvent({type:'char',keyCode:character});await settle();
  assert.equal(await run(`document.getElementById(${JSON.stringify(id)}).value`),text);
 };
 await settle();await type('project-name','Before import');
 await run(`document.getElementById('import-midi').onclick()`);await type('project-name','After cancel');checks.push('Canceled import restores native click/typing');
 await run(`import('./dist/state.js').then(({state})=>{window.s=state;s.dirty=true;s.saved=''})`);selection=fixture;answer=1;
 await run(`document.getElementById('import-midi').onclick()`);await type('project-name','Declined import');assert.equal(await run('s.project.notes.length'),0);checks.push('Declined native confirmation preserves project and typing');
 answer=0;await run(`document.getElementById('import-midi').onclick()`);assert.equal(await run(`document.getElementById('midi-report').open`),true,await run(`document.getElementById('status').textContent`));
 await run(`document.getElementById('midi-report-close').click()`);await type('project-name','Imported song');assert.equal(await run('s.project.notes.length'),2);
 await type('character-limit','12000');checks.push('Accepted import/report close restores Project and Character limit typing');
 await run(`document.getElementById('save').onclick()`);await type('project-name','After save');checks.push('Canceled save restores typing');
 await run(`import('./dist/commands.js').then(({refresh})=>{s.project.instruments.push({name:'Instructions',color:'#f4d35e',isInstructions:true});s.project.notes.push({id:100,instrument:1,start:128,length:1,pitch:60,volume:0});s.active=1;s.selection=new Set([100]);refresh()})`);
 await type('time-signature','3/4');await type('section-name','New song');await run(`document.getElementById('tempo').focus()`);
 assert.equal(await run('s.project.notes.at(-1).timeSignature'),'3/4');assert.equal(await run('s.project.notes.at(-1).section'),'New song');checks.push('Instructions fields accept native mouse clicks and keyboard text after import');
 finish();
 }catch(error){finish(error);}});});require('../main.cjs');


