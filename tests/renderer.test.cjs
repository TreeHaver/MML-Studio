const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{transpile}=require('../transpile.cjs');
test('renderer handles click, edge resize, group box/delete, rename, grid and scroll without text nodes on notes',async()=>{
 const elements=new Map();class El{constructor(){this.value='';this.children=[];this.style={};this.clientWidth=900;this.clientHeight=600;this.scrollLeft=0;this.scrollTop=0;this.classList={toggle(){}};}append(...e){this.children.push(...e)}replaceChildren(){this.children=[]}replaceWith(e){this.replacement=e}setAttribute(){}focus(){}select(){}matches(){return false}getBoundingClientRect(){return {left:0,top:0}}setPointerCapture(){this.capture=true}hasPointerCapture(){return this.capture}releasePointerCapture(){this.capture=false}}
 const doc={getElementById:id=>{if(!elements.has(id))elements.set(id,new El());return elements.get(id)},createElement:()=>new El(),querySelectorAll:()=>[]};
 const fills=[];const ctx=new Proxy({fillRect(x,y,w,h){fills.push({x,y,w,h,color:this.fillStyle});}},{get:(target,key)=>key in target?target[key]:()=>{}});doc.getElementById('canvas').getContext=()=>ctx;
 let frame;const seq={currentHighResolutionTime:0,isFinished:false};
 const sandbox={document:doc,window:{setTimeout,clearTimeout},devicePixelRatio:1,ResizeObserver:class{observe(){}},structuredClone,confirm:()=>true,console,requestAnimationFrame:fn=>{frame=fn;return 1;},cancelAnimationFrame:()=>{frame=null;}};vm.createContext(sandbox);
 const previewCalls=[],muteCalls=[];
 const path=require('node:path'),cache=new Map();
 async function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);
 if(file===path.resolve('src/playback/engine.ts')){
  const module=new vm.SyntheticModule(['getPreviewEngine','getEngine'],function(){
   this.setExport('getPreviewEngine',async()=>({preview:async(pitch,program,isDrum)=>previewCalls.push({pitch,program,...(isDrum?{isDrum:true}:{})})}));
   this.setExport('getEngine',async()=>({seq,mute:(channel,muted)=>muteCalls.push({channel,muted}),load:async()=>{},play:async()=>{},pause(){},stop(){seq.currentHighResolutionTime=0;}}));
  },{context:sandbox});cache.set(file,module);return module;
 }
 const module=new vm.SourceTextModule(transpile(fs.readFileSync(file,'utf8'),file),{context:sandbox,identifier:file});cache.set(file,module);return module;}
 const main=await load('src/renderer.ts');await main.link((specifier,ref)=>load(path.resolve(path.dirname(ref.identifier),specifier)));await main.evaluate();
 const noteRendering=(await load('src/rendering/notes.ts')).namespace;assert.equal(noteRendering.noteLabelColor('#1230c8'),'#f7fbff');assert.equal(noteRendering.noteLabelColor('#f4a34e'),'#161b20');
 sandbox.state=(await load('src/state.ts')).namespace.state;
 sandbox.setTool=(await load('src/toolbar.ts')).namespace.setTool;
 const run=s=>vm.runInContext(s.replace(/\bproject\b/g,'state.project').replace(/\bselection\b/g,'state.selection'),sandbox);const c=doc.getElementById('canvas');const event=(x,y)=>({clientX:x,clientY:y,button:0,pointerId:1,preventDefault(){}});
 assert.equal(doc.getElementById('play').disabled,true);
 const click=(x,y)=>{c.onpointerdown(event(x,y));c.onpointerup(event(x,y));};const drag=(x,y,xx,yy)=>{c.onpointerdown(event(x,y));c.onpointermove(event(xx,yy));c.onpointerup(event(xx,yy));};
 click(158,240);assert.equal(run('project.notes.length'),1);
 assert.equal(doc.getElementById('play').disabled,false);
 const mmlBox=()=>doc.getElementById('instruments').children[0].children.find(el=>el.className==='instrument-mml');
 assert.match(mmlBox().children[0].textContent,/Instrument character count: [1-9][0-9]* bytes/);
 const mmlToggle=mmlBox().children[1].children[0];mmlToggle.checked=false;mmlToggle.onchange();
 const frozen=mmlBox().children[0].textContent;
 drag(252,240,348,240);assert.match(mmlBox().children[0].textContent,/Out of date/);
 assert.equal(mmlBox().children[0].textContent.replace(' · Out of date',''),frozen);
 (await load('src/history.ts')).namespace.undo();assert.equal(mmlBox().children[1].children[0].checked,false);
 mmlBox().children[2].onclick();assert.doesNotMatch(mmlBox().children[0].textContent,/Out of date/);
 mmlBox().children[1].children[0].checked=true;mmlBox().children[1].children[0].onchange();
 click(158,240);assert.equal(run('project.notes.length'),1);
 drag(252,240,348,240);assert.equal(run('project.notes[0].length'),64);
 drag(165,240,261,200);assert.equal(run('project.notes[0].start'),64);assert.equal(run('project.notes[0].pitch'),70);
 run("setTool('select')");drag(245,175,455,220);assert.equal(run('selection.size'),1);
 doc.onkeydown({key:'Delete',target:new El(),preventDefault(){}});assert.equal(run('project.notes.length'),0);
 run("setTool('draw')");drag(250,240,538,240);assert.deepEqual(run('project.notes.map(n=>n.start)'),[32,64,96,128]);run("selection.clear();setTool('select')");const moveGeometry=(await load('src/geometry.ts')).namespace,firstPaint=moveGeometry.rect(run('project.notes[0]'));drag(firstPaint.x+4,firstPaint.y+4,firstPaint.x+100,firstPaint.y+4);assert.equal(run('selection.size'),1);assert.equal(run('project.notes[0].start'),64);run('selection=new Set(project.notes.map(n=>n.id))');doc.onkeydown({key:'Delete',target:new El(),preventDefault(){}});
 const row=doc.getElementById('instruments').children[0],button=row.children[1];button.ondblclick();button.replacement.value='Grand Piano';button.replacement.onkeydown({key:'Enter'});assert.equal(run('project.instruments[0].name'),'Grand Piano');
 doc.getElementById('grid').value='128';doc.getElementById('grid').onchange();run("setTool('draw')");click(158,240);assert.equal(run('project.notes[0].length'),1);
 // Each instrument gets the full GM list, and a selected note can carry bounded T.
 const preset=doc.getElementById('instruments').children[0].children[2];
 assert.equal(preset.children.length,130);preset.value='40';preset.onchange();assert.equal(run('project.instruments[0].midiProgram'),40);
 const tempo=doc.getElementById('tempo');tempo.value='32';tempo.onchange();assert.equal(run('project.notes[0].tempo'),32);
 tempo.value='300';tempo.onchange();assert.equal(run('project.notes[0].tempo'),300);
 tempo.value='300.5';tempo.onchange();assert.equal(run('project.notes[0].tempo'),300);
 tempo.value='0';tempo.onchange();assert.equal(run('project.notes[0].tempo'),300);
 tempo.value='';tempo.onchange();assert.equal(run('project.notes[0].tempo'),null);
 doc.getElementById('view').scrollLeft=500;doc.getElementById('view').onscroll();assert.equal(doc.getElementById('canvas').children.length,0);
 // Piano clicks use the visible row and active preset, without editing the song.
 const before=run('JSON.stringify([project,selection.size,state.history,state.dirty])');
 const expected=(await load('src/geometry.ts')).namespace.musical({x:20,y:240}).pitch;
 click(20,240);await new Promise(setImmediate);
 assert.deepEqual(previewCalls,[{pitch:expected,program:40}]);
 const glidePitch=(await load('src/geometry.ts')).namespace.musical({x:20,y:200}).pitch;c.onpointerdown(event(20,240));c.onpointermove(event(20,200));c.onpointerup(event(20,200));await new Promise(setImmediate);assert.deepEqual(previewCalls.slice(-2),[{pitch:expected,program:40},{pitch:glidePitch,program:40}]);
 fills.length=0;run('state.previewPitch='+glidePitch);(await load('src/rendering/keyboard.ts')).namespace.drawKeyboard();assert.ok(fills.some(f=>f.color==='#1689dc'));
 assert.equal(run('JSON.stringify([project,selection.size,state.history,state.dirty])'),before);
 c.onpointerdown({...event(20,240),button:2});click(20,10);await new Promise(setImmediate);
 assert.equal(previewCalls.length,2);
 const kit=doc.getElementById('instruments').children[0].children[2];kit.value='drums';kit.onchange();
 assert.equal(run('project.instruments[0].isDrum'),true);
 assert.match(doc.getElementById('instruments').children[0].children[3].textContent,/Not a valid MS2 instrument/);
 click(20,240);await new Promise(setImmediate);assert.deepEqual(previewCalls.at(-1),{pitch:expected,program:0,isDrum:true});
 const melodic=doc.getElementById('instruments').children[0].children[2];melodic.value='40';melodic.onchange();
 assert.equal(run('project.instruments[0].isDrum'),false);assert.equal(doc.getElementById('instruments').children[0].children.length,7);
 run('project.instruments.push({name:"Other",color:"#fff"});state.active=1');
 doc.getElementById('view').scrollTop+=20;
 click(20,240);await new Promise(setImmediate);
 assert.deepEqual(previewCalls.at(-1),{pitch:expected-1,program:0});
 // Instructions create one-unit silent events, allow horizontal movement,
 // and draw a yellow global line even while another instrument is active.
 (await load('src/commands.ts')).namespace.refresh();
 const instructionPreset=doc.getElementById('instruments').children[1].children[2];instructionPreset.value='instructions';instructionPreset.onchange();
 assert.equal(run('project.instruments[1].name'),'Instructions');
 drag(350,240,400,280);
 const marker=run('project.notes.find(n=>n.instrument===1)');assert.equal(marker.length,1);assert.equal(marker.volume,0);
 assert.equal(doc.getElementById('pitch').disabled,true);assert.equal(doc.getElementById('length').disabled,true);assert.equal(doc.getElementById('volume').disabled,true);
 tempo.value='90';tempo.onchange();
 const geometry=(await load('src/geometry.ts')).namespace,r=geometry.rect(run('project.notes.find(n=>n.instrument===1)'));
 drag(r.x+5,r.y+5,r.x+101,r.y+45);
 const moved=run('project.notes.find(n=>n.instrument===1)');assert.equal(moved.pitch,marker.pitch);assert.equal(moved.start,marker.start+32);
 const previewsBefore=previewCalls.length;click(20,240);await new Promise(setImmediate);assert.equal(previewCalls.length,previewsBefore);
 run('state.active=0');fills.length=0;(await load('src/painting.ts')).namespace.draw();
 const {KEY,HEAD}=(await load('src/constants.ts')).namespace;
 assert.ok(fills.some(f=>f.color==='#f4d35e'&&f.x===KEY+moved.start*3-doc.getElementById('view').scrollLeft&&f.y===HEAD&&f.h===600-HEAD));
 doc.onkeydown({key:'Delete',target:new El(),preventDefault(){}});assert.equal(run('project.notes.some(n=>n.id==='+moved.id+')'),false);
 (await load('src/history.ts')).namespace.undo();assert.equal(run('project.notes.some(n=>n.id==='+moved.id+')'),true);
 // Actual transport animation invokes follow and freezes scrolling on pause.
 run('project.notes=[{id:1,instrument:0,start:0,length:1024,pitch:60,volume:8}];selection.clear()');
 const transport=(await load('src/playback/transport.ts')).namespace,view=doc.getElementById('view'),vertical=view.scrollTop;
 await transport.play();assert.equal(view.scrollLeft,0);
 seq.currentHighResolutionTime=8;frame();assert.ok(view.scrollLeft>0);assert.equal(view.scrollTop,vertical);
 const left=view.scrollLeft;doc.getElementById('pause').onclick();assert.equal(frame,null);assert.equal(view.scrollLeft,left);
 await transport.play();assert.equal(view.scrollTop,vertical);
 const prefs=(await load('src/state.ts')).namespace;
 const rows=()=>doc.getElementById('instruments').children;
 const control=(index,label)=>rows()[index].children.find(el=>el.className==='instrument-controls').children.find(el=>el.textContent===label);
 run('project.instruments.push({name:"Third",color:"#fff"})');
 (await load('src/commands.ts')).namespace.refresh();
 const saved=run('JSON.stringify(project)'),history=run('state.history.length');
 control(0,'Mute').onclick();assert.equal(prefs.isMuted(0),true);assert.equal(prefs.isMuted(1),false);
 assert.deepEqual(muteCalls.at(-1),{channel:0,muted:true});
 assert.equal(geometry.hit(geometry.rect(run('project.notes[0]'))),undefined);
 const count=run('project.notes.length');click(300,240);assert.equal(run('project.notes.length'),count);
 fills.length=0;(await load('src/rendering/notes.ts')).namespace.drawNotes();assert.equal(fills.length,0);
 control(1,'Solo').onclick();assert.equal(prefs.isMuted(0),true);assert.equal(prefs.isMuted(1),false);
 control(0,'Solo').onclick();assert.equal(prefs.isMuted(0),false);assert.equal(prefs.isMuted(1),true);
 control(0,'Solo').onclick();assert.equal(prefs.isMuted(0),false);assert.equal(prefs.isMuted(1),false);
 // Solo is a bulk mute action: release one other lane without releasing the rest.
 control(1,'Solo').onclick();control(0,'Mute').onclick();
 assert.equal(prefs.instrumentView.solo,null);
 assert.deepEqual([0,1,2].map(prefs.isMuted),[false,false,true]);
 assert.deepEqual(muteCalls.at(-1),{channel:0,muted:false});
 fills.length=0;(await load('src/rendering/notes.ts')).namespace.drawNotes();assert.ok(fills.length>0);
 control(0,'Mute').onclick();assert.deepEqual([0,1,2].map(prefs.isMuted),[true,false,true]);
 control(2,'Solo').onclick();assert.deepEqual([0,1,2].map(prefs.isMuted),[true,true,false]);
 control(2,'Solo').onclick();assert.deepEqual([0,1,2].map(prefs.isMuted),[false,false,false]);
 rows()[0].children[1].onclick();assert.equal(prefs.instrumentView.collapsed.has(0),true);
 rows()[0].children[1].onclick();assert.equal(prefs.instrumentView.collapsed.has(0),false);
 rows()[1].children[1].onclick();assert.equal(run('state.active'),1);
 assert.equal(run('JSON.stringify(project)'),saved);assert.equal(run('state.history.length'),history);
 transport.stopPlayback();
 // Copy/paste snapshots a group, allocates fresh IDs, preserves inherited volume,
 // targets the selected lane and can be undone/redone as one edit.
 const clipboard=(await load('src/note-clipboard.ts')).namespace;
 const previous=run('JSON.stringify(project)');
 run('state.active=0;project.notes=[{id:10,instrument:0,start:0,length:7,pitch:60,volume:11},{id:11,instrument:0,start:9,length:5,pitch:64,volume:null}];selection=new Set([10,11])');
 const keys=key=>doc.onkeydown({key,ctrlKey:true,target:new El(),preventDefault(){}});
 const copied=run('JSON.stringify(project)');keys('c');keys('v');
 assert.equal(run('project.notes.length'),4);assert.equal(run('selection.size'),2);
 assert.deepEqual(JSON.parse(run('JSON.stringify(project.notes.slice(2).map(n=>[n.id,n.start,n.length,n.pitch,n.volume]))')),[[12,14,7,60,11],[13,23,5,64,11]]);
 (await load('src/history.ts')).namespace.undo();assert.equal(run('JSON.stringify(project)'),copied);
 (await load('src/history.ts')).namespace.undo(true);assert.equal(run('project.notes.length'),4);
 run('state.active=2');clipboard.setPastePosition(64);keys('v');assert.equal(run('project.notes.at(-1).instrument'),2);assert.equal(run('project.notes.at(-1).start'),73);
 const pasted=run('JSON.stringify(project)');run('state.active=1');keys('v');assert.equal(run('JSON.stringify(project)'),pasted);
 run('state.active=2');prefs.instrumentView.muted.add(2);keys('v');assert.equal(run('JSON.stringify(project)'),pasted);prefs.instrumentView.muted.delete(2);
 const textField=new El();textField.matches=()=>true;doc.onkeydown({key:'v',ctrlKey:true,target:textField,preventDefault(){throw Error('Text editing must keep native paste');}});
 run('state.active=0;project.notes=[{id:1,instrument:0,start:0,length:7,pitch:60,volume:null,tempo:90},{id:2,instrument:0,start:32,length:7,pitch:62,volume:null,tempo:120}];selection=new Set([1])');keys('c');clipboard.setPastePosition(32);
 const conflicting=run('JSON.stringify(project)'),historyBefore=run('state.history.length');keys('v');assert.equal(run('JSON.stringify(project)'),conflicting);assert.equal(run('state.history.length'),historyBefore);
 sandbox.restoreClipboardFixture=JSON.parse(previous);run('project=restoreClipboardFixture;state.active=0;selection.clear()');(await load('src/commands.ts')).namespace.refresh();
 // Destructive actions cancel cleanly, remap lane preferences and undo/redo exactly.
 const actions=(await load('src/instrument-actions.ts')).namespace;
 const original=run('JSON.stringify(project)');
 sandbox.confirm=()=>false;actions.removeInstrument(0);assert.equal(run('JSON.stringify(project)'),original);
 sandbox.confirm=()=>true;
 prefs.instrumentView.muted.add(2);prefs.instrumentView.collapsed.add(2);
 await transport.play();assert.equal(doc.getElementById('pause').disabled,false);
 actions.mergeInstrument(0,2);assert.equal(run('project.instruments.length'),2);assert.equal(run('project.notes[0].instrument'),1);
 assert.equal(doc.getElementById('stop').disabled,true);assert.equal(frame,null);
 assert.equal(run('state.active'),1);assert.equal(prefs.isMuted(1),true);assert.equal(prefs.instrumentView.collapsed.has(1),true);
 const merged=run('JSON.stringify(project)');(await load('src/history.ts')).namespace.undo();assert.equal(run('JSON.stringify(project)'),original);
 (await load('src/history.ts')).namespace.undo(true);assert.equal(run('JSON.stringify(project)'),merged);
 actions.removeInstrument(1);assert.equal(run('project.notes.length'),0);assert.equal(run('state.active'),0);
 (await load('src/history.ts')).namespace.undo();assert.equal(run('JSON.stringify(project)'),merged);
 control(0,'Solo').onclick();doc.getElementById('new').onclick();assert.equal(prefs.instrumentView.solo,null);assert.equal(prefs.instrumentView.muted.size,0);
});
