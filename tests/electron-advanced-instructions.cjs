// Native renderer/IPC checks; only OS file choices are substituted.
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {midi,event:e,end}=require('./midi-fixtures.cjs');
fs.mkdirSync('.validation',{recursive:true});const dir=fs.mkdtempSync(path.resolve('.validation/advanced-test-'));
app.setPath('userData',path.join(dir,'preferences'));app.disableHardwareAcceleration();
let selection=null;dialog.showOpenDialog=async()=>selection?{canceled:false,filePaths:[selection]}:{canceled:true,filePaths:[]};
const saved=path.join(dir,'saved.json');dialog.showSaveDialog=async()=>({canceled:false,filePath:saved});
const mml=path.join(dir,'unbound.mml'),mid=path.join(dir,'unbound.mid');
fs.writeFileSync(mml,'c4t90r4d4');
fs.writeFileSync(mid,midi([[e(0,144,60,100),e(16,255,81,3,15,66,64),e(16,128,60,0),end()]]));
let stage='startup';const timer=setTimeout(()=>finish(Error('Timed out: '+stage)),30000);
function finish(error){clearTimeout(timer);fs.writeFileSync('.validation/electron-advanced-instructions.json',JSON.stringify({passed:!error,error:error?.stack},null,2));app.exit(error?1:0);}
app.on('browser-window-created',(_,win)=>win.webContents.once('did-finish-load',async()=>{try{
 const run=code=>{stage=code;return win.webContents.executeJavaScript(code,true);};
 await run(`Promise.all([import('./dist/state.js'),import('./dist/commands.js'),import('./dist/files.js')]).then(([m,c,f])=>{window.s=m.state;window.prefs=m.instrumentView;window.isMuted=m.isMuted;window.refresh=c.refresh;window.saveProject=f.saveProject;window.confirm=()=>true;})`);
 const enabled=()=>run(`document.getElementById('advanced-instructions').getAttribute('aria-pressed')`);
 assert.equal(await enabled(),'false');assert.equal(await run(`document.querySelector('.instructions-lane').hidden`),true);
 const initial=await run('JSON.stringify([s.project,s.history,s.dirty])');
 await run(`document.getElementById('advanced-instructions').click()`);
 assert.equal(await enabled(),'true');assert.equal(await run('JSON.stringify([s.project,s.history,s.dirty])'),initial);
 assert.equal(await run(`document.getElementById('instrument-count').textContent`),'1');
 assert.equal(await run(`document.querySelector('.instructions-lane').querySelector('select,.instrument-actions,.instrument-controls,.instrument-row-delete')`),null);
 assert.equal(await run(`[...document.querySelectorAll('select option')].some(o=>o.value==='instructions')`),false);
 await run(`document.querySelector('.instructions-lane .instrument-name').click()`);
 assert.equal(await run('s.project.instruments[s.active].isInstructions'),true);
 await run(`s.project.notes=[{id:1,instrument:0,start:0,length:128,pitch:60,volume:8},{id:2,instrument:s.active,start:32,length:1,pitch:60,volume:0,tempo:90}];refresh();`);
 await run(`document.getElementById('vanilla-only').click();document.querySelector('.instrument-controls button[aria-label^="Solo"]').click()`);
 assert.equal(await run('isMuted(s.project.instruments.findIndex(i=>i.isInstructions))'),false);
 assert.equal(await run(`document.querySelector('.instructions-lane .preset-warning')`),null);
 const beforeDraw=await run('JSON.stringify(s.project)');
 const point=await run(`import('./dist/constants.js').then(({KEY})=>{const r=document.getElementById('canvas').getBoundingClientRect();return {x:Math.round(r.left+KEY+64*s.zoom+3),y:Math.round(r.top+240)}})`);
 win.webContents.sendInputEvent({type:'mouseDown',...point,button:'left',clickCount:1});
 win.webContents.sendInputEvent({type:'mouseUp',...point,button:'left',clickCount:1});
 await run(`new Promise(resolve=>requestAnimationFrame(resolve))`);
 assert.equal(await run('s.project.notes.length'),3);
 assert.equal(await run('s.project.instruments[s.project.notes.at(-1).instrument].isInstructions'),true);
 await run(`document.getElementById('undo').click()`);assert.equal(await run('JSON.stringify(s.project)'),beforeDraw);
 const beforeHide=await run('JSON.stringify(s.project)');
 await run(`document.getElementById('advanced-instructions').click();refresh()`);
 assert.equal(await enabled(),'false');assert.equal(await run('JSON.stringify(s.project)'),beforeHide);
 assert.equal(await run(`import('./dist/playback/midi.js').then(({compilePlayback})=>compilePlayback(s.project).map.some(t=>t.tick===32&&t.bpm===90))`),true);
 await run(`saveProject()`);selection=saved;
 await run(`document.getElementById('open').onclick()`);assert.equal(await enabled(),'true');
 assert.equal(await run('JSON.stringify(s.project)'),beforeHide);
 // Adding musical lanes must keep Instructions last visually, regardless of stored index.
 await run(`document.getElementById('add').click();document.getElementById('add').click()`);
 assert.equal(await run(`(()=>{const bottom=document.querySelector('.instructions-lane').getBoundingClientRect().top;return [...document.querySelectorAll('.instrument:not(.instructions-lane)')].every(r=>r.getBoundingClientRect().top<bottom)})()`),true);
 assert.equal(await run(`document.getElementById('instrument-count').textContent`),'3');
 await run(`document.getElementById('new').click()`);assert.equal(await enabled(),'false');
 for(const source of [mml,mid]){
  selection=source;await run(`document.getElementById('import-midi').onclick()`);
  assert.equal(await enabled(),'true');
  assert.equal(await run(`s.project.notes.some(n=>s.project.instruments[n.instrument].isInstructions&&n.tempo!=null&&n.start>0)`),true);
  assert.equal(await run(`Number(document.getElementById('instrument-count').textContent)===s.project.instruments.filter(i=>!i.isInstructions).length`),true);
  await run(`document.getElementById('midi-report-close').click();document.getElementById('new').click()`);
  assert.equal(await enabled(),'false');
 }
 // An imported/pasted unbound tempo also reveals the lane without replacing the project.
 await run(`import('./dist/note-clipboard.js').then(m=>m.pasteMml('c4t90r4d4'))`);
 assert.equal(await enabled(),'true');
 await run(`document.getElementById('advanced-instructions').click()`);assert.equal(await enabled(),'false');
 await run(`import('./dist/note-clipboard.js').then(m=>m.pasteMml('c4t100r4d4'))`);
 assert.equal(await enabled(),'true');
 fs.writeFileSync('.validation/electron-advanced-instructions.png',(await win.webContents.capturePage()).toPNG());
 finish();
}catch(error){finish(error);}}));require('../main.cjs');
