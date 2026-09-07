// Native renderer and real save/export IPC; OS file picker is stubbed.
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
fs.mkdirSync('.validation',{recursive:true});const root=fs.mkdtempSync(path.resolve('.validation/segment-view-'));app.setPath('userData',path.join(root,'profile'));app.disableHardwareAcceleration();
let started=false,stage='startup';const checks=[],written=[];const timer=setTimeout(()=>finish(Error('Timed out: '+stage)),40000);
function finish(error){clearTimeout(timer);fs.writeFileSync('.validation/electron-segment-view.json',JSON.stringify({passed:!error,error:error?.stack,stage,checks,files:written},null,2));app.exit(error?1:0);}
dialog.showSaveDialog=async(_,options)=>{const filePath=path.join(root,options.defaultPath);written.push(filePath);return {canceled:false,filePath};};
app.on('browser-window-created',(_,win)=>{if(started)return;started=true;win.webContents.once('did-finish-load',async()=>{try{
 const evaluate=code=>{stage=code;return win.webContents.executeJavaScript(code,true);};
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/commands.js'),import('./dist/playback/transport.js'),import('./dist/music/mml.js'),import('./dist/history.js')]).then(([{state},{refresh},transport,{generateMml},history])=>{window.s=state;window.refresh=refresh;window.transport=transport;window.generateMml=generateMml;window.historyApi=history;s.project.name='Album';s.project.instruments=[{name:'Piano',color:'#ff9c33',midiProgram:0},{name:'Instructions',color:'#f4d35e',isInstructions:true}];s.project.notes=[{id:1,instrument:0,start:0,length:16,pitch:60,volume:5,tempo:90},{id:2,instrument:0,start:70,length:150,pitch:60,volume:null},{id:3,instrument:0,start:110,length:12,pitch:64,volume:null},{id:4,instrument:0,start:230,length:100,pitch:67,volume:null},{id:5,instrument:1,start:0,length:1,pitch:60,volume:0,section:'First Song',resetMeasures:true,timeSignature:'6/8'},{id:6,instrument:1,start:96,length:1,pitch:60,volume:0,section:'Solo'},{id:7,instrument:1,start:160,length:1,pitch:60,volume:0,section:'Chorus',tempo:150},{id:8,instrument:1,start:256,length:1,pitch:60,volume:0,section:'Second Song',resetMeasures:true}];for(let i=0;i<12;i++)s.project.notes.push({id:20+i,instrument:0,start:270,length:40,pitch:60+i,volume:null});s.active=0;s.zoom=3;s.dirty=false;window.originalAlbum=JSON.stringify(s.project);refresh();document.getElementById('view').scrollTop=(s.topPitch-72)*20;transport.seekToTick(120);})`);
 assert.ok(await evaluate(`generateMml(s.project,0).channels.length>10`));
 await evaluate(`document.getElementById('open-song').click()`);
 assert.equal(await evaluate(`s.segment.projection.range.end`),256);assert.equal(await evaluate(`document.getElementById('section-control').hidden`),false);
 await evaluate(`transport.seekToTick(120);document.getElementById('open-segment').click()`);
 assert.deepEqual(await evaluate(`s.project.notes.filter(n=>n.instrument===0).map(n=>[n.start,n.length])`),[[0,64],[14,12]]);
 assert.equal(await evaluate(`document.getElementById('segment-view-label').textContent`),'Segment: Solo');assert.equal(await evaluate(`document.getElementById('project-name').value`),'Album');
 assert.equal(await evaluate(`document.getElementById('section-control').hidden`),true);assert.equal(await evaluate(`generateMml(s.project,0).channels.length`),2);
 const channels=await evaluate(`generateMml(s.project,0).channels`),bytes=channels.join('').length;
 await evaluate(`document.getElementById('export-sections').checked=true;document.getElementById('export-project').onclick()`);
 assert.equal(path.basename(written[0]),'Solo-Piano.ms2mml');const xml=fs.readFileSync(written[0],'utf8');assert.deepEqual([...xml.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)].map(m=>m[1]),channels);assert.ok(!xml.includes('t150'));
 await evaluate(`document.getElementById('save').onclick()`);assert.deepEqual(JSON.parse(fs.readFileSync(written[1],'utf8')),JSON.parse(await evaluate(`originalAlbum`)));
 await evaluate(`(()=>{const limit=document.getElementById('character-limit');limit.value='${bytes}';limit.dispatchEvent(new Event('change'));})()`);
 assert.ok(await evaluate(`(()=>{const c=document.getElementById('canvas'),ctx=c.getContext('2d'),ratio=devicePixelRatio,p=ctx.getImageData(Math.round((62+64*3)*ratio),Math.round(100*ratio),1,1).data;return p[0]===229&&p[1]===57&&p[2]===53;})()`),'Limit marker uses local segment MML count');
 checks.push({rootChannels:'>10',segmentChannels:2,segmentBytes:bytes,exportMatchesView:true,untouchedSavePreservesAlbum:true});
 await evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);fs.writeFileSync('.validation/electron-segment-view.png',(await win.webContents.capturePage()).toPNG());
 await evaluate(`s.selection=new Set([2]);refresh();const pitch=document.getElementById('pitch');pitch.value='72';pitch.dispatchEvent(new Event('change'));`);
 assert.deepEqual(await evaluate(`s.segment.root.notes.filter(n=>n.instrument===0&&n.start>=70&&n.start<=160&&[60,72].includes(n.pitch)).map(n=>[n.start,n.length,n.pitch])`),[[70,26,60],[96,64,72],[160,60,60]]);
 await evaluate(`document.getElementById('save').onclick()`);const saved=JSON.parse(fs.readFileSync(written.at(-1),'utf8'));assert.ok(saved.notes.some(n=>n.start===96&&n.length===64&&n.pitch===72));assert.ok(saved.notes.some(n=>n.start===270));
 await evaluate(`document.getElementById('return-project').click();historyApi.undo()`);assert.equal(await evaluate(`JSON.stringify(s.project)===originalAlbum`),true);
 await evaluate(`transport.seekToTick(280);document.getElementById('open-song').click()`);assert.equal(await evaluate(`document.getElementById('section-control').hidden`),true);
 win.setSize(900,700);await evaluate(`new Promise(r=>setTimeout(r,150))`);
 assert.ok(await evaluate(`document.getElementById('export-menu').getBoundingClientRect().right<=innerWidth`),'Header fits 900px');
 assert.ok(await evaluate(`(()=>{const p=document.getElementById('project-name').getBoundingClientRect(),badge=document.getElementById('segment-view-label').getBoundingClientRect();return badge.left>=p.right&&badge.right<=innerWidth;})()`),'View name is next to the Project input');
 checks.push('Edited note is split only inside view; saved album/return/undo and 900px header verified');stage='completed';finish();
 }catch(error){finish(error);}});});require('../main.cjs');
