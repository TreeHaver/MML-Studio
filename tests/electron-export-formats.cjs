// Native check of the export dialog's formats and of the in-app colour panel.
// Files are written through the real IPC handlers with only the OS save dialog stubbed.
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
fs.mkdirSync('.validation',{recursive:true});
const root=fs.mkdtempSync(path.resolve('.validation/export-formats-'));
app.setPath('userData',path.join(root,'profile'));app.disableHardwareAcceleration();
let started=false,stage='startup';const written=[],checks=[];
const timer=setTimeout(()=>finish(Error('Timed out: '+stage)),40000);
function finish(error){clearTimeout(timer);fs.writeFileSync('.validation/electron-export-formats.json',JSON.stringify({passed:!error,error:error?.stack,stage,checks},null,2));app.exit(error?1:0);}
dialog.showSaveDialog=async(_,options)=>{const filePath=path.join(root,options.defaultPath);written.push(filePath);return {canceled:false,filePath};};
app.on('browser-window-created',(_,win)=>{if(started)return;started=true;win.webContents.once('did-finish-load',async()=>{try{
 const evaluate=code=>{stage=code;return win.webContents.executeJavaScript(code,true);};
 const settle=()=>evaluate(`new Promise(r=>{const done=()=>r(1);requestAnimationFrame(()=>requestAnimationFrame(done));setTimeout(done,150);})`);
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/commands.js')]).then(([{state},commands])=>{
  window.s=state;window.commands=commands;
  s.project={format:'mml-studio',version:2,grid:4,name:'Format check',instruments:[{name:'Piano',color:'#FF9C33',midiProgram:0}],notes:[{id:1,instrument:0,start:0,length:128,pitch:60,volume:9},{id:2,instrument:0,start:128,length:128,pitch:64,volume:9}]};
  s.active=0;s.selection.clear();commands.refresh();
 })`);
 await settle();

 // The dialog replaces the old dropdown and offers every format, MS2MML first.
 await evaluate(`document.getElementById('export-open').click()`);await settle();
 assert.equal(await evaluate(`document.getElementById('export-dialog').open`),true,'Export opens a dialog');
 assert.equal(await evaluate(`document.getElementById('export-run').textContent`),'Export','One action, so it is obvious which button exports');
 assert.deepEqual(await evaluate(`[...document.querySelectorAll('.export-format input')].map(i=>i.id)`),
  ['format-ms2mml','format-text','format-midi','format-audio']);
 assert.equal(await evaluate(`document.getElementById('format-ms2mml').checked`),true,'MS2MML is the default format');
 await evaluate(`document.getElementById('export-cancel').click()`);await settle();
 assert.equal(await evaluate(`document.getElementById('export-dialog').open`),false,'Cancel closes the dialog');

 const exportWith=async(id,everything)=>{
  await evaluate(`document.getElementById('${id}').checked=true;${everything?`document.getElementById('scope-all').checked=true;document.getElementById('scope-selected').checked=false;`:`document.getElementById('scope-selected').checked=true;document.getElementById('scope-all').checked=false;`}`);
  await evaluate(`document.getElementById('export-run').click()`);
  await new Promise(resolve=>setTimeout(resolve,700));
  return evaluate(`document.getElementById('status').textContent`);
 };
 assert.match(await exportWith('format-ms2mml',false),/Exported 1 file/);
 assert.match(await exportWith('format-text',false),/Exported 1 file/);
 assert.match(await exportWith('format-midi',true),/Exported 1 MIDI file/);

 const files=written.map(file=>({name:path.basename(file),bytes:fs.readFileSync(file)}));
 assert.deepEqual(files.map(f=>f.name),['Piano.ms2mml','Piano.txt','Format check.mid']);
 assert.match(files[0].bytes.toString('utf8'),/^<\?xml/,'MS2MML stays the XML sheet');
 assert.match(files[1].bytes.toString('utf8'),/^t120/,'The text file holds the instrument MML');
 assert.equal(files[2].bytes.slice(0,4).toString('ascii'),'MThd','MIDI export writes a standard MIDI header');
 checks.push({files:files.map(f=>({name:f.name,size:f.bytes.length}))});

 // Chromium's colour dialog is an OS window; the swatch opens our own picker instead,
 // which must still reach every colour, not only the presets.
 assert.equal(await evaluate(`!!document.querySelector('.instrument input[type=color]')`),false,'No native colour input remains');
 await evaluate(`document.querySelector('.color-swatch').click()`);await settle();
 const panel=await evaluate(`(()=>{const p=document.querySelector('.color-panel'),r=p.getBoundingClientRect();
  return {area:!!p.querySelector('.color-area'),hue:!!p.querySelector('.color-hue'),hex:!!p.querySelector('.color-hex'),
   presets:p.querySelectorAll('.color-cell').length,current:p.querySelectorAll('.color-cell.current').length,
   inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight};})()`);
 assert.ok(panel.area&&panel.hue&&panel.hex,'The picker offers a shade square, a hue bar and a hex field');
 assert.equal(panel.presets,12,'The project colours are offered as presets');
 assert.equal(panel.current,1,'The current colour is marked');
 assert.ok(panel.inside,'The panel stays inside the window');
 // Any colour: a hex value that is in no preset.
 await evaluate(`(()=>{const field=document.querySelector('.color-hex');field.value='#123ABC';
  field.dispatchEvent(new Event('input',{bubbles:true}));
  field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`);await settle();
 assert.equal(await evaluate(`s.project.instruments[0].color`),'#123ABC','A typed colour outside the presets is accepted');
 assert.equal(await evaluate(`!document.querySelector('.color-panel')`),true,'Entering a hex value closes the panel');
 // Dragging the shade square reaches colours no list could hold. Synthetic PointerEvents
 // carry no real pointer id, so setPointerCapture would reject them: drive real input.
 await evaluate(`document.querySelector('.color-swatch').click()`);await settle();
 const area=await evaluate(`(()=>{const r=document.querySelector('.color-area').getBoundingClientRect();
  return {x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)};})()`);
 const spot=(fx,fy)=>({x:Math.round(area.x+area.w*fx),y:Math.round(area.y+area.h*fy)});
 win.webContents.sendInputEvent({type:'mouseDown',...spot(.5,.5),button:'left',clickCount:1});
 win.webContents.sendInputEvent({type:'mouseMove',...spot(.72,.31),button:'left',modifiers:['leftButtonDown']});
 win.webContents.sendInputEvent({type:'mouseUp',...spot(.72,.31),button:'left',clickCount:1});
 await settle();await settle();
 const dragged=await evaluate(`s.project.instruments[0].color`);
 assert.match(dragged,/^#[0-9A-F]{6}$/,'Dragging the square commits a colour');
 assert.notEqual(dragged,'#123ABC','and it is a different colour from the typed one');
 await evaluate(`document.querySelectorAll('.color-panel .color-cell')[3].click()`);await settle();
 assert.equal(await evaluate(`s.project.instruments[0].color`),'#63CE6B','A preset is still one click');
 assert.equal(await evaluate(`!document.querySelector('.color-panel')`),true,'A preset closes the panel');
 await evaluate(`document.querySelector('.color-swatch').click()`);await settle();
 await evaluate(`document.dispatchEvent(new KeyboardEvent('keyup',{key:'Escape',bubbles:true}))`);await settle();
 assert.equal(await evaluate(`!document.querySelector('.color-panel')`),true,'Escape closes the panel');
 checks.push({panel,dragged});

 // The caption no longer repeats the selected instrument, which the panel already shows.
 assert.equal(await evaluate(`!!document.getElementById('editing-instrument')`),false);
 assert.ok(await evaluate(`(()=>{const a=document.getElementById('zoom').getBoundingClientRect(),b=document.getElementById('vertical-zoom').getBoundingClientRect();return b.left-a.right>=8&&Math.abs(b.top-a.top)<1})()`),'Zoom sliders keep separate hit areas');
 fs.writeFileSync('.validation/electron-export-formats.png',(await win.webContents.capturePage()).toPNG());
 finish();
 }catch(error){finish(error);}});});
require('../main.cjs');
