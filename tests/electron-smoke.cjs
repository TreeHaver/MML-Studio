// Run with: node_modules/electron/dist/electron.exe tests/electron-smoke.cjs
// Uses the real main/preload/renderer and AudioWorklet. Does not certify speakers.
const {app}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve('.validation');fs.mkdirSync(output,{recursive:true});
const result={checks:[],errors:[]};
const deadline=setTimeout(()=>finish(Error('Native smoke test timed out')),45000);
function finish(error){
 clearTimeout(deadline);if(error)result.errors.push(String(error.stack??error));
 result.passed=result.errors.length===0;
 fs.writeFileSync(path.join(output,'electron-smoke.json'),JSON.stringify(result,null,2));
 app.exit(result.passed?0:1);
}
app.on('browser-window-created',(_,win)=>{
 const wc=win.webContents;
 wc.on('render-process-gone',(_,details)=>result.errors.push(JSON.stringify(details)));
 wc.on('did-fail-load',(_,code,message)=>result.errors.push(`${code}: ${message}`));
 wc.once('did-finish-load',async()=>{
  try{
   win.show();win.focus();
   const evaluate=code=>wc.executeJavaScript(code,true);
   const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
   await evaluate(`window.__meters=[];const originalConnect=AudioNode.prototype.connect;
    AudioNode.prototype.connect=function(destination,...args){
     const result=originalConnect.call(this,destination,...args);
     if(destination instanceof AudioDestinationNode){const meter=this.context.createAnalyser();meter.fftSize=2048;originalConnect.call(this,meter);window.__meters.push(meter);}
     return result;
    };true;`);
   const click=async(x,y)=>{
    wc.sendInputEvent({type:'mouseDown',x,y,button:'left',clickCount:1});
    wc.sendInputEvent({type:'mouseUp',x,y,button:'left',clickCount:1});
   };
   const point=await evaluate(`(()=>{const r=document.getElementById('canvas').getBoundingClientRect();return {x:Math.round(r.left+20),y:Math.round(r.top+200)};})()`);
   const before=await evaluate(`import('./dist/state.js').then(({state})=>JSON.stringify(state.project))`);
   for(const program of [0,40,73]){
    await evaluate(`(()=>{const s=document.querySelector('#instruments select');s.value='${program}';s.dispatchEvent(new Event('change'));document.getElementById('status').textContent='waiting';})()`);
    await click(point.x,point.y);
    let status='';
    for(let i=0;i<150;i++){await wait(50);status=await evaluate(`document.getElementById('status').textContent`);if(status.startsWith('Preview:')||status.includes('failed'))break;}
    assert.match(status,/^Preview:/);await wait(100);
    const peak=await evaluate(`Math.max(...window.__meters.map(m=>{const b=new Float32Array(m.fftSize);m.getFloatTimeDomainData(b);return Math.max(...b.map(Math.abs));}))`);
    assert.ok(peak>0.00001,`Silent native preview for program ${program}: ${peak}`);
    result.checks.push({previewProgram:program,peak,status});
   }
   assert.equal(await evaluate(`import('./dist/state.js').then(({state})=>state.project.notes.length)`),0);
   result.checks.push('Piano clicks did not create notes');
   await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/constants.js'),import('./dist/music/pitch-layout.js')]).then(([{state},{HEAD},{pitchTop}])=>{document.getElementById('view').scrollTop=pitchTop(state.topPitch,109)-(200-HEAD);})`);
   await wait(100);await click(point.x,point.y);await wait(150);
   assert.match(await evaluate(`document.getElementById('status').textContent`),/Preview: C#8/);
   const highPreviewPeak=await evaluate(`Math.max(...window.__meters.map(m=>{const b=new Float32Array(m.fftSize);m.getFloatTimeDomainData(b);return Math.max(...b.map(Math.abs));}))`);
   assert.ok(highPreviewPeak>0.00001,`Silent native C#8 preview: ${highPreviewPeak}`);result.checks.push({highPreviewPeak});
   await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/constants.js'),import('./dist/music/pitch-layout.js')]).then(([{state},{HEAD},{pitchTop}])=>{document.getElementById('view').scrollTop=pitchTop(state.topPitch,60)-(200-HEAD);})`);
   await wait(100);
   const glideTo=await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/constants.js'),import('./dist/music/pitch-layout.js')]).then(([{state},{HEAD},{pitchTop,pitchHeight}])=>Math.round(document.getElementById('canvas').getBoundingClientRect().top+HEAD+pitchTop(state.topPitch,64)-document.getElementById('view').scrollTop+pitchHeight(64)/2))`);
   await evaluate(`(()=>{const c=document.getElementById('canvas');c.onpointerdown({button:0,clientX:${point.x},clientY:${point.y},pointerId:1,preventDefault(){}});c.onpointermove({clientX:${point.x},clientY:${glideTo},pointerId:1});c.onpointerup({pointerId:1});})()`);await wait(150);
   assert.match(await evaluate(`document.getElementById('status').textContent`),/Preview: E4/);result.checks.push('Piano-key drag preview passed');
   // A held note lets us check Pause/Resume and preview independence.
   await evaluate(`import('./dist/state.js').then(({state})=>{state.project.notes=[{id:1,instrument:0,start:0,length:512,pitch:60,volume:null}];})`);
   await evaluate(`import('./dist/playback/transport.js').then(m=>m.play())`);
   await wait(200);
   assert.equal(await evaluate(`document.getElementById('play').classList.contains('is-playing')`),true);
   assert.equal(await evaluate(`document.getElementById('play').title`),'Pause');
   await click(point.x,point.y);await wait(150);
   assert.equal(await evaluate(`document.getElementById('play').classList.contains('is-playing')`),true,'a key preview must not stop playback');
   await evaluate(`document.getElementById('play').click()`);await wait(100);
   assert.equal(await evaluate(`document.getElementById('play').title`),'Resume');
   await evaluate(`import('./dist/playback/transport.js').then(m=>m.play())`);
   await wait(150);
   result.checks.push({transportPosition:await evaluate(`document.getElementById('playback-position').textContent`)});
   await evaluate(`document.getElementById('stop').click()`);
   assert.equal(await evaluate(`document.getElementById('play').disabled`),false);
   result.checks.push('Song Play/Pause/Resume/Stop and simultaneous keyboard preview passed');
   await evaluate(`(()=>{const s=document.querySelector('#instruments select');s.fillOptions?.();s.value='drums';s.dispatchEvent(new Event('change'));})()`);
   assert.match(await evaluate(`document.querySelector('.instrument-flag').getAttribute('data-message')`),/Not a valid MS2 instrument/);
   await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/constants.js'),import('./dist/music/pitch-layout.js')]).then(([{state},{HEAD},{pitchTop}])=>{document.getElementById('view').scrollTop=pitchTop(state.topPitch,36)-(200-HEAD);})`);
   await wait(100);await click(point.x,point.y);await wait(100);
   assert.match(await evaluate(`document.getElementById('status').textContent`),/Bass Drum 1/);
   const drumPreviewPeak=await evaluate(`Math.max(...window.__meters.map(m=>{const b=new Float32Array(m.fftSize);m.getFloatTimeDomainData(b);return Math.max(...b.map(Math.abs));}))`);
   assert.ok(drumPreviewPeak>0.00001);result.checks.push({drumPreviewPeak});
   await wait(700);
   await evaluate(`import('./dist/state.js').then(({state})=>{state.project.notes=Array.from({length:8},(_,i)=>({id:i+1,instrument:0,start:i*8,length:4,pitch:i%2?38:36,volume:12}));})`);
   await evaluate(`import('./dist/playback/transport.js').then(m=>m.play())`);await wait(200);
   const drumSongPeak=await evaluate(`(()=>{const m=window.__meters.at(-1),b=new Float32Array(m.fftSize);m.getFloatTimeDomainData(b);return Math.max(...b.map(Math.abs));})()`);
   assert.ok(drumSongPeak>0.00001);result.checks.push({drumSongPeak});
   await evaluate(`document.getElementById('stop').click()`);
   result.checks.push('Standard Drum Kit warning, real key preview, and sequenced kick/snare AudioWorklet output passed');
   fs.writeFileSync(path.join(output,'electron-smoke.png'),(await wc.capturePage()).toPNG());
   // Restore the in-memory fixture; no project file is saved.
   await evaluate(`import('./dist/state.js').then(({state})=>{state.project=JSON.parse(${JSON.stringify(before)});state.dirty=false;})`);
   finish();
  }catch(error){finish(error);}
 });
});
require('../main.cjs');
