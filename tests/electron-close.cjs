const {app,dialog,ipcMain}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const mode=process.argv.find(v=>v.startsWith('--case='))?.slice(7)||'save';
const root=fs.mkdtempSync(path.resolve('.validation/close-'));app.setPath('userData',path.join(root,'profile'));app.disableHardwareAcceleration();
let started=false,stage='startup',prompts=0,response=2,saveMode='cancel',releasePrompt;const checks=[];
const timer=setTimeout(()=>finish(Error('Timeout: '+stage)),30000);
function finish(error){clearTimeout(timer);fs.writeFileSync('.validation/electron-close-'+mode+'.json',JSON.stringify({passed:!error,error:error?.stack,stage,checks},null,2));app.exit(error?1:0);}
app.on('window-all-closed',()=>{});
app.on('browser-window-created',(_,win)=>{if(started)return;started=true;win.webContents.once('did-finish-load',async()=>{try{
 const evaluate=code=>win.webContents.executeJavaScript(code,true),wait=ms=>new Promise(r=>setTimeout(r,ms));
 dialog.showMessageBox=async(_,options)=>{prompts++;assert.deepEqual(options.buttons,['Save','Discard','Cancel']);assert.equal(options.cancelId,2);if(response==='hold')await new Promise(r=>releasePrompt=r);return {response:response==='hold'?2:response};};
 dialog.showSaveDialog=async()=>{if(saveMode==='cancel')return {canceled:true};if(saveMode==='fail')return {canceled:false,filePath:root};if(saveMode==='edit')await evaluate(`s.project.notes=s.project.notes.map(n=>({...n,volume:7}));s.dirty=true`);return {canceled:false,filePath:path.join(root,'saved.json')};};
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/files.js'),import('./dist/commands.js')]).then(([{state},files,{refresh}])=>{window.s=state;window.f=files;window.refresh=refresh;})`);
 const closeAndWait=async()=>{win.close();await wait(100);};
 if(mode==='import'){stage='close after import';const file=path.join(root,'import.mml');fs.writeFileSync(file,'MML@o4v13c1;');dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});await evaluate(`document.getElementById('import-midi').onclick()`);assert.ok(await evaluate('f.unsaved()'));response=1;await closeAndWait();assert.ok(win.isDestroyed());assert.equal(prompts,1);checks.push('Imported project prompts and Discard closes without beforeunload lock');finish();return;}
 if(mode==='clean'){stage='clean close';await closeAndWait();assert.ok(win.isDestroyed());assert.equal(prompts,0);checks.push('Clean project closes without prompting');finish();return;}
 await evaluate(`s.project.notes=[{id:1,instrument:0,start:0,length:128,pitch:60,volume:13}];s.dirty=true;refresh()`);
 if(mode==='discard'){stage='discard';response=1;await closeAndWait();assert.ok(win.isDestroyed());assert.equal(prompts,1);checks.push('Discard closes dirty project');finish();return;}
 if(mode==='quit'){stage='application quit cancel';response=2;app.quit();await wait(100);assert.ok(!win.isDestroyed());assert.equal(prompts,1);checks.push('Cancel prevents app.quit from losing changes');finish();return;}
 stage='cancel';await closeAndWait();assert.ok(!win.isDestroyed());assert.ok(await evaluate('f.unsaved()'));
 stage='duplicate native close';response='hold';win.close();await wait(50);const count=prompts;win.close();win.close();await wait(50);assert.equal(prompts,count);releasePrompt();await wait(50);assert.ok(!win.isDestroyed());response=0;
 stage='save dialog cancel';await closeAndWait();assert.ok(!win.isDestroyed());assert.ok(await evaluate('f.unsaved()'));
 stage='save failure';saveMode='fail';await closeAndWait();assert.ok(!win.isDestroyed());assert.match(await evaluate(`document.getElementById('status').textContent`),/Save failed/);
 stage='edit during save';saveMode='edit';await closeAndWait();assert.ok(!win.isDestroyed());assert.ok(await evaluate('f.unsaved()'));assert.equal(JSON.parse(fs.readFileSync(path.join(root,'saved.json'))).notes[0].volume,13);
 checks.push('Cancel, duplicate X, cancelled Save, failed Save and edits during Save keep window open');
 stage='save scoped project and close';saveMode='ok';await evaluate(`import('./dist/segment-session.js').then(({enterSegment})=>{enterSegment(s.project,{kind:'segment',name:'Middle',start:32,end:96});s.project.notes[0].pitch=64;s.dirty=true;})`);
 // Observe closure without allowing Electron to terminate before assertions finish.
 app.removeAllListeners('window-all-closed');await closeAndWait();assert.ok(win.isDestroyed());const saved=JSON.parse(fs.readFileSync(path.join(root,'saved.json')));assert.ok(saved.notes.some(n=>n.start===32&&n.length===64&&n.pitch===64));assert.ok(saved.notes.some(n=>n.start===0&&n.length===32));assert.ok(saved.notes.some(n=>n.start===96&&n.length===32));checks.push('Save completes before close and retains full project outside Segment');finish();
 }catch(error){finish(error);}});});require('../main.cjs');
// Tests must finish their assertions after the real window closes.
app.removeAllListeners('window-all-closed');
