// Native DOM characterization of audit findings; does not approve their behavior.
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve('.validation/behavior-audit');fs.mkdirSync(output,{recursive:true});
app.setPath('userData',fs.mkdtempSync(path.join(output,'native-profile-')));app.disableHardwareAcceleration();
let started=false,stage='startup',closedWithDirtyProject=false,prompts=0;const checks=[];
const timer=setTimeout(()=>finish(Error('Timed out: '+stage)),30000);
function finish(error){clearTimeout(timer);fs.writeFileSync(path.join(output,'native-results.json'),JSON.stringify({passed:!error,error:error?.stack,stage,checks,closedWithDirtyProject,prompts},null,2));app.exit(error?1:0);}
dialog.showMessageBoxSync=()=>{prompts++;return 1;};
app.on('browser-window-created',(_,win)=>{if(started)return;started=true;win.webContents.once('did-finish-load',async()=>{try{
 const evaluate=code=>{stage=code;return win.webContents.executeJavaScript(code,true);};
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/commands.js'),import('./dist/playback/transport.js'),import('./dist/files.js')]).then(([state,commands,transport,files])=>{window.s=state.state;window.commands=commands;window.transport=transport;window.filesApi=files;window.reset=state.resetInstrumentView;})`);
 const load=async name=>{const fixture=JSON.parse(fs.readFileSync(path.join(output,name+'.json'),'utf8'));await evaluate(`transport.stopPlayback(false);s.segment=null;reset();s.project=${JSON.stringify(fixture)};s.active=0;s.selection.clear();s.gesture=null;s.dirty=true;s.saved='';commands.refresh();`);};
 const warning=()=>evaluate(`document.querySelector('#instruments .instrument-flag').getAttribute('data-message')`);
 await load('explicit-volumes');await evaluate(`s.selection=new Set([1]);commands.refresh()`);
 const volume=await evaluate(`({stored:document.getElementById('volume').value,info:document.getElementById('info').textContent})`);
 assert.equal(volume.stored,'13');assert.match(volume.info,/effective V5/);checks.push({explicitVolumeConflict:volume});
 fs.writeFileSync(path.join(output,'explicit-volumes.png'),(await win.webContents.capturePage()).toPNG());
 await load('crossing-notes');assert.doesNotMatch(await warning(),/Overlapping notes/);
 await evaluate(`transport.seekToTick(32);document.getElementById('open-segment').click()`);
 assert.equal(await evaluate(`s.segment.projection.range.start`),32);assert.match(await warning(),/Overlapping notes/);
 checks.push({scopeWarning:await warning()});fs.writeFileSync(path.join(output,'scope-overlap.png'),(await win.webContents.capturePage()).toPNG());
 const collision=await evaluate(`(()=>{const r=document.getElementById('return-project').getBoundingClientRect(),t=document.querySelector('.app-header>.transport').getBoundingClientRect();return {width:innerWidth,button:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},transport:{left:t.left,right:t.right,top:t.top,bottom:t.bottom},overlapWidth:Math.max(0,Math.min(r.right,t.right)-Math.max(r.left,t.left)),overlapHeight:Math.max(0,Math.min(r.bottom,t.bottom)-Math.max(r.top,t.top))};})()`);
 assert.ok(collision.overlapWidth>0&&collision.overlapHeight>0);checks.push({headerCollision:collision});
 await evaluate(`document.getElementById('return-project').click()`);assert.doesNotMatch(await warning(),/Overlapping notes/);
 await load('scope-inheritance');await evaluate(`s.selection=new Set([3]);commands.refresh()`);
 assert.match(await evaluate(`document.getElementById('info').textContent`),/effective V5/);
 await evaluate(`transport.seekToTick(32);document.getElementById('open-segment').click();s.selection=new Set([3]);commands.refresh()`);
 const inherited=await evaluate(`document.getElementById('info').textContent`);assert.match(inherited,/effective V13/);checks.push({scopeInheritedVolume:inherited});
 await load('explicit-volumes');assert.equal(await evaluate(`filesApi.unsaved()`),true);
 stage='close isolated dirty test window';win.once('closed',()=>{closedWithDirtyProject=true;checks.push({dirtyClosePrompts:prompts});finish();});win.close();
 }catch(error){finish(error);}});});
require('../main.cjs');
