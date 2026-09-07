const {app}=require('electron'),fs=require('node:fs'),assert=require('node:assert/strict');
const timer=setTimeout(()=>finish(Error('Timed out')),30000);
function finish(error){clearTimeout(timer);fs.mkdirSync('.validation',{recursive:true});fs.writeFileSync('.validation/electron-instruments.json',JSON.stringify({passed:!error,error:error?String(error.stack):undefined},null,2));app.exit(error?1:0);}
app.on('browser-window-created',(_,win)=>win.webContents.once('did-finish-load',async()=>{try{
 const evaluate=code=>win.webContents.executeJavaScript(code,true);
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/commands.js')]).then(([{state},{refresh}])=>{state.project.instruments=Array.from({length:17},(_,i)=>({name:'Instrument '+i,color:'#77baff',isDrum:i===16}));state.project.notes=state.project.instruments.map((_,i)=>({id:i+1,instrument:i,start:0,length:2048,pitch:60,volume:8}));refresh();})`);
 const expanded=await evaluate(`document.querySelector('.instrument').offsetHeight`);
 await evaluate(`document.querySelector('.instrument-name').click()`);
 assert.ok(await evaluate(`document.querySelector('.instrument').offsetHeight`)<expanded);
 assert.equal(await evaluate(`getComputedStyle(document.querySelector('.instrument-controls')).display`),'none');
 await evaluate(`document.querySelector('.instrument-name').click();document.querySelectorAll('.instrument-controls button')[1].click()`);
 await evaluate(`import('./dist/playback/transport.js').then(m=>m.play())`);
 assert.equal(await evaluate(`document.getElementById('pause').disabled`),false);
 await evaluate(`document.querySelectorAll('.instrument-controls button')[33].click()`);
 assert.deepEqual(await evaluate(`import('./dist/state.js').then(m=>[m.isMuted(0),m.isMuted(16)])`),[true,false]);
 await evaluate(`document.querySelectorAll('.instrument-controls button')[33].click();document.querySelectorAll('.instrument-controls button')[0].click();document.getElementById('pause').click();`);
 await evaluate(`import('./dist/playback/transport.js').then(m=>m.play())`);
 await evaluate(`document.getElementById('stop').click()`);
 finish();
}catch(e){finish(e);}}));require('../main.cjs');
