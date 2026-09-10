const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
fs.mkdirSync('.validation',{recursive:true});const root=fs.mkdtempSync(path.resolve('.validation/sheets-'));app.setPath('userData',path.join(root,'profile'));app.disableHardwareAcceleration();
let started=false,stage='startup',written=[];const timer=setTimeout(()=>finish(Error('Timed out: '+stage)),30000);
function finish(error){clearTimeout(timer);fs.writeFileSync('.validation/electron-sheets.json',JSON.stringify({passed:!error,error:error?.stack,stage,files:written},null,2));app.exit(error?1:0);}
dialog.showSaveDialog=async(_,options)=>{const filePath=path.join(root,path.basename(options.defaultPath));written.push(filePath);return {canceled:false,filePath};};
dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});
app.on('browser-window-created',(_,win)=>{if(started)return;started=true;win.webContents.once('did-finish-load',async()=>{try{
 const evaluate=code=>{stage=code;return win.webContents.executeJavaScript(code,true);};
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/commands.js'),import('./dist/painting.js'),import('./dist/music/sheets.js')]).then(([{state},{refresh},{draw},{createSheetPlanner}])=>{window.s=state;window.refresh=refresh;window.paint=draw;window.planner=createSheetPlanner;s.project.instruments=[{name:'Sheet test',color:'#aabbcc'}];s.project.notes=Array.from({length:40},(_,i)=>({id:i,instrument:0,start:i*8,length:8,pitch:60+i%3,volume:i?null:9}));s.active=0;s.zoom=1;refresh();document.getElementById('view').scrollLeft=0;const input=document.getElementById('character-limit');input.value='60';input.dispatchEvent(new Event('change'));})`);
 assert.equal(await evaluate(`localStorage.getItem('mml-studio-character-limit')`),'60');
 const marker=await evaluate(`(()=>{const cut=planner(s.project,0,60).next(0).end;const c=document.getElementById('canvas');const pixel=Array.from(c.getContext('2d').getImageData(Math.round((62+cut)*devicePixelRatio),Math.round(50*devicePixelRatio),1,1).data);return {cut,pixel};})()`);assert.deepEqual(marker.pixel,[229,57,53,255]);
 await evaluate(`s.project.notes=s.project.notes.map(n=>({...n,start:n.start*2,length:n.length*2}));refresh();`);
 assert.notEqual(await evaluate(`planner(s.project,0,60).next(0).end`),marker.cut);
 await evaluate(`document.getElementById('scope-selected').checked=true;document.getElementById('export-run').click()`);assert.equal(await evaluate(`document.getElementById('export-limit-dialog').open`),true);
 assert.equal(await evaluate(`document.getElementById('export-limit-single').textContent`),'Yes, and in a single file');
 await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 fs.writeFileSync('.validation/electron-sheets.png',(await win.webContents.capturePage()).toPNG());
 await evaluate(`document.getElementById('export-limit-no').click();new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);assert.equal(written.length,0);
 await evaluate(`document.getElementById('export-run').click();document.getElementById('export-limit-single').click();new Promise(r=>setTimeout(r,100))`);assert.equal(written.length,1);
 await evaluate(`document.getElementById('export-run').click();document.getElementById('export-limit-parts').click();new Promise(r=>setTimeout(r,300))`);
 assert.equal(written.length,1,'Several files ask once for a place, not once per file');
 const folder=path.join(root,'Sheet test'),parts=fs.readdirSync(folder);
 assert.ok(parts.length>=2,'The split lands as several files in one folder');
 assert.equal(parts[0],'Sheet test-part-01.ms2mml');
 for(const part of parts){const xml=fs.readFileSync(path.join(folder,part),'utf8'),text=[...xml.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)].map(m=>m[1]).join('');assert.ok(text.length<=60);}
 // Ticking the archive box delivers the same set as one .zip instead.
 await evaluate(`(()=>{const box=document.getElementById('export-zip');box.checked=true;box.dispatchEvent(new Event('change'));})()`);
 await evaluate(`document.getElementById('export-run').click();document.getElementById('export-limit-parts').click();new Promise(r=>setTimeout(r,300))`);
 const archive=written.at(-1);
 assert.equal(path.basename(archive),'Sheet test.zip','One archive, named after the instrument');
 assert.ok(fs.statSync(archive).size>100,'The archive holds the parts');
 assert.equal(fs.readFileSync(archive).subarray(0,2).toString('ascii'),'PK','It is a zip container');
 assert.match(await evaluate(`document.getElementById('status').textContent`),/^Exported/);
 // Channel overflow choices use a native HTML dialog and the real export IPC.
 await evaluate(`document.getElementById('export-zip').checked=false;const limit=document.getElementById('character-limit');limit.value='10000';limit.dispatchEvent(new Event('change'));s.project.notes=Array.from({length:11},(_,i)=>({id:i+1,instrument:0,start:0,length:32,pitch:60+i,volume:8}));s.selection=new Set([1]);refresh();`);
 const sourceBefore=await evaluate('JSON.stringify([s.project,s.history,s.dirty])'),writeCount=written.length;
 await evaluate(`document.getElementById('export-run').click()`);
 assert.equal(await evaluate(`document.getElementById('export-channel-dialog').open`),true);
 assert.match(await evaluate(`document.getElementById('export-channel-message').textContent`),/11 channels/);
 await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 fs.writeFileSync('.validation/electron-export-channels.png',(await win.webContents.capturePage()).toPNG());
 await evaluate(`document.getElementById('export-channel-cancel').click();new Promise(r=>setTimeout(r,50))`);assert.equal(written.length,writeCount);
 await evaluate(`document.getElementById('export-run').click();document.getElementById('export-channel-dialog').dispatchEvent(new Event('cancel',{cancelable:true}));new Promise(r=>setTimeout(r,50))`);assert.equal(written.length,writeCount);
 await evaluate(`document.getElementById('export-run').click();document.getElementById('export-channel-continue').click();new Promise(r=>setTimeout(r,100))`);
 assert.equal(written.length,writeCount+1);assert.equal((fs.readFileSync(written.at(-1),'utf8').match(/CDATA/g)||[]).length,11);
 await evaluate(`document.getElementById('export-run').click();document.getElementById('export-channel-fit').click();new Promise(r=>setTimeout(r,100))`);
 assert.equal(written.length,writeCount+2);assert.equal((fs.readFileSync(written.at(-1),'utf8').match(/CDATA/g)||[]).length,2);
 assert.equal(await evaluate('JSON.stringify([s.project,s.history,s.dirty])'),sourceBefore);
 await evaluate(`document.getElementById('format-text').checked=true;document.getElementById('export-run').click();document.getElementById('export-channel-fit').click();new Promise(r=>setTimeout(r,100))`);
 assert.equal(written.length,writeCount+3);assert.match(written.at(-1),/\.txt$/);assert.equal(fs.readFileSync(written.at(-1),'utf8').trim().split('\n\n').length,2);
 await evaluate(`s.project.notes=s.project.notes.map((n,i)=>({...n,length:32+i}));document.getElementById('export-run').click();document.getElementById('export-channel-fit').click();new Promise(r=>setTimeout(r,100))`);
 assert.equal(written.length,writeCount+3);assert.match(await evaluate(`document.getElementById('status').textContent`),/Export failed:.*still requires 11 channels/);
 assert.equal(await evaluate(`document.getElementById('export-run').disabled`),false);
 stage='completed native canvas, setting persistence, dialog choices and IPC file writes (save picker stubbed)';finish();
 }catch(error){finish(error);}});});require('../main.cjs');
