const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
fs.mkdirSync('.validation',{recursive:true});const root=fs.mkdtempSync(path.resolve('.validation/structure-'));app.setPath('userData',path.join(root,'profile'));app.disableHardwareAcceleration();
let started=false,stage='startup',written=[];const timer=setTimeout(()=>finish(Error('Timed out: '+stage)),30000);
function finish(error){clearTimeout(timer);fs.writeFileSync('.validation/electron-structure.json',JSON.stringify({passed:!error,error:error?.stack,stage,files:written},null,2));app.exit(error?1:0);}
dialog.showSaveDialog=async(_,options)=>{const filePath=path.join(root,path.basename(options.defaultPath));written.push(filePath);return {canceled:false,filePath};};
dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});
app.on('browser-window-created',(_,win)=>{if(started)return;started=true;win.webContents.once('did-finish-load',async()=>{try{
 const evaluate=code=>{stage=code;return win.webContents.executeJavaScript(code,true);};
 await evaluate(`import("./dist/music/pitch-layout.js").then(layout=>{window.pitchTop=layout.pitchTop;window.pitchHeight=layout.pitchHeight;})`);
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/commands.js'),import('./dist/music/structure.js')]).then(([{state},{refresh},{measureLines}])=>{window.s=state;window.refresh=refresh;window.lines=measureLines;s.project.instruments=[{name:'Piano',color:'#ff9c33'},{name:'Flute',color:'#35c0e8'},{name:'Instructions',color:'#f4d35e',isInstructions:true}];s.project.notes=[{id:1,instrument:0,start:0,length:96,pitch:60,volume:8},{id:2,instrument:1,start:128,length:96,pitch:67,volume:9},{id:3,instrument:2,start:128,length:1,pitch:60,volume:0}];s.active=2;s.selection=new Set([3]);s.zoom=3;refresh();document.getElementById('view').scrollTop=pitchTop(s.topPitch,70);})`);
 await evaluate(`(()=>{for(const [id,value] of [['project-name','Three-quarter suite'],['time-signature','3/4'],['section-name','Second song']]){const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('change'));}const e=document.getElementById('section-reset');e.checked=true;e.dispatchEvent(new Event('change'));})()`);
 assert.deepEqual(await evaluate(`lines(s.project,128,225).filter(l=>l.major).map(l=>[l.tick,l.bar])`),[[128,1],[224,2]]);
 assert.equal(await evaluate(`document.getElementById('section-control').hidden`),false);
 await evaluate(`document.getElementById('section-nav').value='128';document.getElementById('section-nav').dispatchEvent(new Event('change'))`);
 assert.equal(await evaluate(`document.getElementById('view').scrollLeft`),384);
 await evaluate(`document.getElementById('save').onclick()`);assert.equal(path.basename(written[0]),'Three-quarter suite.json');
 assert.equal(JSON.parse(fs.readFileSync(written[0],'utf8')).notes[2].resetMeasures,true);
 await evaluate(`document.getElementById('export-sections').checked=true;document.getElementById('scope-selected').checked=false;document.getElementById('export-run').onclick()`);
 assert.equal(written.length,1,'Several files ask once for a place, not once per file');
 assert.deepEqual(fs.readdirSync(path.join(root,'Three-quarter suite')),['01-Opening-Piano.ms2mml','02-Second song-Flute.ms2mml']);
 await evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
 assert.equal(await evaluate(`document.getElementById('export-open').getBoundingClientRect().right<=innerWidth`),true);
 fs.writeFileSync('.validation/electron-structure.png',(await win.webContents.capturePage()).toPNG());
 win.setSize(900,700);await evaluate(`new Promise(r=>setTimeout(r,150))`);
 assert.equal(await evaluate(`document.getElementById('export-open').getBoundingClientRect().right<=innerWidth`),true);
 stage='completed native editing, section navigation, reset alignment, responsive header and IPC saves/exports; OS picker stubbed';finish();
 }catch(error){finish(error);}});});require('../main.cjs');
