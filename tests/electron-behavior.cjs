// Native renderer + AudioWorklet regression; does not certify physical speakers.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
fs.mkdirSync('.validation',{recursive:true});const profile=fs.mkdtempSync(path.resolve('.validation/behavior-'));app.setPath('userData',profile);app.disableHardwareAcceleration();
let started=false,stage='startup';const checks=[];const timer=setTimeout(()=>finish(Error('Timed out: '+stage)),45000);
function finish(error){clearTimeout(timer);fs.writeFileSync('.validation/electron-behavior.json',JSON.stringify({passed:!error,error:error?.stack,stage,checks},null,2));app.exit(error?1:0);}
app.on('browser-window-created',(_,win)=>{if(started)return;started=true;win.webContents.once('did-finish-load',async()=>{try{
 const evaluate=code=>{stage=code;return win.webContents.executeJavaScript(code,true);};
 await evaluate(`import("./dist/music/pitch-layout.js").then(layout=>{window.pitchTop=layout.pitchTop;window.pitchHeight=layout.pitchHeight;})`);
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 await evaluate(`window.meters=[];const originalConnect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(destination,...args){const result=originalConnect.call(this,destination,...args);if(destination instanceof AudioDestinationNode){const meter=this.context.createAnalyser();meter.fftSize=2048;originalConnect.call(this,meter);meters.push(meter);}return result;};true;`);
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/commands.js'),import('./dist/playback/transport.js')]).then(([{state},{refresh},transport])=>{window.s=state;window.refresh=refresh;window.transport=transport;s.project.instruments=[{name:'Piano',color:'#ff9c33',midiProgram:0},{name:'Instructions',color:'#f4d35e',isInstructions:true}];s.project.notes=[{id:1,instrument:0,start:0,length:2048,pitch:60,volume:12},{id:2,instrument:1,start:64,length:1,pitch:60,volume:0,tempo:60},{id:3,instrument:1,start:128,length:1,pitch:60,volume:0,timeSignature:'3/4',section:'Verse',resetMeasures:true},{id:4,instrument:1,start:144,length:1,pitch:60,volume:0,section:'Close instruction',tempo:90}];s.zoom=3;refresh();document.getElementById('view').scrollTop=pitchTop(s.topPitch,70);})`);
 assert.equal(await evaluate(`document.getElementById('current-signature').value`),'4/4');
 await evaluate(`const field=document.getElementById('current-signature');field.focus();field.value='6/8';field.dispatchEvent(new Event('change'));field.blur();`);
 assert.equal(await evaluate(`s.project.notes.find(n=>n.start===0&&s.project.instruments[n.instrument].isInstructions).timeSignature`),'6/8');
 await evaluate(`document.getElementById('section-nav').value='128';document.getElementById('section-nav').dispatchEvent(new Event('change'));`);
 assert.equal(await evaluate(`document.getElementById('current-signature').value`),'3/4');
 await evaluate(`transport.play()`);await wait(100);
 let tick=await evaluate(`transport.playback.tick`);assert.ok(tick>=128&&tick<144,`Section playback position ${tick}`);
 const peak=()=>evaluate(`(()=>{const meter=meters.at(-1),b=new Float32Array(meter.fftSize);meter.getFloatTimeDomainData(b);return Math.max(...b.map(Math.abs));})()`);
 assert.ok(await peak()>0.00001,'Section seek restores held note');checks.push({sectionTick:tick});
 const change=async value=>{
  await evaluate(`(()=>{const preset=document.querySelector('#instruments select');preset.value='${value}';preset.dispatchEvent(new Event('change'));})()`);
  for(let i=0;i<100;i++){await wait(20);if(!await evaluate(`document.getElementById('play').disabled`))return;}
  throw Error('Voice reload did not finish');
 };
 await change('40');await wait(150);assert.equal(await evaluate(`document.getElementById('play').title`),'Pause');assert.ok(await peak()>0.00001,'Live violin voice restores held note');
 tick=await evaluate(`transport.playback.tick`);assert.ok(tick>=128&&tick<180,`Live voice preserves position ${tick}`);checks.push({liveVoiceTick:tick});
 await evaluate(`document.getElementById('play').click()`);const paused=await evaluate(`transport.playback.tick`);
 await change('73');await wait(100);assert.equal(await evaluate(`document.getElementById('play').title`),'Resume');assert.equal(await evaluate(`transport.playback.tick`),paused);
 await evaluate(`transport.play()`);await wait(150);assert.ok(await peak()>0.00001,'Paused flute update resumes held note');checks.push('Paused voice update/resume produces PCM');
 await change('snare');assert.equal(await evaluate(`s.project.instruments[0].ms2Drum`),'snare');assert.equal(await evaluate(`document.getElementById('play').title`),'Pause');
 await change('40');await evaluate(`transport.seekToTick(32)`);await wait(100);assert.ok(await peak()>0.00001,'Rewind retains earlier held music');
 assert.equal(await evaluate(`s.project.instruments[0].midiProgram`),40);assert.equal(await evaluate(`s.project.instruments[1].isInstructions`),true);
 checks.push(await evaluate(`({instruments:s.project.instruments,rows:[...document.querySelectorAll('.instrument-name')].map(el=>el.textContent)})`));
 await evaluate(`(()=>{const speed=document.getElementById('playback-speed');speed.value='400';speed.dispatchEvent(new Event('input'));transport.seekToTick(256);})()`);
 // Let the asynchronous Worklet seek/rate acknowledgement arrive before
 // sampling, and measure elapsed time rather than assuming timer punctuality.
 await wait(150);const fastStart=await evaluate(`({tick:transport.playback.tick,time:performance.now()})`);await wait(300);const fastEnd=await evaluate(`({tick:transport.playback.tick,time:performance.now()})`),fastDelta=fastEnd.tick-fastStart.tick;
 const ticksPerSecond=fastDelta*1000/(fastEnd.time-fastStart.time);
 assert.ok(ticksPerSecond>150&&ticksPerSecond<230,`400% speed advances the musical clock: ${ticksPerSecond} ticks/s`);
 assert.equal(await evaluate(`document.getElementById('playback-bpm').textContent`),'90 BPM');
 assert.equal(await evaluate(`document.getElementById('effective-bpm').textContent`),'Effective BPM 360 (Out of bounds!)');
 await evaluate(`(()=>{const volume=document.getElementById('playback-volume');volume.value='0';volume.dispatchEvent(new Event('input'));})()`);await wait(350);assert.ok(await peak()<0.000001,'Master volume silences output');
 await evaluate(`(()=>{const volume=document.getElementById('playback-volume');volume.value='50';volume.dispatchEvent(new Event('input'));})()`);await wait(150);assert.ok(await peak()>0.00001,'Master volume restores output');checks.push({fastDelta,masterVolume:'0% silence / 50% PCM'});
 await evaluate(`transport.stopPlayback(false);document.getElementById('view').scrollLeft=0;refresh();`);
 await evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
 const boxes=await evaluate(`(()=>{const field=document.getElementById('current-signature').getBoundingClientRect(),caption=document.querySelector('.editor-caption').getBoundingClientRect();return {inside:field.right<=caption.right&&field.bottom<=caption.bottom,height:caption.height};})()`);assert.ok(boxes.inside);checks.push(boxes);
 fs.writeFileSync('.validation/electron-behavior.png',(await win.webContents.capturePage()).toPNG());
 win.setSize(900,700);await wait(150);
 assert.ok(await evaluate(`(()=>{const editor=document.querySelector('.editor').getBoundingClientRect();return [...document.querySelectorAll('.editor-caption .caption-control,.editor-caption #playback-position')].every(el=>el.getBoundingClientRect().right<=editor.right);})()`),'Playback settings fit a 900px window');
 stage='completed native section seek, editable meter, live/paused voice changes, held-note PCM, speed clock, master gain, rewind and responsive captions';finish();
 }catch(error){finish(error);}});});require('../main.cjs');
