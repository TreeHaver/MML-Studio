const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
fs.mkdirSync('.validation',{recursive:true});app.setPath('userData',fs.mkdtempSync(path.resolve('.validation/loops-')));
const timer=setTimeout(()=>finish(Error('Loop UI check timed out')),30000);
function finish(error){clearTimeout(timer);fs.writeFileSync('.validation/electron-loops.json',JSON.stringify({passed:!error,error:error?.stack},null,2));app.exit(error?1:0);}
app.on('browser-window-created',(_,win)=>win.webContents.once('did-finish-load',async()=>{try{
 win.setSize(1450,1000);
 const evaluate=code=>win.webContents.executeJavaScript(code,true);
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/commands.js'),import('./dist/painting.js'),import('./dist/appearance.js')]).then(([{state},commands,painting,appearance])=>{window.s=state;window.commands=commands;window.painting=painting;window.appearance=appearance;
 s.project={format:'mml-studio',version:2,name:'Nested loops',grid:4,instruments:[{name:'Piano',color:'#55a9c8'},{name:'Instructions',color:'#f4d35e',isInstructions:true}],notes:[{id:1,instrument:0,start:0,length:224,pitch:60,volume:8},{id:2,instrument:0,start:64,length:32,pitch:64,volume:8},{id:3,instrument:1,start:32,length:1,pitch:-200,volume:0,loopEntry:true,loopCount:3,section:'Verse',tempo:120},{id:4,instrument:1,start:96,length:1,pitch:300,volume:0,loopEntry:true,loopCount:2},{id:5,instrument:1,start:160,length:1,pitch:300,volume:0,loopExit:true,loopTie:true},{id:6,instrument:1,start:224,length:1,pitch:300,volume:0,loopExit:true,loopTie:true}]};s.active=1;s.selection=new Set([3]);s.zoom=2.5;commands.refresh();document.getElementById('view').scrollLeft=0;document.getElementById('view').scrollTop=980;painting.draw();})`);
 const settle=()=>evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await settle();
 assert.deepEqual(await evaluate(`['pitch-field','length-field','volume-field','loop-count-field','loop-tie-field'].map(id=>getComputedStyle(document.getElementById(id)).display==='none')`),[true,true,true,false,true]);
 const click=async(x,y)=>{const p=await evaluate(`(()=>{const r=document.getElementById('canvas').getBoundingClientRect();return {x:Math.round(r.x+${x}),y:Math.round(r.y+${y})};})()`);win.webContents.sendInputEvent({type:'mouseDown',...p,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...p,button:'left',clickCount:1});await settle();};
 await evaluate('s.active=0;s.selection.clear();commands.refresh();painting.draw()');
 await click(62+96*2.5+5,400);assert.deepEqual(await evaluate('[s.active,[...s.selection][0]]'),[1,4]);
 await evaluate('s.active=0;s.selection.clear();commands.refresh();painting.draw()');
 await click(62+224*2.5+35,44);assert.deepEqual(await evaluate('[s.active,[...s.selection][0]]'),[1,6]);
 assert.deepEqual(await evaluate(`['loop-count-field','loop-tie-field'].map(id=>getComputedStyle(document.getElementById(id)).display==='none')`),[true,false]);
 await evaluate('s.selection=new Set([3]);commands.refresh();painting.draw()');await settle();
 fs.writeFileSync('.validation/electron-loops.png',(await win.webContents.capturePage()).toPNG());
 await evaluate("document.querySelector('[data-theme=night]').click();painting.draw()");await settle();fs.writeFileSync('.validation/electron-loops-night.png',(await win.webContents.capturePage()).toPNG());
 await evaluate(`s.project.notes=s.project.notes.filter(n=>n.id!==6);commands.refresh();painting.draw()`);
 assert.match(await evaluate(`document.getElementById('loop-warning').textContent`),/no Exit/);
 fs.writeFileSync('.validation/electron-loops-unmatched.png',(await win.webContents.capturePage()).toPNG());finish();
 }catch(error){finish(error);}}));
require('../main.cjs');


