const {app}=require('electron'),fs=require('node:fs'),assert=require('node:assert/strict');
const timer=setTimeout(()=>finish(Error('Timed out')),30000);
function finish(error){clearTimeout(timer);fs.mkdirSync('.validation',{recursive:true});fs.writeFileSync('.validation/electron-instruments.json',JSON.stringify({passed:!error,error:error?String(error.stack):undefined},null,2));app.exit(error?1:0);}
app.on('browser-window-created',(_,win)=>win.webContents.once('did-finish-load',async()=>{try{
 let stage='';const evaluate=code=>{stage=code;return win.webContents.executeJavaScript(code,true).catch(error=>{throw Error(String(error.message||error)+' | while running: '+String(code).slice(0,220));});};
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/commands.js')]).then(([{state},{refresh}])=>{state.project.instruments=Array.from({length:17},(_,i)=>({name:'Instrument '+i,color:'#77baff',isDrum:i===16}));state.project.notes=state.project.instruments.map((_,i)=>({id:i+1,instrument:i,start:0,length:2048,pitch:60,volume:8}));refresh();})`);
 const expanded=await evaluate(`document.querySelector('.instrument').offsetHeight`);
 await evaluate(`document.querySelector('.instrument-name').click()`);
 assert.ok(await evaluate(`document.querySelector('.instrument').offsetHeight`)<expanded);
 assert.equal(await evaluate(`getComputedStyle(document.querySelector('.instrument-controls')).display`),'none');
 await evaluate(`document.querySelector('.instrument-name').click();document.querySelectorAll('.instrument-controls button')[1].click()`);
 await evaluate(`import('./dist/playback/transport.js').then(m=>m.play())`);
 assert.equal(await evaluate(`document.getElementById('play').classList.contains('is-playing')`),true);
 await evaluate(`document.querySelectorAll('.instrument-controls button')[33].click()`);
 assert.deepEqual(await evaluate(`import('./dist/state.js').then(m=>[m.isMuted(0),m.isMuted(16)])`),[true,false]);
 await evaluate(`document.querySelectorAll('.instrument-controls button')[33].click();document.querySelectorAll('.instrument-controls button')[0].click();document.getElementById('play').click();`);
 await evaluate(`import('./dist/playback/transport.js').then(m=>m.play())`);
 await evaluate(`document.getElementById('stop').click()`);
 // Native rendered dropdown: filtering preserves project/history and warns on retained presets.
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/commands.js')]).then(([{state},{refresh}])=>{state.project.instruments[0].midiProgram=1;refresh();window.beforeFilter=JSON.stringify([state.project,state.history,state.active,[...state.selection]]);})`);
 await evaluate(`document.getElementById('vanilla-only').click()`);
 const toggleStyle=()=>evaluate(`(()=>{const s=getComputedStyle(document.getElementById('vanilla-only'));return [s.backgroundColor,s.borderTopColor,s.color]})()`);
 await evaluate(`document.documentElement.dataset.theme='night'`);
 assert.deepEqual(await toggleStyle(),['rgb(73, 48, 27)','rgb(233, 149, 64)','rgb(255, 186, 112)']);
 await evaluate(`document.documentElement.dataset.theme='sky'`);
 assert.deepEqual(await toggleStyle(),['rgb(214, 237, 253)','rgb(8, 124, 190)','rgb(8, 124, 190)']);
 assert.equal(await evaluate(`import('./dist/state.js').then(({state})=>JSON.stringify([state.project,state.history,state.active,[...state.selection]])===window.beforeFilter)`),true);
 assert.deepEqual(await evaluate(`(()=>{const s=document.querySelector('.instrument select[aria-label^="Playback preset"]');return [s.value,s.selectedOptions[0].hidden,getComputedStyle(s).color]})()`),['1',true,'rgb(244, 211, 94)']);
 await evaluate(`document.querySelector('.instrument select[aria-label^="Playback preset"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}))`);
 const choices=await evaluate(`[...document.querySelectorAll('.select-panel button')].map(b=>b.textContent)`);
 assert.ok(choices.includes('1. Piano'));assert.ok(choices.includes('5. Electric Piano'));assert.ok(choices.includes('Snare Drum'));
 assert.equal(choices.length,40);
 assert.deepEqual(await evaluate(`Object.fromEntries([...document.querySelector('.instrument select[aria-label^="Playback preset"]').options].filter(o=>!o.hidden&&['29','33','34','19','65','117'].includes(o.value)).map(o=>[o.value,o.textContent]))`),{'29':'30. Electric Guitar','33':'34. Bass','34':'35. Pick Bass Guitar','19':'20. Organ','65':'66. Saxophone','117':'118. Tom-Tom'});
 assert.ok(!choices.some(text=>/Bright Acoustic|Standard Drum/.test(text)));
 await evaluate(`document.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));document.getElementById('vanilla-only').click()`);
 assert.equal(await evaluate(`document.querySelector('.instrument select[aria-label^="Playback preset"]').value`),'1');
 assert.equal(await evaluate(`getComputedStyle(document.querySelectorAll('.instrument select[aria-label^="Playback preset"]')[16]).color`),'rgb(244, 211, 94)');
 await evaluate(`document.querySelectorAll('.instrument select[aria-label^="Playback preset"]')[16].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}))`);
 assert.equal(await evaluate(`getComputedStyle([...document.querySelectorAll('.select-panel button')].find(b=>b.textContent.includes('Standard Drum Kit'))).color`),'rgb(244, 211, 94)');
 await evaluate(`document.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));document.getElementById('vanilla-only').click()`);
 assert.equal(await evaluate(`document.querySelectorAll('.instrument select[aria-label^="Playback preset"]')[16].value`),'drums');
 await evaluate(`document.querySelectorAll('.instrument select[aria-label^="Playback preset"]')[16].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}))`);
 assert.equal(await evaluate(`[...document.querySelectorAll('.select-panel button')].some(b=>b.textContent.includes('Standard Drum Kit'))`),false);
 await evaluate(`document.querySelectorAll('.instrument select[aria-label^="Playback preset"]')[16].dispatchEvent(new KeyboardEvent('keydown',{key:'p',bubbles:true,cancelable:true}));document.querySelectorAll('.instrument select[aria-label^="Playback preset"]')[16].dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))`);
 assert.equal(await evaluate(`document.querySelectorAll('.instrument select[aria-label^="Playback preset"]')[16].value`),'0');
 // The panel has to stay usable with an imported project: dozens of tracks, all named after
 // the same song, with the part that tells them apart at the end of the name.
 await evaluate(`Promise.all([import('./dist/state.js'),import('./dist/commands.js')]).then(([{state,instrumentView},{refresh}])=>{instrumentView.muted.clear();instrumentView.solo=null;state.project.instruments=[{name:'Off The Wall · Ch 2 · Synth Bass',color:'#77baff'},{name:'Off The Wall · Ch 9 · Saxophone',color:'#77baff'},{name:'Off The Wall · Ch 11 · Tenor Sax',color:'#77baff'},{name:'Piano',color:'#77baff'}];state.project.notes=state.project.instruments.map((_,i)=>({id:i+1,instrument:i,start:0,length:128,pitch:60,volume:8}));state.active=0;state.selection.clear();refresh();})`);
 assert.deepEqual(await evaluate(`[...document.querySelectorAll('.instrument-name')].map(b=>b.textContent)`),
  ['Ch 2 · Synth Bass','Ch 9 · Saxophone','Ch 11 · Tenor Sax','Piano','Instructions'],
  'The repeated song title is dropped from the label');
 assert.match(await evaluate(`document.querySelector('.instrument-name').title`),/Off The Wall/,'the whole name stays in the tooltip');

 // Searching matches the whole stored name, including the part not shown.
 await evaluate(`(()=>{const s=document.getElementById('instrument-search');s.value='sax';s.dispatchEvent(new Event('input'));})()`);
 assert.deepEqual(await evaluate(`[...document.querySelectorAll('.instrument-name')].map(b=>b.textContent)`),
  ['Ch 9 · Saxophone','Ch 11 · Tenor Sax']);
 await evaluate(`(()=>{const s=document.getElementById('instrument-search');s.value='off the wall';s.dispatchEvent(new Event('input'));})()`);
 assert.equal(await evaluate(`document.querySelectorAll('.instrument-name').length`),3,'a search on the hidden part of the name still matches');
 await evaluate(`(()=>{const s=document.getElementById('instrument-search');s.value='zzz';s.dispatchEvent(new Event('input'));})()`);
 assert.equal(await evaluate(`document.getElementById('instrument-empty').hidden`),false,'an empty result says so');
 await evaluate(`(()=>{const s=document.getElementById('instrument-search');s.value='';s.dispatchEvent(new Event('input'));})()`);
 assert.equal(await evaluate(`document.getElementById('instrument-empty').hidden`),true);

 // One switch collapses the lot, and opens them again.
 const tall=await evaluate(`document.querySelector('.instrument').offsetHeight`);
 await evaluate(`document.getElementById('collapse-all').click()`);
 assert.ok(await evaluate(`document.querySelector('.instrument').offsetHeight`)<tall,'collapse all shortens every card');
 assert.equal(await evaluate(`[...document.querySelectorAll('.instrument:not(.instructions-lane)')].every(el=>el.classList.contains('collapsed'))`),true);
 await evaluate(`document.getElementById('collapse-all').click()`);
 assert.equal(await evaluate(`[...document.querySelectorAll('.instrument:not(.instructions-lane)')].some(el=>el.classList.contains('collapsed'))`),false);

 // The two panel switches sit together now, and the preset filter says MS2 for short.
 assert.equal(await evaluate(`document.getElementById('vanilla-only').closest('.panel-switches')===document.getElementById('advanced-instructions').closest('.panel-switches')`),true);
 assert.equal(await evaluate(`document.getElementById('vanilla-only').textContent`),'Show only MS2 instruments');

 finish();
}catch(e){finish(e);}}));require('../main.cjs');
