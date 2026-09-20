// Native renderer + preload + main IPC. The file picker is stubbed; reading the files,
// parsing the MML and changing the project are real.
//
// An ensemble is written as one file per player, and the menu could only take one file and
// replaced the project with it, so importing the second part erased the first. The parts
// could only be gathered by dropping them, which nothing in the app mentions. The picker now
// takes several files, and adding them to the open project is its own entry.
const {app,dialog}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve('.validation');fs.mkdirSync(output,{recursive:true});
app.setPath('userData',fs.mkdtempSync(path.join(output,'import-menu-')));app.disableHardwareAcceleration();
// Named so that a plain text sort would put "part 10" before "part 2": the picker has to
// order them the way the band reads them, not the way the characters compare.
const write=(name,text)=>{const file=path.join(output,name);fs.writeFileSync(file,text);return file;};
const melody=write('ensemble part 2.mml','c4'),harmony=write('ensemble part 10.mml','e4');
const extra=[write('ensemble part 3.mml','g4'),write('ensemble part 4.mml','a4')];
let selection=[],properties=null,started=false;
const result={checks:[],errors:[]};
const deadline=setTimeout(()=>finish(Error('Import menu test timed out')),45000);
function finish(error){clearTimeout(deadline);if(error)result.errors.push(String(error.stack??error));result.passed=!result.errors.length;
 fs.writeFileSync(path.join(output,'electron-import-menu.json'),JSON.stringify(result,null,2));app.exit(result.passed?0:1);}
// The dialog is handed the files in the order they were clicked, which is why the order the
// picker returns them in is the interesting part: here the second file is offered first.
dialog.showOpenDialog=async(_,options)=>{properties=options.properties;return selection.length?{canceled:false,filePaths:[...selection].reverse()}:{canceled:true,filePaths:[]};};
app.on('browser-window-created',(_,win)=>{if(started)return;started=true;
 win.webContents.once('did-finish-load',async()=>{try{
  const run=code=>win.webContents.executeJavaScript(code,true);
  const settle=()=>run(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  const project=()=>run(`import('./dist/state.js').then(({state})=>({instruments:state.project.instruments.filter(i=>!i.isInstructions).length,pitches:state.project.notes.map(n=>n.pitch),owners:state.project.notes.map(n=>n.instrument),name:state.project.name,history:state.history.length}))`);
  await run(`window.confirm=()=>true;true`);

  const empty=await project();
  await run(`document.getElementById('import-midi').onclick()`);await settle();
  assert.deepEqual(await project(),empty,'cancelling the picker leaves the project alone');
  result.checks.push('Cancel leaves the project unchanged');

  selection=[melody,harmony];
  await run(`document.getElementById('import-midi').onclick()`);await settle();
  assert.deepEqual(properties,['openFile','multiSelections'],'the picker accepts several files');
  const replaced=await project();
  assert.equal(replaced.instruments,2,'both chosen files became instruments: '+JSON.stringify(replaced));
  assert.deepEqual(replaced.pitches,[60,64],'part 2 is read before part 10: '+JSON.stringify(replaced));
  assert.notEqual(replaced.owners[0],replaced.owners[1],'each file is its own instrument');
  assert.equal(replaced.name,'ensemble part 2');
  await run(`document.getElementById('midi-report-close').click()`);
  result.checks.push('Import takes several files at once, one instrument each, ordered by name rather than by click');

  selection=extra;
  await run(`document.getElementById('import-add').onclick()`);await settle();
  const added=await project();
  assert.equal(added.instruments,4,'the added parts joined the two already there: '+JSON.stringify(added));
  assert.deepEqual(added.pitches,[60,64,67,69],'the first import is still there and the new parts follow');
  assert.equal(new Set(added.owners).size,4,'four parts, four instruments');
  assert.equal(added.history,1,'adding parts is one undo step');
  await run(`document.getElementById('midi-report-close').click()`);

  await run(`import('./dist/history.js').then(({undo})=>undo())`);await settle();
  const undone=await project();
  assert.deepEqual(undone.pitches,replaced.pitches,'undo puts back the project the parts were added to');
  assert.equal(undone.instruments,2);
  result.checks.push('Add parts joins the open project as new instruments and undoes in one step');

  fs.writeFileSync(path.join(output,'import-menu.png'),(await win.webContents.capturePage()).toPNG());
  finish();
 }catch(error){finish(error);}});});
require('../main.cjs');
