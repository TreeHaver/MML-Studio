const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
fs.mkdirSync('.validation',{recursive:true});const root=fs.mkdtempSync(path.resolve('.validation/sheets-'));app.setPath('userData',path.join(root,'profile'));app.disableHardwareAcceleration();
let started=false,stage='startup',written=[];const timer=setTimeout(()=>finish(Error('Timed out: '+stage)),30000);
function finish(error){clearTimeout(timer);fs.writeFileSync('.validation/electron-sheets.json',JSON.stringify({passed:!error,error:error?.stack,stage,files:written},null,2));app.exit(error?1:0);}
dialog.showSaveDialog=async(_,options)=>{const filePath=path.join(root,options.defaultPath);written.push(filePath);return {canceled:false,filePath};};
app.on('browser-window-created',(_,win)=>{if(started)return;started=true;win.webContents.once('did-finish-load',async()=>{try{
 const evaluate=code=>{stage=code;return win.webContents.executeJavaScript(code,true);};
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/commands.js'),import('./dist/painting.js'),import('./dist/music/sheets.js')]).then(([{state},{refresh},{draw},{createSheetPlanner}])=>{window.s=state;window.refresh=refresh;window.paint=draw;window.planner=createSheetPlanner;s.project.instruments=[{name:'Sheet test',color:'#aabbcc'}];s.project.notes=Array.from({length:40},(_,i)=>({id:i,instrument:0,start:i*8,length:8,pitch:60+i%3,volume:i?null:9}));s.active=0;s.zoom=1;refresh();document.getElementById('view').scrollLeft=0;const input=document.getElementById('character-limit');input.value='60';input.dispatchEvent(new Event('change'));})`);
 assert.equal(await evaluate(`localStorage.getItem('mml-studio-character-limit')`),'60');
 const marker=await evaluate(`(()=>{const cut=planner(s.project,0,60).next(0).end;const c=document.getElementById('canvas');const pixel=Array.from(c.getContext('2d').getImageData(Math.round((62+cut)*devicePixelRatio),Math.round(50*devicePixelRatio),1,1).data);return {cut,pixel};})()`);assert.deepEqual(marker.pixel,[229,57,53,255]);
 await evaluate(`s.project.notes=s.project.notes.map(n=>({...n,start:n.start*2,length:n.length*2}));refresh();`);
 assert.notEqual(await evaluate(`planner(s.project,0,60).next(0).end`),marker.cut);
 await evaluate(`document.getElementById('scope-selected').checked=true;document.getElementById('scope-all').checked=false;document.getElementById('export-run').click()`);assert.equal(await evaluate(`document.getElementById('export-limit-dialog').open`),true);
 assert.equal(await evaluate(`document.getElementById('export-limit-single').textContent`),'Yes, and in a single file');
 await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 fs.writeFileSync('.validation/electron-sheets.png',(await win.webContents.capturePage()).toPNG());
 await evaluate(`document.getElementById('export-limit-no').click();new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);assert.equal(written.length,0);
 await evaluate(`document.getElementById('export-run').click();document.getElementById('export-limit-single').click();new Promise(r=>setTimeout(r,100))`);assert.equal(written.length,1);
 await evaluate(`document.getElementById('export-run').click();document.getElementById('export-limit-parts').click();new Promise(r=>setTimeout(r,200))`);assert.ok(written.length>2);
 for(const file of written.slice(1)){const xml=fs.readFileSync(file,'utf8'),text=[...xml.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)].map(m=>m[1]).join('');assert.ok(text.length<=60);}
 assert.match(await evaluate(`document.getElementById('status').textContent`),/^Exported/);
 stage='completed native canvas, setting persistence, dialog choices and IPC file writes (save picker stubbed)';finish();
 }catch(error){finish(error);}});});require('../main.cjs');
