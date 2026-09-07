const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
fs.mkdirSync('.validation',{recursive:true});app.setPath('userData',path.resolve(fs.mkdtempSync('.validation/ui-test-')));app.disableHardwareAcceleration();
// Every check runs and reports: one broken area used to hide the other forty assertions.
let stage='startup',started=false;const failures=[],passes=[];
fs.writeFileSync('.validation/electron-ui.json',JSON.stringify({running:true}));
const timer=setTimeout(()=>finish(Error('UI check timed out: '+stage)),90000);
function finish(fatal){
 clearTimeout(timer);
 const passed=!fatal&&!failures.length;
 fs.writeFileSync('.validation/electron-ui.json',JSON.stringify({passed,checked:passes.length+failures.length,passes,failures,fatal:fatal?`${fatal.stack}\nStage: ${stage}`:undefined},null,2));
 app.exit(passed?0:1);
}
app.on('browser-window-created',(_,win)=>{if(started)return;started=true;win.webContents.setBackgroundThrottling(false);win.webContents.once('did-finish-load',async()=>{try{
 const evaluate=code=>{stage=code;return win.webContents.executeJavaScript(code,true);};
 const frame=()=>evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
 // Wait for the state the step is meant to produce, instead of guessing at a couple of frames.
 const until=async(expression,what,ms=5000)=>{
  const deadline=Date.now()+ms;
  for(;;){
   if(await evaluate(expression))return;
   if(Date.now()>deadline)throw Error(`timed out after ${ms}ms waiting for ${what}`);
   await new Promise(resolve=>setTimeout(resolve,16));
  }
 };
 const check=async(name,body)=>{
  try{await body();passes.push(name);}
  catch(error){failures.push({check:name,error:String(error&&error.message||error).split('\n').slice(0,3).join(' | '),stage});}
 };
 const press=(point,extra)=>win.webContents.sendInputEvent({type:'mouseDown',...point,button:'left',clickCount:1,...extra});
 const release=point=>win.webContents.sendInputEvent({type:'mouseUp',...point,button:'left',clickCount:1});
 const move=(point,held)=>win.webContents.sendInputEvent({type:'mouseMove',...point,...(held?{button:'left',modifiers:['leftButtonDown']}:{})});
 const dividerBox=id=>evaluate(`(()=>{const r=document.getElementById('${id}').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+120)};})()`);
 // A divider drag only starts once the handler has captured the pointer, so wait for its class.
 const dragDivider=async(id,dx,settled)=>{
  const from=await dividerBox(id);win.focus();win.webContents.focus();
  move(from);press(from);
  await until(`document.documentElement.classList.contains('resizing')`,'the divider drag to start');
  const to={x:from.x+dx,y:from.y};
  move(to,true);
  await until(settled,'the drag to take effect');
  release(to);
  await until(`!document.documentElement.classList.contains('resizing')`,'the divider drag to finish');
  await frame();
 };
 const dragCanvas=async(from,to,settled)=>{
  win.focus();win.webContents.focus();
  move(from);press(from);await frame();
  if(to)move(to,true);
  release(to??from);
  await until(settled,'the roll edit to land');
 };

 await evaluate(`import("./dist/music/pitch-layout.js").then(layout=>{window.pitchTop=layout.pitchTop;window.pitchHeight=layout.pitchHeight;})`);

 await check('startup chrome and toolbar icons',async()=>{
  assert.equal(await evaluate(`document.documentElement.dataset.theme`),'sky');
  assert.equal(await evaluate(`document.getElementById('play').disabled`),true);
  assert.equal(await evaluate(`document.querySelectorAll('.transport-button svg').length`),6);
  assert.equal(await evaluate(`document.querySelectorAll('.panel-toggle svg').length`),2);
  assert.equal(await evaluate(`document.querySelectorAll('.history-controls svg.lucide').length`),3);
  assert.equal(await evaluate(`getComputedStyle(document.getElementById('undo')).width`),'36px');
  assert.equal(await evaluate(`getComputedStyle(document.getElementById('undo')).borderTopWidth`),'1px');
  assert.notEqual(await evaluate(`getComputedStyle(document.getElementById('undo')).borderTopColor`),'rgba(0, 0, 0, 0)');
  assert.equal(await evaluate(`document.querySelectorAll('#file-menu .menu-panel button svg').length`),4);
 });

 await check('dragging a divider resizes its panel',async()=>{
  const before=await evaluate(`document.getElementById('track-panel').getBoundingClientRect().width`);
  await dragDivider('left-divider',50,`document.getElementById('track-panel').getBoundingClientRect().width>${before}+30`);
  assert.ok(await evaluate(`document.getElementById('track-panel').getBoundingClientRect().width`)>before+30,
   'the panel should have widened, grid is '+await evaluate(`document.getElementById('workspace').style.gridTemplateColumns`));
 });

 await check('dragging a divider shut closes the panel, dragging out reopens it',async()=>{
  await dragDivider('left-divider',-300,`document.getElementById('track-panel').hidden`);
  assert.equal(await evaluate(`document.getElementById('track-panel').hidden`),true,'dragging the divider shut hides the panel');
  await dragDivider('left-divider',220,`!document.getElementById('track-panel').hidden`);
  assert.equal(await evaluate(`document.getElementById('track-panel').hidden`),false,'dragging back out reopens it');
  assert.ok(await evaluate(`document.getElementById('track-panel').getBoundingClientRect().width`)>180);
 });

 await check('panel toggles hide a panel without starving the editor',async()=>{
  await evaluate(`document.getElementById('toggle-left').click()`);
  await until(`document.getElementById('track-panel').hidden`,'the instruments panel to hide');
  assert.ok(await evaluate(`document.querySelector('.editor').getBoundingClientRect().width`)>400);
  assert.ok(await evaluate(`document.getElementById('note-properties').getBoundingClientRect().width`)>180);
  await evaluate(`document.getElementById('toggle-left').click()`);
  await until(`!document.getElementById('track-panel').hidden`,'the instruments panel to come back');
 });

 await check('keyboard resize and double-click default are stored',async()=>{
  await evaluate(`document.getElementById('left-divider').dispatchEvent(new MouseEvent('dblclick'));document.getElementById('right-divider').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}))`);
  await until(`JSON.parse(localStorage.getItem('mml-studio-workspace-v1')).right===250`,'the stored right width');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('mml-studio-workspace-v1')).right`),250);
  await evaluate(`document.getElementById('right-divider').dispatchEvent(new MouseEvent('dblclick'))`);
 });

 await check('brand image loads and the inspector starts empty',async()=>{
  assert.equal(await evaluate(`document.querySelector('.brand img').naturalWidth>0`),true);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.note-fields')).display`),'none');
 });

 await check('menus open, keep their chevron in place and dismiss',async()=>{
  const before=await evaluate(`(()=>{const r=document.querySelector('#file-menu .menu-chevron').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`);
  await evaluate(`document.querySelector('#file-menu summary').click()`);
  assert.equal(await evaluate(`document.getElementById('file-menu').open`),true);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('#file-menu[open] .menu-chevron')).width`),'9px');
  assert.deepEqual(await evaluate(`(()=>{const r=document.querySelector('#file-menu .menu-chevron').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`),before);
  await evaluate(`document.querySelector('.editor-caption').click()`);
  assert.equal(await evaluate(`document.getElementById('file-menu').open`),false);
  await evaluate(`document.querySelector('#export-menu summary').click()`);
  assert.equal(await evaluate(`document.getElementById('export-menu').open`),true);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('#export-menu[open] .menu-chevron')).width`),'9px');
  await evaluate(`document.body.dispatchEvent(new KeyboardEvent('keyup',{key:'Escape',bubbles:true}))`);
  assert.equal(await evaluate(`document.getElementById('export-menu').open`),false);
 });

 await check('a select list can be used without closing the menu holding it',async()=>{
  await evaluate(`document.querySelector('#tools-menu summary').click()`);
  assert.equal(await evaluate(`document.getElementById('tools-menu').open`),true);
  assert.equal(await evaluate(`document.getElementById('simplify-length').parentElement.classList.contains('select-control')`),true);
  await evaluate(`document.getElementById('simplify-length').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))`);
  await until(`document.querySelectorAll('body>.select-panel').length===1`,'the select list to open');
  // The roll scrolls constantly while following playback and must not close an open list.
  await evaluate(`document.getElementById('view').scrollLeft+=120`);
  await frame();
  assert.equal(await evaluate(`document.querySelectorAll('body>.select-panel').length`),1,'scrolling the roll must not close a toolbar list');
  await evaluate(`document.querySelector('body>.select-panel button:nth-child(3)').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
  assert.equal(await evaluate(`document.getElementById('simplify-length').value`),'16');
  assert.equal(await evaluate(`document.getElementById('tools-menu').open`),true,'a click in a select list must not close the menu holding it');
  await evaluate(`document.body.dispatchEvent(new KeyboardEvent('keyup',{key:'Escape',bubbles:true}))`);
  assert.equal(await evaluate(`document.getElementById('tools-menu').open`),false);
 });

 // Fixture for the editing checks below; a failure here is fatal, the rest depends on it.
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/commands.js'),import('./dist/inspector.js')]).then(([{state},{refresh},{info}])=>{window.s=state;window.refresh=refresh;window.info=info;
 s.project.instruments=[{name:'Felt Piano',color:'#78e4c4',midiProgram:0},{name:'Warm Strings',color:'#a998e8',midiProgram:48},{name:'Acoustic Bass',color:'#ebba7b',midiProgram:32},{name:'Soft Bells',color:'#7cbad9',midiProgram:10},{name:'Instructions',color:'#f4d35e',isInstructions:true}];
 s.project.notes=Array.from({length:24},(_,i)=>({id:i+1,instrument:i<16?0:1,start:(i%16)*16,length:i<16?12:32,pitch:[60,64,67,72,71,67,64,62][i%8]-(i>=16?12:0),volume:i===0?10:null}));s.active=0;s.selection=new Set([1,2,3]);refresh();document.getElementById('view').scrollTop=pitchTop(s.topPitch,79);})`);
 await until(`document.getElementById('play').disabled===false`,'the fixture project to load');

 await check('clear all confirms, empties and undoes',async()=>{
  await evaluate(`window.confirm=message=>{window.clearConfirmation=message;return true};document.getElementById('clear-all').click()`);
  assert.match(await evaluate(`window.clearConfirmation`),/^Delete all 24 notes and instructions from this project\?\nYou can undo this action\.$/);
  assert.equal(await evaluate(`s.project.notes.length`),0);
  assert.equal(await evaluate(`document.getElementById('play').disabled&&document.getElementById('clear-all').disabled`),true);
  await evaluate(`document.getElementById('undo').click()`);
  await until(`s.project.notes.length===24`,'undo to restore the notes');
 });

 await check('a click draws inside the cell it landed in',async()=>{
  const cell=await evaluate(`(()=>{const view=document.getElementById('view'),canvas=document.getElementById('canvas'),r=canvas.getBoundingClientRect(),targetPitch=76;view.scrollLeft=0;document.getElementById('draw').click();return {x:Math.round(r.x+62+(128/s.project.grid)*s.zoom*.75),y:Math.round(r.y+30+pitchTop(s.topPitch,targetPitch)-view.scrollTop+pitchHeight(targetPitch)/2)};})()`);
  await dragCanvas(cell,null,`s.project.notes.some(n=>n.pitch===76)`);
  assert.equal(await evaluate(`s.project.notes.find(n=>n.pitch===76)?.start`),0,'a click in the right half of the first cell must stay in that cell');
 });

 await check('dragging while drawing lengthens one note',async()=>{
  const from=await evaluate(`(()=>{const view=document.getElementById('view'),canvas=document.getElementById('canvas'),r=canvas.getBoundingClientRect(),targetPitch=75;return {x:Math.round(r.x+62+(128/s.project.grid)*s.zoom*.25),y:Math.round(r.y+30+pitchTop(s.topPitch,targetPitch)-view.scrollTop+pitchHeight(targetPitch)/2)};})()`);
  await dragCanvas(from,{x:from.x+Math.round((128/4)*3*3),y:from.y},`s.project.notes.some(n=>n.pitch===75&&n.length===128)`);
  assert.deepEqual(await evaluate(`s.project.notes.filter(n=>n.pitch===75).map(n=>[n.start,n.length])`),[[0,128]],'dragging while drawing must lengthen one note, not add more');
 });

 await check('holding Undo repeats it and stops on release',async()=>{
  await evaluate(`import('./dist/history.js').then(({checkpoint})=>{s.history=[];s.future=[];for(let grid=4;grid<12;grid++){checkpoint();s.project.grid=grid;}})`);
  const point=await evaluate(`(()=>{const r=document.getElementById('undo').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);
  win.focus();win.webContents.focus();move(point);press(point);
  // pointerdown undoes once immediately; if that is lost the press never landed, so press again.
  try{await until(`s.project.grid<11`,'the first Undo on press',1500);}
  catch{release(point);move(point);press(point);await until(`s.project.grid<11`,'the first Undo after a second press',2500);}
  // Poll for the repeat instead of sleeping a fixed 900ms and hoping it fired.
  try{await until(`s.project.grid<10`,'Undo to repeat while held',6000);}
  finally{release(point);}
  const held=await evaluate(`s.project.grid`);
  assert.ok(held<10,`hold should repeat Undo, got grid ${held}`);
  // Proving it stopped genuinely needs a wait: nothing more may happen after release.
  await new Promise(resolve=>setTimeout(resolve,250));
  assert.equal(await evaluate(`s.project.grid`),held,'Undo repeat should stop on release');
 });

 await check('selecting notes fills the inspector',async()=>{
  await evaluate(`s.selection=new Set([1,2,3]);info()`);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.note-fields')).display`),'block');
 });

 await check('the MML block sits inside Instrument actions, closed by default',async()=>{
  assert.equal(await evaluate(`document.querySelectorAll('.instrument-mml').length`),5,'every instrument carries its own MML block');
  assert.equal(await evaluate(`[...document.querySelectorAll('.instrument-mml')].every(el=>el.closest('.instrument-action-body')!==null)`),true,'each block lives in its actions body');
  assert.equal(await evaluate(`document.querySelectorAll('.instrument-actions')[0].open`),false,'the section starts closed');
  await evaluate(`document.querySelectorAll('.instrument-actions summary')[0].click()`);
  await until(`document.querySelectorAll('.instrument-actions')[0].open`,'Instrument actions to open');
  await evaluate(`document.querySelectorAll('.instrument-actions summary')[0].click();document.activeElement.blur()`);
  await until(`!document.querySelectorAll('.instrument-actions')[0].open`,'Instrument actions to close again');
 });

 await check('clicking an instrument name selects that instrument',async()=>{
  await evaluate(`document.querySelectorAll('.instrument-name')[1].click()`);
  await until(`document.getElementById('editing-instrument').textContent==='Warm Strings'`,'the editor caption to follow the selection');
  await evaluate(`document.querySelectorAll('.instrument-name')[0].click();s.selection=new Set([1,2,3]);info();document.activeElement.blur()`);
  await until(`document.getElementById('editing-instrument').textContent==='Felt Piano'`,'the caption to return');
 });

 for(const width of [900,1320]){
  await check(`nothing overflows at ${width}px`,async()=>{
   win.setSize(width,850);await frame();
   const overflow=await evaluate(`[...document.querySelectorAll('.app-header,.editor-toolbar,.track-panel,.inspector-panel')].filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.className)`);
   assert.deepEqual(overflow,[]);
   fs.writeFileSync('.validation/ui-'+width+'.png',(await win.webContents.capturePage()).toPNG());
  });
 }

 await check('the night theme repaints chrome, roll and palette',async()=>{
  await evaluate(`document.querySelector('#theme-menu .theme-option[data-theme=night]').click()`);
  await until(`document.documentElement.dataset.theme==='night'`,'the night theme to apply');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('mml-studio-workspace-v1')).theme`),'night');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.track-panel')).backgroundColor`),'rgb(20, 20, 20)');
  assert.equal(await evaluate(`getComputedStyle(document.documentElement).backgroundColor`),'rgb(13, 13, 13)');
  assert.equal(await evaluate(`getComputedStyle(document.getElementById('left-divider'),'::after').content`),'none');
  assert.equal(await evaluate(`getComputedStyle(document.getElementById('left-divider')).backgroundColor`),'rgba(0, 0, 0, 0)');
  assert.equal(await evaluate(`getComputedStyle(document.getElementById('view'),'::-webkit-scrollbar').width`),'18px');
  assert.equal(await evaluate(`import('./dist/appearance.js').then(m=>m.palette.gridA)`),'#171717');
  await frame();
  fs.writeFileSync('.validation/ui-night.png',(await win.webContents.capturePage()).toPNG());
 });

 // Derive the native window icon from the repository's vector source.
 const png=await evaluate(`new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;canvas.getContext('2d').drawImage(image,0,0,256,256);resolve(canvas.toDataURL('image/png').split(',')[1]);};image.onerror=reject;image.src='assets/logo.svg';})`);
 fs.writeFileSync('assets/logo.png',Buffer.from(png,'base64'));

 await check('preferences survive a reload',async()=>{
  const reloaded=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));win.webContents.reload();await reloaded;
  assert.equal(await evaluate(`document.documentElement.dataset.theme`),'night');
  assert.equal(await evaluate(`document.getElementById('right-divider').getAttribute('aria-valuenow')`),'234');
 });

 finish();
 }catch(error){finish(error);}});});require('../main.cjs');
