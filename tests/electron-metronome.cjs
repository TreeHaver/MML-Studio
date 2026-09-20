// Native renderer, real audio engine, real clock. The metronome schedules its clicks against
// the sequencer's own time, so the only honest check is to play the piece and count what it
// actually prepared.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve('.validation');fs.mkdirSync(output,{recursive:true});
app.setPath('userData',fs.mkdtempSync(path.join(output,'metronome-')));app.disableHardwareAcceleration();
let started=false;const result={checks:[],errors:[]};
const deadline=setTimeout(()=>finish(Error('Metronome test timed out')),45000);
function finish(error){clearTimeout(deadline);if(error)result.errors.push(String(error.stack??error));result.passed=!result.errors.length;
 fs.writeFileSync(path.join(output,'electron-metronome.json'),JSON.stringify(result,null,2));app.exit(result.passed?0:1);}
app.on('browser-window-created',(_,win)=>{if(started)return;started=true;
 win.webContents.once('did-finish-load',async()=>{try{
  const run=code=>win.webContents.executeJavaScript(code,true);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const scheduled=()=>run(`window.metronome.scheduled`);
  const playing=()=>run(`document.getElementById('play').classList.contains('is-playing')`);

  // Eight bars of one long note at the default 120 BPM: a beat every half second.
  await run(`Promise.all([import('./dist/state.js'),import('./dist/commands.js'),import('./dist/playback/transport.js'),import('./dist/playback/metronome.js')])
   .then(([{state},{refresh},transport,metronome])=>{window.s=state;window.transport=transport;window.metronome=metronome.metronome;
    s.project.instruments=[{name:'Piano',color:'#ff9c33',midiProgram:0}];
    s.project.notes=[{id:1,instrument:0,start:0,length:32*32,pitch:60,volume:8}];
    s.active=0;refresh();})`);

  assert.equal(await run(`document.getElementById('metronome').getAttribute('aria-pressed')`),'false');
  assert.equal(await run(`window.metronome.on`),false,'the metronome starts off');

  // Off: playing must prepare nothing at all.
  await run(`transport.play()`);
  for(let i=0;i<40&&!(await playing());i++)await wait(100);
  assert.equal(await playing(),true,'playback did not start');
  await wait(1200);
  assert.equal(await scheduled(),0,'nothing is scheduled while the metronome is off');
  await run(`document.getElementById('stop').click()`);
  result.checks.push('Off by default, and silent while off');

  // On: the button is the switch, and the clicks follow the beats of the piece.
  await run(`document.getElementById('metronome').click()`);
  assert.equal(await run(`window.metronome.on`),true);
  assert.equal(await run(`document.getElementById('metronome').getAttribute('aria-pressed')`),'true');
  assert.match(await run(`document.getElementById('status').textContent`),/Metronome on/);

  await run(`transport.play()`);
  for(let i=0;i<40&&!(await playing());i++)await wait(100);
  assert.equal(await playing(),true,'playback did not start with the metronome on');
  await wait(1600);
  const heard=await scheduled();
  // A beat every half second, prepared a quarter of a second ahead: about four in 1.6 s.
  // The bounds are wide on purpose, since the test machine schedules when it can.
  assert.ok(heard>=3&&heard<=8,'clicks prepared in 1.6 s of playback: '+heard);
  result.checks.push({clicksIn1600ms:heard});

  const beforeStop=await scheduled();
  await run(`document.getElementById('stop').click()`);
  await wait(400);
  assert.equal(await scheduled(),beforeStop,'stopping prepares no further clicks');
  result.checks.push('The switch turns it on, it clicks in time with the piece, and stopping ends it');

  // Turning it off again must not leave anything prepared behind.
  await run(`document.getElementById('metronome').click()`);
  assert.equal(await run(`window.metronome.on`),false);
  assert.equal(await run(`document.getElementById('metronome').getAttribute('aria-pressed')`),'false');

  const level=await run(`(()=>{const slider=document.getElementById('metronome-volume');slider.value='0';slider.oninput();
   return {volume:window.metronome.volume,label:document.getElementById('metronome-volume-value').textContent};})()`);
  assert.deepEqual(level,{volume:0,label:'0%'},'the level control reaches the module');
  result.checks.push('The switch turns off again and the level control is wired');
  finish();
 }catch(error){finish(error);}});});
require('../main.cjs');
