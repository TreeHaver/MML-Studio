// Native renderer + preload + main IPC test. Dialog selection is stubbed;
// file reading, MIDI conversion, project replacement and playback are real.
const {app,dialog}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {midi,event:e,end,padMidi,repeatedMidi}=require('./midi-fixtures.cjs');
const output=path.resolve('.validation');fs.mkdirSync(output,{recursive:true});
const validFile=path.join(output,'midi-import.fixture.mid'),badFile=path.join(output,'midi-import.invalid.mid');
fs.writeFileSync(validFile,padMidi(midi([[e(0,192,40),e(5,144,60,100),e(7,128,60,0),e(3,144,64,127),e(11,128,64,0),end()]]),17*1024*1024));
fs.writeFileSync(badFile,'not MIDI');
let selection=null;
dialog.showOpenDialog=async()=>selection?{canceled:false,filePaths:[selection]}:{canceled:true,filePaths:[]};
const result={checks:[],errors:[]};
const deadline=setTimeout(()=>finish(Error('Native MIDI test timed out')),45000);
function finish(error){clearTimeout(deadline);if(error)result.errors.push(String(error.stack??error));result.passed=!result.errors.length;fs.writeFileSync(path.join(output,'electron-midi-import.json'),JSON.stringify(result,null,2));app.exit(result.passed?0:1);}
app.on('browser-window-created',(_,win)=>{
 const wc=win.webContents;
 wc.once('did-finish-load',async()=>{
  try{
   const run=code=>wc.executeJavaScript(code,true).catch(error=>{throw Error(String(error.message||error)+' | while running: '+String(code).slice(0,200));});
   const state=()=>run(`import('./dist/state.js').then(({state})=>({project:state.project,dirty:state.dirty}))`);
   const importClick=()=>run(`document.getElementById('import-midi').onclick()`);
   const initial=await state();await importClick();assert.deepEqual(await state(),initial);
   result.checks.push('Cancel leaves project unchanged');
   selection=badFile;await importClick();assert.deepEqual(await state(),initial);
   assert.match(await run(`document.getElementById('status').textContent`),/Import failed/);
   result.checks.push('Malformed file leaves project unchanged');
   await run(`import('./dist/state.js').then(({state})=>{state.dirty=true;state.saved='';window.confirm=()=>false;})`);
   const dirty=await state();selection=validFile;await importClick();assert.deepEqual(await state(),dirty);
   result.checks.push('Declining unsaved-changes prompt leaves project unchanged');
   await run(`window.confirm=()=>true;true;`);await importClick();
   const imported=await state();assert.equal(imported.dirty,true);
   assert.deepEqual(imported.project.notes.map(n=>[n.start,n.length,n.pitch]),[[5,7,60],[15,11,64]]);
   assert.equal(imported.project.instruments[0].midiProgram,40);
   assert.equal(await run(`document.getElementById('midi-report').open`),true);
   await new Promise(resolve=>setTimeout(resolve,200));
   fs.writeFileSync(path.join(output,'midi-import-report.png'),(await wc.capturePage()).toPNG());
   await run(`document.getElementById('midi-report-close').click()`);
   await run(`document.getElementById('grid').value='128';document.getElementById('grid').onchange()`);
   assert.deepEqual((await state()).project.notes.map(n=>n.length),[7,11]);
   await run(`import('./dist/playback/transport.js').then(m=>m.play())`);
   assert.equal(await run(`document.getElementById('play').classList.contains('is-playing')`),true);
   await run(`document.getElementById('stop').click()`);
   result.checks.push('Real file IPC accepts a file over 16 MiB, imports 7/11-unit notes and GM Violin, displays report, marks unsaved, and starts playback');
   win.setSize(900,700);await new Promise(resolve=>setTimeout(resolve,200));
   result.checks.push({minimumWidthOverflow:await run(`document.documentElement.scrollWidth>innerWidth`)});
   fs.writeFileSync(path.join(output,'midi-import-editor.png'),(await wc.capturePage()).toPNG());
   const largeFile=path.join(output,'large-midi-import.fixture.mid');
   fs.writeFileSync(largeFile,repeatedMidi(130000));selection=largeFile;await importClick();
   assert.equal((await state()).project.notes.length,130000);
   await run(`document.getElementById('midi-report-close').click()`);
   await run(`import('./dist/playback/transport.js').then(m=>m.play())`);
   assert.equal(await run(`document.getElementById('play').classList.contains('is-playing')`),true);
   await run(`document.getElementById('stop').click()`);
   result.checks.push('130,000-note import renders and starts/stops native playback without argument-count errors');
   await run(`import('./dist/state.js').then(({state})=>{state.dirty=false;})`);finish();
  }catch(error){finish(error);}
 });
});
require('../main.cjs');
