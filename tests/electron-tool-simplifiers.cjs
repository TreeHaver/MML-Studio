const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
fs.mkdirSync('.validation',{recursive:true});
app.setPath('userData',path.resolve(fs.mkdtempSync('.validation/tool-simplifiers-')));app.disableHardwareAcceleration();
let started=false;const evidence={passed:false,checks:[]};
const timer=setTimeout(()=>finish(Error('Tool simplifiers timed out')),45000);
function finish(error){clearTimeout(timer);evidence.passed=!error;if(error)evidence.error=String(error.stack);fs.writeFileSync('.validation/electron-tool-simplifiers.json',JSON.stringify(evidence,null,2));app.exit(error?1:0);}
app.on('browser-window-created',(_,win)=>{if(started)return;started=true;win.webContents.once('did-finish-load',async()=>{try{
 const run=code=>win.webContents.executeJavaScript(code,true);
 await run(`Promise.all([import('./dist/state.js'),import('./dist/commands.js')]).then(([{state},{refresh}])=>{window.s=state;window.refresh=refresh;});`);
 const fixture=async(notes,selection=[])=>run(`s.segment=null;s.project={format:'mml-studio',version:2,grid:4,instruments:[{name:'Piano',color:'#abcdef'},{name:'Other',color:'#fedcba'}],notes:${JSON.stringify(notes)}};s.active=0;s.selection=new Set(${JSON.stringify(selection)});s.history=[];s.future=[];refresh();document.getElementById('tools-open').click();`);
 const note=(id,start,length,pitch,volume=8,instrument=0)=>({id,start,length,pitch,volume,instrument});
 const chord=[60,62,64,66,68,70,72].map((p,i)=>note(i+1,0,32,p));
 await fixture(chord);
 await run(`document.getElementById('chord-complexity').value='4';document.getElementById('chord-use-scale').checked=false;document.getElementById('simplify-chords').click();`);
 assert.deepEqual(await run('s.project.notes.map(n=>n.pitch)'),[60,64,68,72]);assert.equal(await run('s.history.length'),1);
 await run(`document.getElementById('undo').click()`);assert.deepEqual(await run('s.project.notes'),chord);evidence.checks.push('native chord Apply and Undo');
 const held=Array.from({length:10},(_,i)=>note(i+1,0,64,60+i));held.push(note(11,32,8,60));
 await fixture(held,[2]);await run(`document.getElementById('simplify-held-notes').click()`);
 assert.equal(await run('s.project.notes.find(n=>n.id===2).length'),32);assert.equal(await run('s.project.notes.find(n=>n.id===1).length'),64);
 await run(`document.getElementById('undo').click()`);assert.deepEqual(await run('s.project.notes'),held);evidence.checks.push('held selection scope and Undo');
 await fixture([note(1,0,32,60,14),note(2,32,32,64,8),note(3,64,32,67,null),note(4,0,32,60,9,1)],[1,2]);
 await run(`const amount=document.getElementById('volume-amount');amount.value='5';amount.dispatchEvent(new Event('input'));`);
 assert.match(await run(`document.getElementById('volume-reading').textContent`),/Warning: Apply will clamp/);
 await run(`document.getElementById('volume-apply').click()`);
 assert.deepEqual(await run('s.project.notes.map(n=>n.volume)'),[15,13,8,9]);evidence.checks.push('pre-Apply clamp warning, permitted clamp and unselected inheritance');
 await run(`document.getElementById('undo').click();s.selection.clear();document.getElementById('volume-amount').value='1';document.getElementById('volume-apply').click()`);
 assert.deepEqual(await run('s.project.notes.map(n=>n.volume)'),[15,9,9,9]);evidence.checks.push('empty selection uses active instrument');
 await fixture([note(1,0,32,60,14),note(2,32,32,64,8)]);
 await run(`const a=document.querySelector('[data-instrument="0"] .instrument-volume-amount');a.value='5';a.dispatchEvent(new Event('input'));`);
 assert.match(await run(`document.querySelector('[data-instrument="0"] .instrument-volume-reading').textContent`),/Warning: Apply will clamp/);
 await run(`document.querySelector('[data-instrument="0"] .instrument-volume button').click()`);
 assert.deepEqual(await run('s.project.notes.map(n=>n.volume)'),[15,13]);evidence.checks.push('instrument volume warning permits clamp');
 await fixture([60,62,64,65,67,69,71].map((p,i)=>note(i+1,0,i?16:128,p)));
 await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
 await run(`document.getElementById('tools-open').click()`);
 await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
 await run(`document.getElementById('detect-scale').click()`);
 assert.match(await run(`document.getElementById('scale-reading').textContent`),/C major/);assert.equal(await run('s.history.length'),0);
 // The tools used to be one column in a dropdown, so the last of them was only reachable
 // by scrolling the whole list. They are now cards side by side on a screen of their own:
 // every card is measured against the screen it sits on, and against its neighbours.
 const bounds=await run(`(()=>{const dialog=document.getElementById('tools-dialog').getBoundingClientRect();
  const button=document.getElementById('detect-scale').getBoundingClientRect();
  const cards=[...document.querySelectorAll('#tools-dialog .tool-item')].map(e=>e.getBoundingClientRect());
  return {bottom:dialog.bottom,height:innerHeight,visible:button.top>=dialog.top&&button.bottom<=dialog.bottom,
   cards:cards.length,columns:new Set(cards.map(r=>Math.round(r.x))).size,
   inside:cards.filter(r=>r.top>=dialog.top&&r.bottom<=dialog.bottom).length};})()`);
 evidence.bounds=bounds;assert.ok(bounds.bottom<=bounds.height);assert.equal(bounds.visible,true);
 assert.ok(bounds.columns>=2,'the tools sit side by side, not in one scrolling column: '+JSON.stringify(bounds));
 assert.equal(bounds.inside,bounds.cards,'every tool is on screen without scrolling: '+JSON.stringify(bounds));
 evidence.checks.push('read-only project scale, and every tool visible at once on the Tools screen');
 await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
 assert.equal(await run(`document.getElementById('tools-dialog').open`),true);
 fs.writeFileSync('.validation/tool-simplifiers.png',(await win.webContents.capturePage()).toPNG());
 finish();
 }catch(error){finish(error);}});});
require('../main.cjs');
