const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
fs.mkdirSync('.validation',{recursive:true});app.setPath('userData',fs.mkdtempSync(path.resolve('.validation/pitch-layout-')));
const timer=setTimeout(()=>finish(Error('Pitch layout check timed out')),20000);
function finish(error){clearTimeout(timer);fs.writeFileSync('.validation/electron-pitch-layout.json',JSON.stringify({passed:!error,error:error?.stack},null,2));app.exit(error?1:0);}
app.on('browser-window-created',(_,win)=>win.webContents.once('did-finish-load',async()=>{try{
 const evaluate=code=>win.webContents.executeJavaScript(code,true);
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/music/pitch-layout.js')]).then(([{state},layout])=>{window.s=state;window.layout=layout;document.getElementById('view').scrollTop=layout.pitchTop(state.topPitch,72);})`);
 const point=async(pitch,tick=4)=>evaluate(`(()=>{const r=document.getElementById('canvas').getBoundingClientRect();return {x:Math.round(r.x+62+${tick}*s.zoom),y:Math.round(r.y+24+(layout.pitchTop(72,${pitch})+layout.pitchHeight(${pitch})/2)*s.verticalZoom)};})()`);
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
 const rowY=pitch=>evaluate(`Math.round(24+layout.pitchTop(72,${pitch})+layout.pitchHeight(${pitch})/2)`);
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
 // Zoom shares geometry with drawing, inverse hit testing and the scroll extent.
 const beforeZoom=await evaluate('JSON.stringify([s.project,s.history,s.dirty])');
 await evaluate(`document.getElementById('vertical-zoom').value='2';document.getElementById('vertical-zoom').dispatchEvent(new Event('input'));`);
 assert.deepEqual(await evaluate(`import('./dist/geometry.js').then(({rect,musical})=>s.project.notes.map(n=>{const r=rect(n);return [r.h,musical({x:r.x+4,y:r.y+r.h/2}).pitch]}))`),[[39,60],[39,62]]);
 const wheel=async(ctrl,delta)=>evaluate(`(()=>{const v=document.getElementById('view'),r=v.getBoundingClientRect(),e=new WheelEvent('wheel',{ctrlKey:${ctrl},deltaY:${delta},clientY:r.top+200,bubbles:true,cancelable:true});v.dispatchEvent(e);return {prevented:e.defaultPrevented,zoom:s.verticalZoom};})()`);
 assert.deepEqual(await wheel(false,-100),{prevented:false,zoom:2});
 const anchor=()=>evaluate(`import('./dist/geometry.js').then(({musical})=>musical({x:100,y:200}).pitch)`);
 const anchorPitch=await anchor();assert.deepEqual(await wheel(true,-100),{prevented:true,zoom:2.1});assert.equal(await anchor(),anchorPitch);
 for(let i=0;i<15;i++)await wheel(true,-100);assert.equal(await evaluate('s.verticalZoom'),3);
 for(let i=0;i<30;i++)await wheel(true,100);assert.equal(await evaluate('s.verticalZoom'),.5);
 await evaluate(`document.getElementById('zoom').value='6';document.getElementById('zoom').dispatchEvent(new Event('input'));document.getElementById('reset-zoom').click();`);
 assert.deepEqual(await evaluate(`[s.zoom,s.verticalZoom,document.getElementById('zoom').value,document.getElementById('vertical-zoom').value]`),[3,1,'3','1']);
 assert.equal(await evaluate('JSON.stringify([s.project,s.history,s.dirty])'),beforeZoom);
 // Actual native clicks and drags at multiple scales, with independent base-row coordinates.
 for(const [horizontal,vertical] of [[1,.5],[3,1.7],[8,3]]){
  await evaluate(`s.project.notes=[];s.selection.clear();document.getElementById('draw').click();document.getElementById('zoom').value='${horizontal}';document.getElementById('zoom').dispatchEvent(new Event('input'));document.getElementById('vertical-zoom').value='${vertical}';document.getElementById('vertical-zoom').dispatchEvent(new Event('input'));document.getElementById('view').scrollLeft=0;document.getElementById('view').scrollTop=layout.pitchTop(s.topPitch,72)*s.verticalZoom;`);await settle();
  const start=await point(70);
  win.webContents.sendInputEvent({type:'mouseDown',...start,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...start,button:'left',clickCount:1});await settle();
  assert.deepEqual(await evaluate('s.project.notes.map(n=>[n.pitch,n.start,n.length])'),[[70,0,32]],'Draw hits the correct row and grid cell at '+horizontal+'/'+vertical);
  await evaluate(`document.getElementById('select').click();s.selection.clear();`);
  win.webContents.sendInputEvent({type:'mouseDown',...start,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...start,button:'left',clickCount:1});await settle();
  assert.equal(await evaluate('s.selection.size'),1,'Selection hits the zoomed note');
  const destination=await point(69,36);
  win.webContents.sendInputEvent({type:'mouseDown',...start,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseMove',...destination,button:'left',modifiers:['leftButtonDown']});win.webContents.sendInputEvent({type:'mouseUp',...destination,button:'left',clickCount:1});await settle();
  assert.deepEqual(await evaluate('s.project.notes.map(n=>[n.pitch,n.start,n.length])'),[[69,32,32]],'Move keeps pitch and timing accurate at '+horizontal+'/'+vertical);
  const edge=await point(69,64);edge.x-=2;
  win.webContents.sendInputEvent({type:'mouseDown',...edge,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseMove',x:edge.x+32*horizontal,y:edge.y,button:'left',modifiers:['leftButtonDown']});win.webContents.sendInputEvent({type:'mouseUp',x:edge.x+32*horizontal,y:edge.y,button:'left',clickCount:1});await settle();
  assert.deepEqual(await evaluate('s.project.notes.map(n=>[n.pitch,n.start,n.length])'),[[69,32,64]],'Edge resize uses the zoomed boundary');
  const preview=await point(71);preview.x=await evaluate(`Math.round(document.getElementById('canvas').getBoundingClientRect().x+20)`);
  win.webContents.sendInputEvent({type:'mouseDown',...preview,button:'left',clickCount:1});await settle();assert.equal(await evaluate('s.previewPitch'),71,'Piano preview uses the zoomed row');
  win.webContents.sendInputEvent({type:'mouseUp',...preview,button:'left',clickCount:1});
 }
 await evaluate(`document.getElementById('reset-zoom').click();document.getElementById('view').scrollTop=layout.pitchTop(s.topPitch,72);`);await settle();
 // Native pointer capture keeps a moving group attached while edge scrolling runs
 // without further mouse events. Check both directions at two horizontal scales.
 for(const zoom of [3,6])for(const direction of [-1,1]){
  await evaluate(`s.zoom=${zoom};s.project.grid=128;s.project.notes=[{id:1,instrument:0,start:200,length:7,pitch:70,volume:8},{id:2,instrument:0,start:209,length:5,pitch:69,volume:0}];s.selection=new Set([1,2]);s.active=0;document.getElementById('select').click();import('./dist/commands.js').then(({refresh})=>refresh());`);await settle();
  await evaluate(`document.getElementById('view').scrollLeft=200*s.zoom-100;`);await settle();
  const start=await evaluate(`import('./dist/geometry.js').then(({rect})=>{const n=rect(s.project.notes[0]),r=document.getElementById('canvas').getBoundingClientRect();return {x:Math.round(r.x+n.x+3),y:Math.round(r.y+n.y+5)};})`);
  const dest={x:await evaluate(`(()=>{const r=document.getElementById('canvas').getBoundingClientRect();return Math.round(${direction}<0?r.x+63:r.right-2)})()`),y:start.y};
  win.webContents.sendInputEvent({type:'mouseDown',...start,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseMove',...dest,button:'left',modifiers:['leftButtonDown']});await settle();
  const before=await evaluate(`[document.getElementById('view').scrollLeft,s.gesture.movePreview.dt]`);
  await evaluate('new Promise(resolve=>{let frames=0;const next=()=>++frames===8?resolve():requestAnimationFrame(next);requestAnimationFrame(next)})');
  const after=await evaluate(`[document.getElementById('view').scrollLeft,s.gesture.movePreview.dt,s.project.notes[1].start-s.project.notes[0].start,s.project.notes.map(n=>[n.pitch,n.length,n.volume])]`);
  assert.ok((after[0]-before[0])*direction>0,'Viewport scrolls in drag direction');assert.ok((after[1]-before[1])*direction>0,'Preview follows stationary edge pointer');assert.equal(after[2],9);assert.deepEqual(after[3],[[70,7,8],[69,5,0]]);
  assert.equal(await evaluate('s.project.notes[0].start'),200);
  win.webContents.sendInputEvent({type:'mouseUp',...dest,button:'left',clickCount:1});await settle();assert.equal(await evaluate('s.project.notes[0].start'),200+after[1]);const released=await evaluate('document.getElementById("view").scrollLeft');await settle();assert.equal(await evaluate('document.getElementById("view").scrollLeft'),released);
 }

 // A stationary native drag ramps over time, without committing the note data.
 await evaluate(`s.zoom=3;s.project.grid=128;s.project.notes=[{id:1,instrument:0,start:200,length:32,pitch:70,volume:8}];s.selection=new Set([1]);s.active=0;import('./dist/commands.js').then(({refresh})=>refresh());`);await settle();
 await evaluate(`document.getElementById('view').scrollLeft=500`);await settle();
 const hold=await evaluate(`import('./dist/geometry.js').then(({rect})=>{const n=rect(s.project.notes[0]),c=document.getElementById('canvas').getBoundingClientRect();return {x:Math.round(c.left+n.x+10),y:Math.round(c.top+n.y+5),edge:Math.round(c.right-2)}})`);
 win.webContents.sendInputEvent({type:'mouseDown',x:hold.x,y:hold.y,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseMove',x:hold.edge,y:hold.y,button:'left',modifiers:['leftButtonDown']});
 const acceleration=await evaluate(`new Promise(resolve=>{const v=document.getElementById('view'),start=performance.now(),left=v.scrollLeft;let early=0,late=0,lateTime=0;const frame=now=>{const elapsed=now-start;if(!early&&elapsed>=200)early=(v.scrollLeft-left)/elapsed;if(!lateTime&&elapsed>=3400){late=v.scrollLeft;lateTime=now;}if(elapsed>=3700)resolve({early,late:(v.scrollLeft-late)/(now-lateTime),unchanged:s.project.notes[0].start===200});else requestAnimationFrame(frame);};requestAnimationFrame(frame);})`);
 assert.ok(acceleration.late>acceleration.early*2,JSON.stringify(acceleration));assert.ok(acceleration.unchanged);
 win.webContents.sendInputEvent({type:'mouseUp',x:hold.edge,y:hold.y,button:'left',clickCount:1});await settle();
 fs.writeFileSync('.validation/electron-edge-acceleration.json',JSON.stringify(acceleration,null,2));

 // Drawing and extending continue past the old scroll extent at the far-right edge.
 for(const mode of ['draw','resize']){
  await evaluate(`s.zoom=3;s.project.grid=128;s.project.notes=[];s.selection.clear();s.active=0;document.getElementById('draw').click();import('./dist/commands.js').then(({refresh})=>refresh());`);await settle();
  await evaluate(`(()=>{const v=document.getElementById('view');v.scrollLeft=v.scrollWidth;})()`);await settle();
  if(mode==='resize'){
   await evaluate(`(()=>{const v=document.getElementById('view');s.project.notes=[{id:1,instrument:0,start:Math.floor((v.scrollLeft+v.clientWidth-200)/s.zoom),length:16,pitch:70,volume:8}];s.selection=new Set([1]);})()`);
  }
  const startPoint=await evaluate(`import('./dist/geometry.js').then(({rect})=>{const c=document.getElementById('canvas').getBoundingClientRect(),v=document.getElementById('view'),r=s.project.notes.length?rect(s.project.notes[0]):null;return {x:Math.round(r?c.left+r.x+r.w-1:c.right-140),y:Math.round(r?c.top+r.y+5:c.top+140),edge:Math.round(c.right-2),oldMax:v.scrollWidth-v.clientWidth};})`);
  win.webContents.sendInputEvent({type:'mouseDown',x:startPoint.x,y:startPoint.y,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseMove',x:startPoint.edge,y:startPoint.y,button:'left',modifiers:['leftButtonDown']});
  await evaluate(`new Promise(r=>setTimeout(r,220))`);
  assert.ok(await evaluate(`document.getElementById('view').scrollLeft`)>startPoint.oldMax,mode+' scrolls beyond old extent');
  assert.ok(await evaluate(`s.project.notes[0].length`)>16);
  win.webContents.sendInputEvent({type:'mouseUp',x:startPoint.edge,y:startPoint.y,button:'left',clickCount:1});await settle();
 }
 fs.writeFileSync('.validation/electron-pitch-layout-piano.png',(await win.webContents.capturePage()).toPNG());
 fs.writeFileSync('.validation/electron-pitch-layout.png',(await win.webContents.capturePage()).toPNG());finish();
}catch(error){finish(error);}}));
require('../main.cjs');
