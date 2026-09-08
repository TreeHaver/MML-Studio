// Real offline synth/encoder/IPC. Only the native file picker is substituted.
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=fs.mkdtempSync(path.resolve('.validation/audio-export-'));app.setPath('userData',path.join(root,'profile'));app.disableHardwareAcceleration();
let extension='wav',cancelSave=false,selectedPath,filters,stage='startup';const checks=[];
const timer=setTimeout(()=>finish(Error('Timed out: '+stage)),90000);
function finish(error){clearTimeout(timer);fs.writeFileSync('.validation/electron-audio-export.json',JSON.stringify({passed:!error,error:error?.stack,stage,checks},null,2));app.exit(error?1:0);}
dialog.showSaveDialog=async(_,options)=>{filters=options.filters;selectedPath=path.join(root,'render.'+extension);return {canceled:cancelSave,filePath:selectedPath};};
app.on('browser-window-created',(_,win)=>win.webContents.once('did-finish-load',async()=>{try{
 const evaluate=code=>win.webContents.executeJavaScript(code,true);
 const wait=async fn=>{for(let i=0;i<600;i++){if(await fn())return;await new Promise(r=>setTimeout(r,30));}throw Error('Waiting for '+stage);};
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/commands.js'),import('./dist/playback/transport.js')]).then(([{state,instrumentView},commands,transport])=>{window.s=state;window.iv=instrumentView;window.transport=transport;window.commands=commands;
 s.project={format:'mml-studio',version:2,grid:4,name:'Audio test',instruments:[{name:'Flute',color:'#4488aa',midiProgram:73},{name:'Instructions',color:'#f4d35e',isInstructions:true}],notes:[{id:1,instrument:0,start:16,length:16,pitch:72,volume:10},{id:2,instrument:1,start:0,length:1,pitch:60,volume:0,loopEntry:true,loopCount:3},{id:3,instrument:1,start:32,length:1,pitch:60,volume:0,loopExit:true}]};s.active=0;s.selection.clear();commands.refresh();})`);
 const before=await evaluate('JSON.stringify(s.project)');let captured=false;
 const run=async()=>{
  await evaluate(`document.getElementById('format-audio').checked=true;document.getElementById('scope-selected').checked=false;document.getElementById('export-open').click();`);
  assert.equal(await evaluate(`document.getElementById('export-section-options').hidden`),true);
  if(!captured){await evaluate(`new Promise(r=>setTimeout(r,100))`);fs.writeFileSync('.validation/audio-export-options.png',(await win.webContents.capturePage()).toPNG());captured=true;}
  await evaluate(`document.getElementById('export-run').click()`);
  await wait(()=>evaluate(`!document.getElementById('export-run').disabled`));
  return evaluate(`document.getElementById('status').textContent`);
 };
 const decode=file=>{const result=spawnSync(path.resolve('vendor/ffmpeg.exe'),['-v','error','-i',file,'-f','f32le','-ac','2','-ar','44100','pipe:1'],{windowsHide:true,maxBuffer:20*1024*1024});assert.equal(result.status,0,result.stderr?.toString());return new Float32Array(result.stdout.buffer.slice(result.stdout.byteOffset,result.stdout.byteOffset+result.stdout.length));};
 const energy=(data,from,to)=>{let peak=0;for(let i=Math.floor(from*88200);i<Math.min(data.length,to*88200);i++)peak=Math.max(peak,Math.abs(data[i]));return peak;};
 for(extension of ['wav','mp3','ogg','flac','m4a','opus']){
  stage=extension;assert.match(await run(),new RegExp('Exported '+extension.toUpperCase()+' audio'));
  assert.deepEqual(filters.map(f=>f.extensions[0]),['wav','mp3','ogg','flac','m4a','opus']);
  const bytes=fs.readFileSync(selectedPath),data=decode(selectedPath);assert.ok(bytes.length>500);
  for(const onset of [.25,.75,1.25])assert.ok(energy(data,onset+.05,onset+.2)>.001,'Each loop repeat is audible in '+extension);
  assert.ok(energy(data,0,.2)<.0001,'Leading rest survives '+extension);
  checks.push({format:extension,bytes:bytes.length,seconds:data.length/88200});
 }
 assert.equal(await evaluate('JSON.stringify(s.project)'),before);
 extension='wav';stage='mute';await evaluate('iv.muted.add(0)');assert.match(await run(),/Exported WAV/);assert.equal(energy(decode(selectedPath),0,3),0);await evaluate('iv.muted.clear()');
 stage='segment';await evaluate(`s.project.notes=[{id:1,instrument:0,start:0,length:256,pitch:72,volume:10},{id:2,instrument:1,start:32,length:1,pitch:60,volume:0,section:'Middle'},{id:3,instrument:1,start:64,length:1,pitch:60,volume:0,section:'Next'}];commands.refresh();transport.playback.tick=32;import('./dist/segment-view.js').then(m=>m.openSegmentView('segment'))`);
 assert.equal(await evaluate('s.segment.projection.range.end-s.segment.projection.range.start'),32);
 assert.match(await run(),/Exported WAV/);const segment=decode(selectedPath);assert.ok(energy(segment,0,.4)>.001);assert.ok(segment.length/88200<4,'The half-second segment and its release finish before the four-second parent note would end');
 stage='cancel save';const saved=fs.readFileSync(selectedPath);cancelSave=true;assert.match(await run(),/canceled/);assert.ok(fs.readFileSync(selectedPath).equals(saved));cancelSave=false;
 stage='cancel rendering';await evaluate(`s.segment=null;s.project.notes=[{id:1,instrument:0,start:0,length:128000,pitch:72,volume:10}];commands.refresh();document.getElementById('export-run').click()`);
 await wait(()=>Promise.resolve(fs.readdirSync(root).some(f=>f.startsWith('.mml-audio-'))));
 await evaluate(`document.getElementById('audio-export-cancel').click()`);await wait(()=>evaluate(`!document.getElementById('export-run').disabled`));
 assert.match(await evaluate(`document.getElementById('status').textContent`),/canceled/);assert.ok(fs.readFileSync(selectedPath).equals(saved));assert.ok(!fs.readdirSync(root).some(f=>f.startsWith('.mml-audio-')));
 checks.push('Segment only; mute; canceled picker; canceled render preserves existing file and removes temporary output');
 finish();
 }catch(error){finish(error);}}));
require(path.join(process.env.MML_STUDIO_TEST_ROOT||path.resolve(__dirname,'..'),'main.cjs'));
