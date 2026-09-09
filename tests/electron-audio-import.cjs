// Native drop -> preload IPC -> bundled FFmpeg -> analysis -> editor/export.
const {app}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const output=path.resolve('.validation');fs.mkdirSync(output,{recursive:true});
app.setPath('userData',path.join(output,'audio-import-profile'));
const wav=path.join(output,'voice-import.fixture.wav'),mp3=path.join(output,'voice-import.fixture.mp3');
const rate=16000,frames=rate*1.2,bytes=Buffer.alloc(44+frames*2);
bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(frames*2,40);
for(let i=0;i<frames;i++){const t=i/rate,gain=t<0.45?0.1:t<0.9?0.02:0;const sample=[220,440,660,1100,1760].reduce((sum,f)=>sum+Math.sin(2*Math.PI*f*t)*gain,0);bytes.writeInt16LE(Math.round(sample*32767),44+i*2);}
fs.writeFileSync(wav,bytes);
const encode=spawnSync(path.resolve('vendor/ffmpeg.exe'),['-y','-hide_banner','-loglevel','error','-i',wav,mp3],{windowsHide:true});assert.equal(encode.status,0,String(encode.stderr));
const result={checks:[],errors:[]},deadline=setTimeout(()=>finish(Error('Audio import native test timed out')),60000);
function finish(error){clearTimeout(deadline);if(error)result.errors.push(String(error.stack??error));result.passed=!result.errors.length;fs.writeFileSync(path.join(output,'electron-audio-import.json'),JSON.stringify(result,null,2));app.exit(result.passed?0:1);}
app.on('browser-window-created',(_,win)=>win.webContents.once('did-finish-load',async()=>{
 const run=code=>win.webContents.executeJavaScript(code,true);
 const current=()=>run(`import('./dist/state.js').then(({state})=>({project:state.project,dirty:state.dirty,history:state.history.length}))`);
 const drop=files=>run(`(async()=>{const transfer=new DataTransfer();for(const f of ${JSON.stringify(files)})transfer.items.add(new File([new Uint8Array(f.bytes)],f.name));const e=new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true});const original=document.ondrop;let pending;document.ondrop=event=>{pending=original(event);};try{document.dispatchEvent(e);await pending;return e.defaultPrevented;}finally{document.ondrop=original;}})()`);
 const closeReport=()=>run(`document.getElementById('midi-report-close').click()`);
 const fixture=file=>({name:path.basename(file),bytes:[...fs.readFileSync(file)]});
 try{
  await run(`window.confirm=()=>true;true;`);
  await run(`window.samplingChoice=import('./dist/audio-import-ui.js').then(m=>m.chooseAudioSampling('Example voice.wav',10,10000));true;`);
  assert.equal(await run(`document.getElementById('audio-import-options').open`),true);
  assert.match(await run(`document.getElementById('audio-import-estimate').textContent`),/10,620.*10,000.*over budget/);
  assert.equal(await run(`document.getElementById('audio-import-accept').textContent`),'Import anyway');
  await run(`document.getElementById('audio-voice-count').value='1';document.getElementById('audio-voice-count').dispatchEvent(new Event('input'))`);
  assert.match(await run(`document.getElementById('audio-import-estimate').textContent`),/2,604.*Within/);
  await run(`document.getElementById('audio-voice-count').value='1.5';document.getElementById('audio-voice-count').dispatchEvent(new Event('input'))`);
  assert.equal(await run(`document.getElementById('audio-import-accept').disabled`),true);
  await run(`document.getElementById('audio-voice-count').value='5';document.getElementById('audio-voice-count').dispatchEvent(new Event('input'))`);
  await run(`document.getElementById('audio-sample-rate').value='60';document.getElementById('audio-sample-rate').dispatchEvent(new Event('input'))`);
  assert.match(await run(`document.getElementById('audio-import-estimate').textContent`),/5,610.*Within/);
  await run(`document.getElementById('audio-sample-rate').value='0';document.getElementById('audio-sample-rate').dispatchEvent(new Event('input'))`);
  assert.equal(await run(`document.getElementById('audio-import-accept').disabled`),true);
  await run(`document.getElementById('audio-sample-rate').value='10';document.getElementById('audio-sample-rate').dispatchEvent(new Event('input'))`);
  assert.match(await run(`document.getElementById('audio-sample-details').textContent`),/9.375 ms.*Rounded/);
  fs.writeFileSync(path.join(output,'audio-import-sample-rate.png'),(await win.webContents.capturePage()).toPNG());
  await run(`document.getElementById('audio-import-cancel').click()`);assert.equal(await run(`window.samplingChoice`),null);
  result.checks.push('Sample Rate dialog updates estimates and warnings, rejects invalid values, shows timing rounding and supports Cancel');
  // Exercise real drop prompts with deterministic user choices, including cancellation.
  await run(`window.audioPromptAction='cancel';window.audioPromptInterval=30;window.audioPromptVoices=5;window.audioPromptTimer=setInterval(()=>{if(document.getElementById('audio-import-options').open){const field=document.getElementById('audio-sample-rate');field.value=String(window.audioPromptInterval);field.dispatchEvent(new Event('input'));const voices=document.getElementById('audio-voice-count');voices.value=String(window.audioPromptVoices);voices.dispatchEvent(new Event('input'));document.getElementById(window.audioPromptAction==='cancel'?'audio-import-cancel':'audio-import-accept').click();}},20);true;`);
  const initial=await current();await drop([fixture(wav)]);assert.deepEqual(await current(),initial);
  assert.match(await run(`document.getElementById('status').textContent`),/cancelled/);
  await run(`window.audioPromptAction='accept';true;`);
  for(const file of [wav,mp3]){
   const interval=file===mp3?15:30;await run(`window.audioPromptInterval=${interval};window.audioPromptVoices=${file===mp3?3:5};true;`);
   await run(`document.getElementById('new').click()`);
   assert.equal(await drop([fixture(file)]),true);
   const imported=await current();assert.equal(imported.project.grid,128);assert.equal(imported.dirty,true);
   assert.equal(imported.project.instruments.filter(i=>!i.isInstructions).length,1);
   assert.equal(imported.project.notes.find(n=>n.speedEntry).speedMultiplier,4);
   assert.equal(imported.project.notes.find(n=>n.speedEntry).tempo,250);
   assert.equal(imported.project.notes.filter(n=>n.start===0&&imported.project.instruments[n.instrument].isInstructions).length,1);
   const stats=await run(`(async()=>{const {state}=await import('./dist/state.js'),{generateMml}=await import('./dist/music/mml.js'),{parse}=await import('./dist/model/serialization.js'),{compilePlayback}=await import('./dist/playback/midi.js');const mml=generateMml(state.project,0);return {channels:mml.channels.length,bytes:mml.bytes,roundtrip:JSON.stringify(parse(JSON.stringify(state.project)))===JSON.stringify(state.project),playback:compilePlayback(state.project).duration};})()`);
   assert.equal(stats.channels,file===mp3?3:5);assert.ok(stats.bytes<10000);assert.equal(stats.roundtrip,true);
   const musical=imported.project.notes.filter(n=>n.instrument===0);
   assert.equal(Math.min(...musical.map(n=>n.start)),128);
   assert.equal(musical.filter(n=>n.volume===0).length,1);
   assert.ok(stats.playback>1.5&&stats.playback<60);
   assert.ok((await run(`document.getElementById('midi-warnings').textContent`)).includes(`${interval} ms`));
   assert.equal(await run(`document.getElementById('midi-report-title').textContent`),'Import complete');
   await closeReport();
   await run(`import('./dist/playback/transport.js').then(m=>m.play())`);
   assert.equal(await run(`document.getElementById('play').classList.contains('is-playing')`),true);
   await run(`document.getElementById('stop').click()`);
   result.checks.push({format:path.extname(file),...stats});
  }
  fs.writeFileSync(path.join(output,'audio-import-editor.png'),(await win.webContents.capturePage()).toPNG());
  await run(`document.getElementById('new').click()`);
  await drop([{name:'base.mml',bytes:[...Buffer.from('c4')]}]);await closeReport();const before=await current();
  await drop([fixture(wav)]);const added=await current();assert.equal(added.project.instruments.filter(i=>!i.isInstructions).length,2);assert.equal(added.history,before.history+1);
  await closeReport();await run(`import('./dist/history.js').then(m=>m.undo())`);assert.deepEqual((await current()).project,before.project);
  result.checks.push('Populated drop adds an independent instrument; Undo restores original notes and clock');
  await drop([{name:'bad.wav',bytes:[1,2,3]}]);assert.deepEqual((await current()).project,before.project);assert.equal(await run(`document.getElementById('midi-report-title').textContent`),'Import failed');await closeReport();
  await drop([{name:'good.mml',bytes:[...Buffer.from('d4')]},{name:'bad.mp3',bytes:[1,2,3]}]);assert.deepEqual((await current()).project,before.project);await closeReport();
  result.checks.push('Invalid audio and a mixed invalid batch leave the existing project unchanged');
  // Hold the browser file read, edit while it is pending, then allow real decoding.
  await run(`(async()=>{window.releaseAudioRead=null;const file={name:'pending.wav',arrayBuffer:()=>new Promise(resolve=>{window.releaseAudioRead=()=>resolve(new Uint8Array(${JSON.stringify([...bytes])}).buffer);})};const {importDroppedFiles}=await import('./dist/drop-files.js');window.pendingAudioDrop=importDroppedFiles([file]);})()`);
  await run(`import('./dist/state.js').then(({state})=>{state.project.notes[0].pitch=72;window.releaseAudioRead();})`);
  await run(`window.pendingAudioDrop`);assert.equal((await current()).project.notes[0].pitch,72);
  assert.match(await run(`document.getElementById('midi-summary').textContent`),/project changed/);
  result.checks.push('An edit during async decoding prevents a stale import from committing');
  await run(`clearInterval(window.audioPromptTimer)`);finish();
 }catch(error){finish(error);}
}));
require('../main.cjs');
