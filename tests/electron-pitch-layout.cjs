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
 // The piano view repaints the same rows: black keys narrow, white keys full width, the
 // boundary between two white keys running through the black key that separates them.
 const column=(x,y)=>evaluate(`Array.from(document.getElementById('canvas').getContext('2d').getImageData(Math.round(${x}*devicePixelRatio),Math.round(${y}*devicePixelRatio),1,1).data).slice(0,3).join()`);
 const rowY=pitch=>evaluate(`Math.round(30+layout.pitchTop(72,${pitch})+layout.pitchHeight(${pitch})/2)`);
 const sharpY=await rowY(61),naturalY=await rowY(62),edgeY=sharpY-5;
 assert.equal(await column(10,sharpY),'63,65,68','A sharp row is one dark block across the column');
 assert.equal(await column(50,sharpY),'63,65,68','and it reaches the front of the column');
 await evaluate(`document.getElementById('key-style').click()`);await settle();
 assert.equal(await evaluate(`document.getElementById('key-style').getAttribute('aria-pressed')`),'true');
 assert.equal(await column(10,sharpY),'43,50,56','The black key keeps the back of the column');
 assert.equal(await column(50,edgeY),'255,255,255','and leaves the front white');
 assert.equal(await column(50,naturalY),'255,255,255','White keys run the full width');
 assert.equal(await evaluate(`JSON.parse(localStorage.getItem('mml-studio-workspace-v1')).piano`),true,'The choice is part of the workspace');
 // Painting only: the same click still previews the same pitch.
 const key=await point(61);win.webContents.sendInputEvent({type:'mouseDown',x:key.x-40,y:key.y,button:'left',clickCount:1});
 for(let waited=0;waited<40&&await evaluate('s.previewPitch')!==61;waited++)await settle();
 assert.equal(await evaluate('s.previewPitch'),61,'Clicking a key previews its pitch in either view');
 win.webContents.sendInputEvent({type:'mouseUp',x:key.x-40,y:key.y,button:'left',clickCount:1});await settle();
 fs.writeFileSync('.validation/electron-pitch-layout-piano.png',(await win.webContents.capturePage()).toPNG());
 fs.writeFileSync('.validation/electron-pitch-layout.png',(await win.webContents.capturePage()).toPNG());finish();
}catch(error){finish(error);}}));
require('../main.cjs');
