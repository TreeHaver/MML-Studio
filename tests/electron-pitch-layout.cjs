const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
fs.mkdirSync('.validation',{recursive:true});app.setPath('userData',fs.mkdtempSync(path.resolve('.validation/pitch-layout-')));
const timer=setTimeout(()=>finish(Error('Pitch layout check timed out')),20000);
function finish(error){clearTimeout(timer);fs.writeFileSync('.validation/electron-pitch-layout.json',JSON.stringify({passed:!error,error:error?.stack},null,2));app.exit(error?1:0);}
app.on('browser-window-created',(_,win)=>win.webContents.once('did-finish-load',async()=>{try{
 const evaluate=code=>win.webContents.executeJavaScript(code,true);
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/music/pitch-layout.js')]).then(([{state},layout])=>{window.s=state;window.layout=layout;document.getElementById('view').scrollTop=layout.pitchTop(state.topPitch,72);})`);
 const point=async(pitch,tick=4)=>evaluate(`(()=>{const r=document.getElementById('canvas').getBoundingClientRect();return {x:Math.round(r.x+62+${tick}*s.zoom),y:Math.round(r.y+30+layout.pitchTop(72,${pitch})+layout.pitchHeight(${pitch})/2)};})()`);
 const settle=()=>evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
 for(const pitch of [60,61]){
  const p=await point(pitch);win.webContents.sendInputEvent({type:'mouseDown',...p,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...p,button:'left',clickCount:1});await settle();
 }
 assert.deepEqual(await evaluate('s.project.notes.map(n=>n.pitch)'),[60,61]);
 const a=await point(61),b=await point(62,36);
 win.webContents.sendInputEvent({type:'mouseDown',...a,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseMove',...b,button:'left',modifiers:['leftButtonDown']});win.webContents.sendInputEvent({type:'mouseUp',...b,button:'left',clickCount:1});await settle();
 assert.deepEqual(await evaluate('s.project.notes.map(n=>[n.pitch,n.start])'),[[60,0],[62,32]]);
 assert.deepEqual(await evaluate(`import('./dist/geometry.js').then(({rect})=>s.project.notes.map(n=>rect(n).h))`),[19,19]);
 fs.writeFileSync('.validation/electron-pitch-layout.png',(await win.webContents.capturePage()).toPNG());finish();
}catch(error){finish(error);}}));
require('../main.cjs');
