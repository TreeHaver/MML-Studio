const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
fs.mkdirSync('.validation',{recursive:true});
app.setPath('userData',path.resolve(fs.mkdtempSync('.validation/simplify-test-')));app.disableHardwareAcceleration();
const evidence={passed:false,cases:[]};let started=false;
const timer=setTimeout(()=>finish(Error('Simplify Timing timed out')),30000);
function finish(error){clearTimeout(timer);evidence.passed=!error;if(error)evidence.error=String(error.stack);fs.writeFileSync('.validation/electron-simplify-timing.json',JSON.stringify(evidence,null,2));app.exit(error?1:0);}
const note=(id,start,length,pitch=60)=>({id,start,length,pitch,instrument:0,volume:8});
const cases=[
 {name:'hammer-on ending pitch',notes:[note(1,0,4,62),note(2,4,28,63)],expected:[[2,0,32,63]]},
 {name:'longer same-pitch notes retain balanced tile',notes:[note(1,0,12),note(2,12,12)],expected:[[1,0,12,60],[2,12,12,60]]},
 {name:'rapid repeated pitches',notes:[note(1,0,4),note(2,4,4),note(3,8,4,62),note(4,12,4,62)],expected:[[1,0,8,60],[3,8,8,62]]},
 ...[[60,62,64,65],[65,64,62,60],[60,62,64,62,60,62]].map(pitches=>({name:'pitch run '+pitches.join(','),notes:pitches.map((p,i)=>note(i+1,i*4,4,p)),expected:pitches.flatMap((p,i)=>i%2?[]:[[i+1,i*4,8,p]])}))
];
app.on('browser-window-created',(_,win)=>{if(started)return;started=true;win.webContents.once('did-finish-load',async()=>{try{
 const evaluate=code=>win.webContents.executeJavaScript(code,true);
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/commands.js')]).then(([{state},{refresh}])=>{window.testState=state;window.testRefresh=refresh;})`);
 for(const fixture of cases){
  await evaluate(`testState.project={format:'mml-studio',version:2,grid:32,instruments:[{name:'Piano',color:'#abcdef'}],notes:${JSON.stringify(fixture.notes)}};testState.active=0;testState.history=[];testState.future=[];testState.selection.clear();testRefresh();document.getElementById('tools-menu').open=true;document.getElementById('simplify-length').value='16';document.getElementById('simplify-timing').click();`);
  const actual=await evaluate(`testState.project.notes.map(n=>[n.id,n.start,n.length,n.pitch])`);
  assert.deepEqual(actual,fixture.expected);
  assert.match(await evaluate(`document.getElementById('status').textContent`),/Simplify Timing L16:.*0 skipped/);
  const changed=JSON.stringify(actual)!==JSON.stringify(fixture.notes.map(n=>[n.id,n.start,n.length,n.pitch]));
  assert.equal(await evaluate(`testState.history.length`),changed?1:0);
  await evaluate(`document.getElementById('simplify-timing').click()`);
  assert.equal(await evaluate(`testState.history.length`),changed?1:0);
  if(changed){
   await evaluate(`document.getElementById('undo').click()`);
   assert.deepEqual(await evaluate(`testState.project.notes`),fixture.notes);
   await evaluate(`document.getElementById('redo').click()`);
   assert.deepEqual(await evaluate(`testState.project.notes.map(n=>[n.id,n.start,n.length,n.pitch])`),fixture.expected);
  }
  assert.equal(await evaluate(`testState.project.version`),2);
  evidence.cases.push({name:fixture.name,actual,undoRedo:changed});
 }

 await evaluate(`testState.project.instruments=[{name:'A',color:'#abcdef'},{name:'B',color:'#77baff'},{name:'Outside',color:'#ff9c33'}];testState.project.notes=[0,1,2].flatMap(instrument=>[{id:instrument*2+1,instrument,start:0,length:4,pitch:60,volume:8},{id:instrument*2+2,instrument,start:4,length:4,pitch:62,volume:8}]);testState.active=0;testState.selectedInstruments=new Set([1,0]);testState.selection.clear();testState.history=[];testState.future=[];testRefresh();`);
 assert.deepEqual(await evaluate(`import('./dist/tools.js').then(({toolTargets})=>toolTargets().map(n=>n.instrument))`),[0,0,1,1]);
 await evaluate(`document.getElementById('simplify-length').value='16';document.getElementById('simplify-timing').click();`);
 assert.deepEqual(await evaluate(`testState.project.notes.map(n=>[n.instrument,n.start,n.length])`),[[0,0,8],[1,0,8],[2,0,4],[2,4,4]]);
 assert.deepEqual(await evaluate(`[testState.history.length,testState.active,[...testState.selectedInstruments]]`),[1,0,[1,0]]);
 await evaluate(`document.getElementById('undo').click();`);assert.equal(await evaluate(`testState.project.notes.length`),6);
 evidence.cases.push({name:'Selected instrument stack: both selected lanes simplified, outside lane preserved, one Undo',passed:true});
 finish();
 }catch(error){finish(error);}});});
require('../main.cjs');
