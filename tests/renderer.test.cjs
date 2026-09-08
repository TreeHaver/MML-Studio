const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{transpile}=require('../transpile.cjs');
test('renderer handles click, edge resize, group box/delete, rename, grid and scroll without text nodes on notes',async()=>{
 const elements=new Map();class El{constructor(){this.value='';this.children=[];this.style={};this.dataset={};this.clientWidth=900;this.clientHeight=600;this.scrollLeft=0;this.scrollTop=0;this.classList={names:new Set(),toggle(name,on){on?this.names.add(name):this.names.delete(name)},add(name){this.names.add(name)},remove(name){this.names.delete(name)},contains(name){return this.names.has(name)}};}addEventListener(type,handler){this["on"+type]=handler}append(...e){this.children.push(...e)}replaceChildren(...e){this.children=[...e]}replaceWith(e){this.replacement=e}after(e){this.replacement=e}querySelector(){return null}set innerHTML(value){this._html=value;const match=/<span>(.*?)<\/span>/.exec(value);if(match)this.textContent=match[1]}get innerHTML(){return this._html}setAttribute(name,value){(this.attributes??={})[name]=String(value)}getAttribute(name){return this.attributes?.[name]??null}focus(){}select(){}matches(){return false}getBoundingClientRect(){return {left:0,top:0}}setPointerCapture(){this.capture=true}hasPointerCapture(){return this.capture}releasePointerCapture(){this.capture=false}}
 const htmlIds=new Set([...fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8').matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]));
 const doc={getElementById:id=>{assert.ok(htmlIds.has(id),`Missing editor element #${id} in index.html`);if(!elements.has(id))elements.set(id,new El());return elements.get(id)},createElement:()=>new El(),querySelectorAll:()=>[]};
 const fills=[],texts=[];const ctx=new Proxy({measureText(text){return {width:text.length*6}},fillText(text,x,y){texts.push({text,x,y})},fillRect(x,y,w,h){fills.push({x,y,w,h,color:this.fillStyle,alpha:this.globalAlpha});}},{get:(target,key)=>key in target?target[key]:()=>{}});doc.getElementById('canvas').getContext=()=>ctx;
 let frame;const seq={currentHighResolutionTime:0,isFinished:false,get currentTime(){return this.currentHighResolutionTime},set currentTime(value){this.currentHighResolutionTime=value}};
 const sandbox={queueMicrotask,document:doc,window:{setTimeout,clearTimeout},setInterval:()=>0,clearInterval:()=>{},devicePixelRatio:1,ResizeObserver:class{observe(){}},structuredClone,confirm:()=>true,console,requestAnimationFrame:fn=>{frame=fn;return 1;},cancelAnimationFrame:()=>{frame=null;}};vm.createContext(sandbox);
 const previewCalls=[],muteCalls=[],songLoads=[],restoredNotes=[],masterVolumes=[];let loadGate=null;
 const path=require('node:path'),cache=new Map();
 async function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);
 if(file===path.resolve('src/playback/engine.ts')){
  const module=new vm.SyntheticModule(['getPreviewEngine','getEngine','setMasterVolume'],function(){
   this.setExport('setMasterVolume',value=>masterVolumes.push(value));
   this.setExport('getPreviewEngine',async()=>({preview:async(pitch,program,isDrum)=>previewCalls.push({pitch,program,...(isDrum?{isDrum:true}:{})})}));
   this.setExport('getEngine',async()=>({seq,mute:(channel,muted)=>muteCalls.push({channel,muted}),load:async binary=>{songLoads.push(binary);if(loadGate)await loadGate;},restoreNotes:notes=>restoredNotes.push(notes),play:async()=>{},pause(){},stop(){seq.currentHighResolutionTime=0;}}));
  },{context:sandbox});cache.set(file,module);return module;
 }
 const module=new vm.SourceTextModule(transpile(fs.readFileSync(file,'utf8'),file),{context:sandbox,identifier:file});cache.set(file,module);return module;}
 const main=await load('src/renderer.ts');await main.link((specifier,ref)=>load(path.resolve(path.dirname(ref.identifier),specifier)));await main.evaluate();
 const noteRendering=(await load('src/rendering/notes.ts')).namespace;assert.equal(noteRendering.noteLabelColor('#1230c8'),'#f7fbff');assert.equal(noteRendering.noteLabelColor('#f4a34e'),'#161b20');
 sandbox.state=(await load('src/state.ts')).namespace.state;
 sandbox.setTool=(await load('src/toolbar.ts')).namespace.setTool;
 const run=s=>vm.runInContext(s.replace(/\bproject\b/g,'state.project').replace(/\bselection\b/g,'state.selection'),sandbox);const c=doc.getElementById('canvas');const event=(x,y)=>({clientX:x,clientY:y,button:0,pointerId:1,preventDefault(){}});
 // View zoom changes geometry and scroll anchoring without changing project contents.
 const zoomView=doc.getElementById('view'),zoomGeometry=(await load('src/geometry.ts')).namespace;
 const zoomBefore=run('JSON.stringify([project,state.history,state.dirty])'),oldTop=zoomView.scrollTop;
 doc.getElementById('vertical-zoom').value='2';doc.getElementById('vertical-zoom').oninput();
 assert.equal(run('state.verticalZoom'),2);assert.equal(zoomView.scrollTop,oldTop*2);
 assert.equal(zoomGeometry.rect({start:0,length:32,pitch:60,instrument:0}).h,39);
 const anchored=zoomGeometry.musical({x:100,y:240}).pitch;let prevented=false;
 zoomView.onwheel({ctrlKey:true,deltaY:-100,clientY:240,preventDefault(){prevented=true}});
 assert.equal(prevented,true);assert.equal(run('state.verticalZoom'),2.1);
 assert.equal(zoomGeometry.musical({x:100,y:240}).pitch,anchored);
 zoomView.onwheel({ctrlKey:false,deltaY:100,preventDefault(){throw Error('ordinary scroll blocked')}});
 doc.getElementById('zoom').value='6';doc.getElementById('zoom').oninput();
 doc.getElementById('reset-zoom').onclick();assert.equal(run('state.zoom'),3);assert.equal(run('state.verticalZoom'),1);
 assert.equal(doc.getElementById('zoom').value,'3');assert.equal(doc.getElementById('vertical-zoom').value,'1');
 assert.equal(run('JSON.stringify([project,state.history,state.dirty])'),zoomBefore);zoomView.scrollTop=oldTop;
 assert.equal(doc.getElementById('play').disabled,true);
 const click=(x,y)=>{c.onpointerdown(event(x,y));c.onpointerup(event(x,y));};const drag=(x,y,xx,yy)=>{c.onpointerdown(event(x,y));c.onpointermove(event(xx,yy));c.onpointerup(event(xx,yy));};
 click(158,240);assert.equal(run('project.notes.length'),1);
 assert.equal(doc.getElementById('play').disabled,false);
 const mmlHome=()=>doc.getElementById('instruments').children[0].children.find(el=>el.className==='instrument-actions').children.find(el=>el.className==='instrument-action-body');
 const mmlBox=()=>mmlHome().children.find(el=>el.className==='instrument-mml');
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
 drag(165,240,261,194);assert.equal(run('project.notes[0].start'),64);assert.equal(run('project.notes[0].pitch'),69);
 run("setTool('select')");drag(245,175,455,220);assert.equal(run('selection.size'),1);
 doc.onkeydown({key:'Delete',target:new El(),preventDefault(){}});assert.equal(run('project.notes.length'),0);
 run("setTool('spray')");drag(250,240,538,240);assert.deepEqual(run('project.notes.map(n=>n.start)'),[32,64,96,128]);run("selection.clear();setTool('select')");const moveGeometry=(await load('src/geometry.ts')).namespace,firstPaint=moveGeometry.rect(run('project.notes[0]'));drag(firstPaint.x+4,firstPaint.y+4,firstPaint.x+100,firstPaint.y+4);assert.equal(run('selection.size'),1);assert.equal(run('project.notes[0].start'),64);run('selection=new Set(project.notes.map(n=>n.id))');doc.onkeydown({key:'Delete',target:new El(),preventDefault(){}});
 const row=doc.getElementById('instruments').children[0],button=row.children[1];row.children.find(el=>el.className==='instrument-row-rename').onclick();button.replacement.value='Grand Piano';button.replacement.onkeydown({key:'Enter'});assert.equal(run('project.instruments[0].name'),'Grand Piano');
 doc.getElementById('grid').value='128';doc.getElementById('grid').onchange();run("setTool('draw')");click(158,240);assert.equal(run('project.notes[0].length'),1);
 // Each instrument gets the full GM list, and a selected note can carry bounded T.
 const preset=doc.getElementById('instruments').children[0].children[2];
 // The list is built the first time it is asked for, so a hundred instruments do not cost
 // a hundred full lists on every rebuild. Until then the select holds its current value.
 assert.equal(preset.children.length,1,'only the chosen preset is built up front');
 preset.fillOptions();
 assert.equal(preset.children.length,132);preset.value='40';preset.onchange();assert.equal(run('project.instruments[0].midiProgram'),40);
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
 const flag=()=>doc.getElementById('instruments').children[0].children.find(el=>el.className==='instrument-flag');
 assert.match(flag().getAttribute('data-message'),/Not a valid MS2 instrument/);
 assert.equal(flag().hidden,false);
 click(20,240);await new Promise(setImmediate);assert.deepEqual(previewCalls.at(-1),{pitch:expected,program:0,isDrum:true});
 const melodic=doc.getElementById('instruments').children[0].children[2];melodic.value='40';melodic.onchange();
 assert.equal(run('project.instruments[0].isDrum'),false);assert.equal(flag().hidden,true,'a valid instrument shows no warning marker');
 run('project.instruments.push({name:"Other",color:"#fff"});state.active=1');
 doc.getElementById('view').scrollTop+=20;
 click(20,240);await new Promise(setImmediate);
 assert.deepEqual(previewCalls.at(-1),{pitch:65,program:0}); // 20px crosses a 15px sharp row here.
 // Instructions create one-unit silent events, allow horizontal movement,
 // and draw a yellow global line even while another instrument is active.
 run('project.instruments.pop()');(await load('src/commands.ts')).namespace.refresh();
 if(doc.getElementById('advanced-instructions').getAttribute('aria-pressed')!=='true')doc.getElementById('advanced-instructions').onclick();
 doc.getElementById('instruments').children[1].children[0].onclick();
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
 const left=view.scrollLeft;doc.getElementById('play').onclick();assert.equal(frame,null);assert.equal(view.scrollLeft,left);
 await transport.play();assert.equal(view.scrollTop,vertical);
 const prefs=(await load('src/state.ts')).namespace;
 const rows=()=>doc.getElementById('instruments').children;
 const control=(index,label)=>rows()[index].children.find(el=>el.className==='instrument-controls').children.find(el=>el.textContent===label);
 run('project.instruments[1]={name:"Second",color:"#ffffff"};project.instruments.push({name:"Third",color:"#fff"})');
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
 // Current Solo isolation preserves explicit mute flags.
 control(1,'Solo').onclick();assert.deepEqual([0,1,2].map(prefs.isMuted),[true,false,true]);
 control(1,'Solo').onclick();assert.deepEqual([0,1,2].map(prefs.isMuted),[false,false,false]);
 rows()[0].children[1].onclick();assert.equal(prefs.instrumentView.collapsed.has(0),true);
 rows()[0].children[1].onclick();assert.equal(prefs.instrumentView.collapsed.has(0),false);
 rows()[1].children[1].onclick();assert.equal(run('state.active'),1);
 assert.equal(run('JSON.stringify(project)'),saved);assert.equal(run('state.history.length'),history);
 transport.stopPlayback();
 const beforeDragFixture=run('JSON.stringify(project)'),beforeDragTool=run('state.tool'),beforeDragScroll=[view.scrollLeft,view.scrollTop];
 // Moving a group follows scroll displacement from the initial viewport, including
 // animation frames with no new pointer event. Release/cancel stops the scroll loop.
 run('state.active=0;project.grid=128;state.tool="select";project.notes=[{id:1,instrument:0,start:200,length:7,pitch:60,volume:8},{id:2,instrument:0,start:209,length:5,pitch:64,volume:8}];selection=new Set([1,2])');
 view.scrollLeft=500;(await load('src/commands.ts')).namespace.refresh();
 const dragRect=geometry.rect(run('project.notes[0]')),dragY=dragRect.y+4,dragX=dragRect.x+3;
 const dragOriginal=run('JSON.stringify(project)'),dragHistory=run('state.history.length');
 c.onpointerdown(event(dragX,dragY));c.onpointermove(event(dragX+2,dragY));assert.equal(run('state.gesture.moved'),undefined);
 c.onpointermove(event(899,dragY));const beforeEdge=run('project.notes[0].start');
 frame();frame();frame();assert.ok(view.scrollLeft>500);assert.ok(run('project.notes[0].start')>beforeEdge);
 assert.equal(run('project.notes[1].start-project.notes[0].start'),9);assert.equal(run('project.notes[0].pitch'),60);assert.equal(run('project.notes[1].length'),5);
 const scrolledStart=run('project.notes[0].start');c.onpointermove(event(899,dragY));assert.equal(run('project.notes[0].start'),scrolledStart,'pointer movement must not discard scroll displacement');
 c.onpointerup(event(899,dragY));assert.equal(frame,null);assert.equal(run('state.history.length'),dragHistory+1);
 (await load('src/history.ts')).namespace.undo();assert.equal(run('JSON.stringify(project)'),dragOriginal);
 run('selection=new Set([1,2])');view.scrollLeft=500;
 const leftRect=geometry.rect(run('project.notes[0]'));c.onpointerdown(event(leftRect.x+3,leftRect.y+4));c.onpointermove(event(KEY+1,leftRect.y+4));
 const beforeLeft=view.scrollLeft;frame();frame();assert.ok(view.scrollLeft<beforeLeft);
 c.onpointercancel();assert.equal(frame,null);assert.equal(run('JSON.stringify(project)'),dragOriginal);
 // Box selection retains its existing scrolling behavior.
 c.onpointerdown({...event(300,240),shiftKey:true});c.onpointermove(event(899,590));const boxLeft=view.scrollLeft;frame();assert.ok(view.scrollLeft>boxLeft);c.onpointercancel();assert.equal(frame,null);
 sandbox.beforeDragFixture=JSON.parse(beforeDragFixture);sandbox.beforeDragTool=beforeDragTool;run('project=beforeDragFixture;state.tool=beforeDragTool');[view.scrollLeft,view.scrollTop]=beforeDragScroll;
 // Copy/paste snapshots a group, allocates fresh IDs, preserves inherited volume,
 // targets the selected lane and can be undone/redone as one edit.
 const clipboard=(await load('src/note-clipboard.ts')).namespace;
 const previous=run('JSON.stringify(project)');
 run('state.active=0;project.notes=[{id:10,instrument:0,start:0,length:7,pitch:60,volume:11},{id:11,instrument:0,start:9,length:5,pitch:64,volume:null}];selection=new Set([10,11])');
 const keys=key=>doc[key==='c'?'oncopy':'onpaste']({target:new El(),preventDefault(){},clipboardData:{getData:()=>'' ,setData(){}}});
 const copied=run('JSON.stringify(project)');keys('c');keys('v');
 assert.equal(run('project.notes.length'),4);assert.equal(run('selection.size'),2);
 assert.deepEqual(JSON.parse(run('JSON.stringify(project.notes.slice(2).map(n=>[n.id,n.start,n.length,n.pitch,n.volume]))')),[[12,14,7,60,11],[13,23,5,64,11]]);
 (await load('src/history.ts')).namespace.undo();assert.equal(run('JSON.stringify(project)'),copied);
 (await load('src/history.ts')).namespace.undo(true);assert.equal(run('project.notes.length'),4);
 run('selection=new Set([12,13])');keys('v');assert.deepEqual(JSON.parse(run('JSON.stringify(project.notes.slice(-2).map(n=>n.start))')),[28,37]);
 run('state.active=2');clipboard.setPastePosition(64);keys('v');assert.equal(run('project.notes.at(-1).instrument'),2);assert.equal(run('project.notes.at(-1).start'),9);
 run('project.instruments[1].isInstructions=true');const pasted=run('JSON.stringify(project)');run('state.active=1');keys('v');assert.equal(run('JSON.stringify(project)'),pasted);
 run('state.active=2');prefs.instrumentView.muted.add(2);keys('v');assert.equal(run('JSON.stringify(project)'),pasted);prefs.instrumentView.muted.delete(2);
 const textField=new El();textField.matches=()=>true;doc.onkeydown({key:'v',ctrlKey:true,target:textField,preventDefault(){throw Error('Text editing must keep native paste');}});
 // A long low note supplies the latest end, regardless of onset, pitch, or selection order.
 run('state.active=0;project.notes=[{id:1,instrument:0,start:41,length:7,pitch:60,volume:0},{id:2,instrument:0,start:50,length:5,pitch:64,volume:11}];selection=new Set([1,2])');keys('c');
 const originalCopy=run('JSON.stringify(project.notes)');doc.onkeydown({key:'Delete',target:new El(),preventDefault(){}});keys('v');assert.equal(run('JSON.stringify(project.notes)'),originalCopy);
 run('project.notes.push({id:10,instrument:0,start:100,length:100,pitch:40,volume:8},{id:11,instrument:0,start:150,length:7,pitch:90,volume:8});selection=new Set([10,11])');keys('v');assert.deepEqual(JSON.parse(run('JSON.stringify(project.notes.slice(-2).map(n=>n.start))')),[200,209]);
 // Selecting another instance of the same voice clears selection and keeps original timestamps.
 (await load('src/commands.ts')).namespace.refresh();rows()[2].children[1].onclick();assert.equal(run('selection.size'),0);keys('v');assert.deepEqual(JSON.parse(run('JSON.stringify(project.notes.slice(-2).map(n=>[n.instrument,n.start]))')),[[2,41],[2,50]]);
 run('state.active=0;project.notes=[{id:1,instrument:0,start:0,length:7,pitch:60,volume:null,tempo:90},{id:2,instrument:0,start:32,length:7,pitch:62,volume:null,tempo:120},{id:3,instrument:0,start:25,length:7,pitch:50,volume:8}];selection=new Set([1])');keys('c');run('selection=new Set([3])');
 const conflicting=run('JSON.stringify(project)'),historyBefore=run('state.history.length');keys('v');assert.equal(run('JSON.stringify(project)'),conflicting);assert.equal(run('state.history.length'),historyBefore);
 run('state.active=2');clipboard.setPastePosition(512);
 const textPaste=text=>doc.onpaste({target:new El(),preventDefault(){},clipboardData:{getData:type=>type==='text/plain'?text:''}});
 const countBefore=run('project.notes.length');textPaste('o4c8d8');assert.equal(run('project.notes.length'),countBefore+2);assert.equal(run('project.notes.at(-2).start'),512);
 const afterMml=run('JSON.stringify(project)');textPaste('not music');assert.equal(run('JSON.stringify(project)'),afterMml);

 sandbox.restoreClipboardFixture=JSON.parse(previous);run('project=restoreClipboardFixture;state.active=0;selection.clear()');(await load('src/commands.ts')).namespace.refresh();
 // Destructive actions cancel cleanly, remap lane preferences and undo/redo exactly.
 const actions=(await load('src/instrument-actions.ts')).namespace;
 const original=run('JSON.stringify(project)');
 sandbox.confirm=()=>false;actions.removeInstrument(0);assert.equal(run('JSON.stringify(project)'),original);
 sandbox.confirm=()=>true;
 prefs.instrumentView.muted.add(2);prefs.instrumentView.collapsed.add(2);
 await transport.play();assert.equal(doc.getElementById('play').title,'Pause');
 actions.mergeInstrument(0,2);assert.equal(run('project.instruments.length'),2);assert.equal(run('project.notes[0].instrument'),1);
 assert.equal(doc.getElementById('stop').disabled,true);assert.equal(frame,null);
 assert.equal(run('state.active'),1);assert.equal(prefs.isMuted(1),true);assert.equal(prefs.instrumentView.collapsed.has(1),true);
 const merged=run('JSON.stringify(project)');(await load('src/history.ts')).namespace.undo();assert.equal(run('JSON.stringify(project)'),original);
 (await load('src/history.ts')).namespace.undo(true);assert.equal(run('JSON.stringify(project)'),merged);
 actions.removeInstrument(1);assert.equal(run('project.notes.length'),0);assert.equal(run('state.active'),0);
 (await load('src/history.ts')).namespace.undo();assert.equal(run('JSON.stringify(project)'),merged);
 control(0,'Solo').onclick();doc.getElementById('new').onclick();assert.equal(prefs.instrumentView.solo,null);assert.equal(prefs.instrumentView.muted.size,0);
 // MS2 presets preview fixed kit sounds; split actions are undoable as one edit.
 for(const [key,pitch] of [['snare',38],['bass',35],['cymbals',49]]){
  const select=rows()[0].children[2];select.value=key;select.onchange();
  click(20,240);await new Promise(setImmediate);assert.deepEqual(previewCalls.at(-1),{pitch,program:0,isDrum:true});
 }
 run('project.instruments=[{name:"Kit",color:"#ff9900",isDrum:true},{name:"Bass Drum",color:"#ff9900",ms2Drum:"bass"}];project.notes=[{id:1,instrument:0,start:0,length:7,pitch:35,volume:10},{id:2,instrument:0,start:7,length:5,pitch:38,volume:null}];state.active=0');
 (await load('src/commands.ts')).namespace.refresh();
 const actionBody=index=>rows()[index].children.find(el=>el.className==='instrument-actions').children[1];
 assert.equal(actionBody(1).children.some(el=>el.textContent==='Split Drumkit'),false);
 const body=actionBody(0),label=body.children.find(el=>el.className==='instrument-split-label');label.children[0].value='B1';body.children[1].value='1';
 const splitBefore=run('JSON.stringify(project)');body.children.find(el=>el.textContent==='Split').onclick();assert.equal(run('project.notes[0].instrument'),1);
 (await load('src/history.ts')).namespace.undo();assert.equal(run('JSON.stringify(project)'),splitBefore);
 actionBody(0).children.find(el=>el.textContent==='Split Drumkit').onclick();assert.equal(run('project.instruments.length'),4);assert.equal(run('project.notes.filter(n=>n.instrument===0).length'),0);
 (await load('src/history.ts')).namespace.undo();assert.equal(run('JSON.stringify(project)'),splitBefore);

 // Custom sheet limits, selected-lane markers and all export decisions.
 run('project.instruments=[{name:"Sheet",color:"#abcdef"},{name:"Empty",color:"#abcdef"}];project.notes=Array.from({length:40},(_,i)=>({id:i,instrument:0,start:i*8,length:8,pitch:60+i%3,volume:9}));state.active=0;state.zoom=1');
 const limitInput=doc.getElementById('character-limit');limitInput.value='60';limitInput.onchange();
 const paint=(await load('src/painting.ts')).namespace;
 const red=()=>fills.filter(f=>f.color==='#e53935'&&f.h>30).at(-1);
 fills.length=0;paint.draw();assert.ok(red());const oldX=red().x;
 run('project.notes=project.notes.map(n=>({...n,start:n.start*2,length:n.length*2}))');fills.length=0;paint.draw();assert.notEqual(red().x,oldX);
 run('state.active=1');fills.length=0;paint.draw();assert.equal(red(),undefined);run('state.active=0');
 limitInput.value='0';limitInput.onchange();assert.equal(limitInput.value,'60');
 const dialog=doc.getElementById('export-limit-dialog');dialog.showModal=()=>{dialog.open=true};dialog.close=()=>{dialog.open=false;dialog.onclose?.()};
 const exportDialog=doc.getElementById('export-dialog');exportDialog.showModal=()=>{exportDialog.open=true};exportDialog.close=()=>{exportDialog.open=false};
 const saves=[];let bundles=0,archives=0;
 // One file goes through the save dialog; several are handed over as a folder, or as an
 // archive when that box is ticked. All three routes are recorded the same way here.
 const collect=files=>{for(const file of files)saves.push({name:file.name,text:file.text});};
 sandbox.window.files={exportMml:async(name,text)=>{saves.push({name,text});return true},
  exportFolder:async(name,files)=>{bundles++;collect(files);return 'C:/exports/'+name},
  exportZip:async(name,files)=>{archives++;collect(files);return 'C:/exports/'+name+'.zip'}};
 doc.getElementById('scope-selected').checked=true;
 const exportButton=doc.getElementById('export-run'),unchanged=run('JSON.stringify(project)');
 let pending=exportButton.onclick();assert.equal(dialog.open,true);assert.match(doc.getElementById('export-limit-message').textContent,/60 character limit.*Do you still wish to export/);doc.getElementById('export-limit-no').onclick();await pending;assert.equal(saves.length,0);
 pending=exportButton.onclick();doc.getElementById('export-limit-single').onclick();await pending;assert.equal(saves.length,1);assert.equal(saves[0].name,'Sheet.ms2mml');saves.length=0;
 bundles=0;pending=exportButton.onclick();doc.getElementById('export-limit-parts').onclick();await pending;assert.ok(saves.length>1);assert.equal(saves[0].name,'Sheet-part-01.ms2mml');
 assert.equal(bundles,1,'the parts are delivered once, as a folder, not one dialog each');
 // Ticking the archive box sends the same set through the zip route instead.
 doc.getElementById('export-zip').checked=true;saves.length=0;archives=0;
 pending=exportButton.onclick();doc.getElementById('export-limit-parts').onclick();await pending;
 assert.equal(archives,1,'an archive is written once');assert.ok(saves.length>1);
 assert.match(doc.getElementById('status').textContent,/Exported \d+ files to C:\/exports\/Sheet\.zip/);
 doc.getElementById('export-zip').checked=false;
 for(const saved of saves){const texts=[...saved.text.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)].map(m=>m[1]);assert.ok(texts.join('').length<=60);}
 assert.equal(run('JSON.stringify(project)'),unchanged);
 saves.length=0;pending=exportButton.onclick();dialog.oncancel({preventDefault(){}});await pending;assert.equal(saves.length,0);
 limitInput.value='10000';limitInput.onchange();await exportButton.onclick();assert.equal(saves.length,1);

 // Yellow crowding boxes follow the selected instrument and edits.
 run('project.notes=Array.from({length:10},(_,i)=>({id:i,instrument:0,start:0,length:100,pitch:60+i,volume:8}));project.notes.push({id:11,instrument:0,start:20,length:10,pitch:75,volume:8});state.active=0;state.zoom=1');
 doc.getElementById('view').scrollLeft=0;fills.length=0;paint.draw();
 const yellow=()=>fills.filter(f=>f.color==='#f0b90016');assert.equal(yellow().length,1);assert.equal(yellow()[0].x,82);assert.equal(yellow()[0].w,10);
 (await load('src/commands.ts')).namespace.commitNotes(run('project.notes.map(n=>n.id===11?{...n,length:20}:n)'));fills.length=0;paint.draw();assert.equal(yellow()[0].w,20);
 run('state.active=1');fills.length=0;paint.draw();assert.equal(yellow().length,0);
 run('state.active=0;project.notes.pop()');fills.length=0;paint.draw();assert.equal(yellow().length,0);

 // Project names, visual marker editing/navigation/reset and section exports.
 const projectName=doc.getElementById('project-name');projectName.value='Named Project';projectName.onchange();assert.equal(run('project.name'),'Named Project');
 (await load('src/history.ts')).namespace.undo();assert.equal(doc.getElementById('project-name').value,'Untitled');
 projectName.value='Named Project';projectName.onchange();let savedProject;
 sandbox.window.files.save=async text=>{savedProject=JSON.parse(text);return true};await doc.getElementById('save').onclick();assert.equal(savedProject.name,'Named Project');assert.equal(run('state.dirty'),false);
 run('project.instruments=[{name:"Piano",color:"#abcdef"},{name:"Flute",color:"#abcdef"},{name:"Instructions",color:"#f4d35e",isInstructions:true}];project.notes=[{id:1,instrument:0,start:0,length:64,pitch:60,volume:8},{id:2,instrument:1,start:128,length:64,pitch:67,volume:9},{id:3,instrument:2,start:128,length:1,pitch:60,volume:0}];selection=new Set([3]);state.active=2');
 (await load('src/commands.ts')).namespace.refresh();
 const signature=doc.getElementById('time-signature'),section=doc.getElementById('section-name'),reset=doc.getElementById('section-reset');
 signature.value='3/4';signature.onchange();assert.equal(run('project.notes[2].timeSignature'),'3/4');
 // A refused value stays on screen and marked, so it can be corrected rather than guessed at.
 signature.value='0/4';signature.onchange();
 assert.equal(run('project.notes[2].timeSignature'),'3/4');assert.equal(signature.value,'0/4');assert.equal(signature.classList.contains('invalid'),true);
 signature.value='33/4';signature.onchange();assert.equal(run('project.notes[2].timeSignature'),'3/4');
 signature.value='32/4';signature.onchange();assert.equal(run('project.notes[2].timeSignature'),'32/4');assert.equal(signature.classList.contains('invalid'),false);
 signature.value='3/4';signature.onchange();assert.equal(run('project.notes[2].timeSignature'),'3/4');
 section.value='Next song';section.onchange();reset.checked=true;reset.onchange();assert.equal(run('project.notes[2].resetMeasures'),true);
 assert.equal(doc.getElementById('section-control').hidden,false);const nav=doc.getElementById('section-nav');nav.value='128';nav.onchange();assert.equal(doc.getElementById('view').scrollLeft,128);
 const structure=(await load('src/music/structure.ts')).namespace;assert.equal(structure.measureLines(run('project'),128,129)[0].bar,1);
 (await load('src/history.ts')).namespace.undo();assert.equal(run('project.notes[2].resetMeasures'),undefined);assert.equal(reset.checked,false);
 doc.getElementById('export-sections').checked=true;doc.getElementById('scope-selected').checked=false;saves.length=0;await doc.getElementById('export-run').onclick();
 assert.deepEqual(saves.map(s=>s.name),['01-Opening-Piano.ms2mml','02-Next song-Flute.ms2mml']);assert.equal(dialog.open,false);
 doc.getElementById('new').onclick();assert.equal(projectName.value,'Untitled');assert.equal(doc.getElementById('section-control').hidden,true);

 // Caption signature defaults, editing, validation, inheritance and undo.
 view.scrollLeft=0;paint.draw();const currentSignature=doc.getElementById('current-signature');
 assert.equal(currentSignature.value,'4/4');currentSignature.onfocus();currentSignature.value='6/8';currentSignature.onchange();
 assert.equal(run('project.notes[0].timeSignature'),'6/8');assert.equal(run('project.instruments[project.notes[0].instrument].isInstructions'),true);
 // The refusal is visible at the field; blurring puts the stored value back.
 currentSignature.value='3/3';currentSignature.onchange();
 assert.equal(run('project.notes[0].timeSignature'),'6/8');assert.equal(currentSignature.classList.contains('invalid'),true);
 currentSignature.value='40/4';currentSignature.onchange();assert.equal(run('project.notes[0].timeSignature'),'6/8');
 currentSignature.onblur();assert.equal(currentSignature.value,'6/8');assert.equal(currentSignature.classList.contains('invalid'),false);
 (await load('src/history.ts')).namespace.undo();assert.equal(currentSignature.value,'4/4');

 run('project.instruments=[{name:"Piano",color:"#abcdef"},{name:"Instructions",color:"#f4d35e",isInstructions:true}];project.notes=[{id:1,instrument:0,start:0,length:512,pitch:60,volume:8},{id:2,instrument:1,start:64,length:1,pitch:60,volume:0,tempo:60},{id:3,instrument:1,start:128,length:1,pitch:60,volume:0,timeSignature:"3/4",section:"Verse"}];state.active=0;selection.clear()');
 (await load('src/commands.ts')).namespace.refresh();nav.value='128';nav.onchange();
 assert.equal(transport.playback.tick,128);assert.equal(currentSignature.value,'3/4');
 await transport.play();assert.equal(seq.currentTime,3);assert.equal(transport.playback.tick,128);
 assert.equal(restoredNotes.at(-1)[0].pitch,60);assert.equal(doc.getElementById('play').title,'Pause');
 transport.stopPlayback(false);await transport.play();assert.equal(seq.currentTime,3); // selected section survives Stop
 nav.value='128';nav.onchange();assert.equal(seq.currentTime,3);
 const changeVoice=value=>{const preset=rows()[0].children[2];preset.value=value;preset.onchange();};
 const settle=()=>new Promise(setImmediate);
 const smfModule=await load('src/import/smf.ts');await smfModule.link(()=>{});await smfModule.evaluate();const readMidi=smfModule.namespace.readSMF;
 const latestEvents=()=>readMidi(new Uint8Array(songLoads.at(-1))).events;
 changeVoice('40');await settle();assert.equal(seq.currentTime,3);assert.equal(doc.getElementById('play').title,'Pause');
 assert.ok(latestEvents().some(e=>e.status===192&&e.data[0]===40));assert.equal(restoredNotes.at(-1)[0].pitch,60);
 // Paused updates stay paused, retain exact position, and remap fixed drums.
 doc.getElementById('play').onclick();changeVoice('snare');await settle();
 assert.equal(frame,null);assert.equal(doc.getElementById('play').title,'Resume');assert.equal(transport.playback.tick,128);
 assert.ok(latestEvents().some(e=>e.status===153&&e.data[0]===38));
 await transport.play();assert.equal(seq.currentTime,3);assert.equal(restoredNotes.at(-1)[0].pitch,38);
 transport.seekToTick(32);assert.equal(seq.currentTime,.5); // earlier music survives voice refresh
 assert.equal(restoredNotes.at(-1)[0].pitch,38);assert.equal(currentSignature.value,'4/4');
 // Coalesce edits made while the previous SoundFont sequence is still loading.
 let release;loadGate=new Promise(resolve=>{release=resolve});changeVoice('73');await settle();changeVoice('24');release();loadGate=null;await settle();
 assert.ok(latestEvents().some(e=>e.status===192&&e.data[0]===24));assert.equal(seq.currentTime,.5);
 (await load('src/history.ts')).namespace.undo();await settle();assert.ok(latestEvents().some(e=>e.status===192&&e.data[0]===73));
 const beforeInvalidPreset=run('JSON.stringify(project)');changeVoice('instructions');await settle();assert.equal(run('JSON.stringify(project)'),beforeInvalidPreset,'Instructions cannot replace a musical preset');
 changeVoice('0');await settle();assert.equal(restoredNotes.at(-1)[0].pitch,60);
 loadGate=new Promise(resolve=>{release=resolve});changeVoice('40');await settle();transport.stopPlayback(false);release();loadGate=null;await settle();
 assert.equal(frame,null);assert.equal(transport.playback.tick,null);assert.equal(doc.getElementById('play').title,'Play');
 // Instruction captions float below the measure bar and stack at close onsets.
 view.scrollLeft=0;texts.length=0;run('project.notes.push({id:4,instrument:1,start:130,length:1,pitch:60,volume:0,tempo:90,section:"Close section"})');
 (await load('src/rendering/ruler.ts')).namespace.drawRuler();
 assert.ok(texts.every(t=>/^\d+$/.test(t.text)));
 texts.length=0;(await load('src/rendering/tempo.ts')).namespace.drawTempoMarkers();
 assert.ok(texts.some(t=>t.text.includes('Verse')&&t.text.includes('3/4')));
 assert.ok(texts.every(t=>t.y>HEAD));
 const verse=texts.find(t=>t.text.includes('Verse')),close=texts.find(t=>t.text.includes('Close section'));assert.ok(close.y>verse.y);
 // Playback multipliers and master volume leave all project data untouched.
 const speed=doc.getElementById('playback-speed'),masterVolume=doc.getElementById('playback-volume'),effective=doc.getElementById('effective-bpm');
 const projectBeforeSettings=run('JSON.stringify(project)');
 assert.equal(speed.value,'100');assert.equal(masterVolume.value,'100');assert.equal(effective.hidden,true);
 speed.onpointerdown();speed.value='198';speed.oninput();assert.equal(speed.value,'200');assert.equal(seq.playbackRate,2);assert.equal(effective.textContent,' · 240 effective');
 speed.value='52';speed.oninput();assert.equal(speed.value,'50');speed.onpointerup();
 speed.onkeydown();speed.value='51';speed.oninput();assert.equal(speed.value,'51'); // keyboard can leave snap positions
 speed.value='1';speed.oninput();assert.equal(speed.value,'25');assert.equal(effective.textContent,' · 30 effective (out of bounds!)');
 speed.value='500';speed.oninput();assert.equal(speed.value,'400');assert.equal(effective.textContent,' · 480 effective (out of bounds!)');
 masterVolume.value='0';masterVolume.oninput();assert.equal(masterVolumes.at(-1),0);
 masterVolume.value='35';masterVolume.oninput();assert.equal(masterVolumes.at(-1),.35);
 assert.equal(run('JSON.stringify(project)'),projectBeforeSettings);
 await transport.play();assert.equal(seq.playbackRate,4);assert.equal(doc.getElementById('playback-bpm').textContent,'60 BPM');assert.equal(effective.textContent,' · 240 effective');
 transport.seekToTick(130);assert.equal(doc.getElementById('playback-bpm').textContent,'90 BPM');assert.equal(effective.textContent,' · 360 effective (out of bounds!)');
 speed.value='100';speed.oninput();assert.equal(seq.playbackRate,1);assert.equal(effective.hidden,true);transport.stopPlayback(false);

 // Song/Segment views use a local model and save edits into the complete album.
 const plain=s=>JSON.parse(JSON.stringify(run(s)));
 prefs.resetInstrumentView();
 run('project.name="Album";project.grid=4;project.instruments=[{name:"Piano",color:"#abcdef"},{name:"Instructions",color:"#f4d35e",isInstructions:true}];project.notes=[{id:1,instrument:0,start:0,length:16,pitch:60,volume:5,tempo:90},{id:2,instrument:0,start:70,length:150,pitch:60,volume:null},{id:3,instrument:0,start:110,length:12,pitch:64,volume:null},{id:4,instrument:0,start:230,length:100,pitch:67,volume:null},{id:5,instrument:1,start:0,length:1,pitch:60,volume:0,section:"First song",resetMeasures:true,timeSignature:"6/8"},{id:6,instrument:1,start:96,length:1,pitch:60,volume:0,section:"Solo"},{id:7,instrument:1,start:160,length:1,pitch:60,volume:0,section:"Chorus",tempo:150},{id:8,instrument:1,start:256,length:1,pitch:60,volume:0,section:"Second song",resetMeasures:true}];state.active=0;state.history=[];state.future=[];state.dirty=false;selection.clear();state.zoom=3');
 const commands=(await load('src/commands.ts')).namespace;commands.refresh();transport.seekToTick(120);
 const originalAlbum=run('JSON.stringify(project)'),openSong=doc.getElementById('open-song'),openSegment=doc.getElementById('open-segment'),returnProject=doc.getElementById('return-project');
 assert.equal(openSong.hidden,false);assert.equal(openSegment.hidden,false);openSong.onclick();
 assert.equal(run('state.segment.projection.range.end'),256);assert.equal(doc.getElementById('section-control').hidden,false);assert.equal(openSong.hidden,true);
 assert.equal(doc.getElementById('segment-view-label').textContent,'Song: First song');assert.equal(projectName.value,'Album');
 transport.seekToTick(120);openSegment.onclick();
 assert.equal(run('state.segment.projection.range.start'),96);assert.equal(run('state.segment.projection.range.end'),160);assert.equal(transport.playback.tick,0);
 assert.equal(doc.getElementById('section-control').hidden,true);assert.equal(doc.getElementById('export-sections').disabled,true);
 assert.deepEqual(plain('project.notes.filter(n=>n.instrument===0).map(n=>[n.start,n.length])'),[[0,64],[14,12]]);
 assert.equal(currentSignature.value,'6/8');assert.equal(doc.getElementById('playback-bpm').textContent,'90 BPM');
 const generate=(await load('src/music/mml.ts')).namespace.generateMml;const viewMml=generate(run('project'),0);
 assert.match(mmlBox().children[0].textContent,new RegExp('count: '+viewMml.bytes+' bytes'));
 limitInput.value=String(viewMml.bytes);limitInput.onchange();fills.length=0;paint.draw();assert.ok(fills.some(f=>f.color==='#e53935'&&f.x===KEY+64*3));
 limitInput.value='10000';limitInput.onchange();saves.length=0;await doc.getElementById('export-run').onclick();
 assert.deepEqual(saves.map(s=>s.name),['Solo-Piano.ms2mml']);assert.deepEqual([...saves[0].text.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)].map(m=>m[1]),[...viewMml.channels]);
 await doc.getElementById('save').onclick();assert.deepEqual(savedProject,JSON.parse(originalAlbum)); // simply viewing cannot cut the album
 await transport.play();assert.equal(seq.currentTime,0);assert.equal(readMidi(new Uint8Array(songLoads.at(-1))).end,64);transport.stopPlayback(false);
 run('selection=new Set([2])');(await load('src/inspector.ts')).namespace.info();const lengthField=doc.getElementById('length');lengthField.value='100';lengthField.onchange();assert.equal(run('project.notes.find(n=>n.id===2).length'),64);
 const pitchField=doc.getElementById('pitch');pitchField.value='72';pitchField.onchange();
 assert.deepEqual(plain('state.segment.root.notes.filter(n=>n.instrument===0&&n.pitch===72).map(n=>[n.start,n.length])'),[[96,64]]);
 assert.deepEqual(plain('state.segment.root.notes.filter(n=>n.instrument===0&&n.pitch===60&&n.start>0).map(n=>[n.start,n.length])'),[[70,26],[160,60]]);
 assert.equal(run('selection.size'),1);assert.equal(run('project.notes.find(n=>selection.has(n.id)).pitch'),72);
 (await load('src/history.ts')).namespace.undo();assert.equal(run('state.segment.root.notes.find(n=>n.id===2).length'),150);
 (await load('src/history.ts')).namespace.undo(true);assert.equal(run('project.notes.find(n=>n.pitch===72).length'),64);
 returnProject.onclick();assert.equal(run('state.segment'),null);assert.equal(doc.getElementById('segment-view-label').hidden,true);assert.ok(run('project.notes.some(n=>n.start===96&&n.pitch===72)'));
 (await load('src/history.ts')).namespace.undo();assert.equal(run('JSON.stringify(project)'),originalAlbum); // undo also works after leaving
 transport.seekToTick(120);openSegment.onclick();
 const pitchLayout=(await load('src/music/pitch-layout.ts')).namespace;
 view.scrollTop=pitchLayout.pitchTop(run('state.topPitch'),78);click(KEY+40*3,HEAD+pitchLayout.pitchTop(78,70)+pitchLayout.pitchHeight(70)/2);
 assert.ok(run('state.segment.root.notes.some(n=>n.start===128&&n.pitch===70)'));
 (await load('src/history.ts')).namespace.undo();assert.equal(run('state.segment.root.notes.some(n=>n.pitch===70)'),false);
 run('selection=new Set([6])');doc.onkeydown({key:'Delete',target:new El(),preventDefault(){}});
 assert.equal(run('state.segment.root.notes.some(n=>n.id===6)'),false);assert.equal(doc.getElementById('playback-bpm').textContent,'90 BPM');assert.equal(currentSignature.value,'6/8');
 (await load('src/history.ts')).namespace.undo();assert.equal(run('state.segment.root.notes.some(n=>n.id===6)'),true);
 run('selection=new Set([2])');doc.onkeydown({key:'Delete',target:new El(),preventDefault(){}});
 assert.deepEqual(plain('state.segment.root.notes.filter(n=>n.instrument===0&&n.pitch===60&&n.start>0).map(n=>[n.start,n.length])'),[[70,26],[160,60]]);
 returnProject.onclick();transport.seekToTick(280);openSong.onclick();assert.equal(doc.getElementById('section-control').hidden,true);
 (await load('src/instrument-actions.ts')).namespace.removeInstrument(0);assert.equal(run('project.notes.some(n=>n.instrument===0)'),false);assert.ok(run('state.segment.root.notes.some(n=>n.instrument===0&&n.start===0)'));
 doc.getElementById('new').onclick();assert.equal(run('state.segment'),null);assert.equal(projectName.value,'Untitled');assert.equal(returnProject.hidden,true);

 run('project.notes=[{id:1,instrument:0,start:1,length:4,pitch:60,volume:11},{id:2,instrument:0,start:5,length:3,pitch:64,volume:11}]');commands.refresh();
 const beforeSimplify=run('JSON.stringify(project.notes)');
 doc.getElementById('simplify-length').value='64';doc.getElementById('simplify-timing').onclick();
 assert.deepEqual(plain('project.notes.map(n=>[n.start,n.length,n.volume])'),[[0,5,11],[5,3,11]]);
 assert.match(doc.getElementById('status').textContent,/1 notes changed/);
 assert.match(mmlBox().children[0].textContent,new RegExp('count: '+generate(run('project'),0).bytes+' bytes'));
 (await load('src/history.ts')).namespace.undo();assert.equal(run('JSON.stringify(project.notes)'),beforeSimplify);
 run('project.notes=[{id:1,instrument:0,start:0,length:2,pitch:60,volume:11},{id:2,instrument:0,start:2,length:2,pitch:62,volume:11},{id:3,instrument:0,start:4,length:2,pitch:64,volume:11},{id:4,instrument:0,start:16,length:1,pitch:65,volume:11},{id:5,instrument:0,start:17,length:15,pitch:67,volume:11}]');commands.refresh();
 const beforeOrnaments=run('JSON.stringify(project.notes)');
 doc.getElementById('simplify-length').value='16';doc.getElementById('simplify-timing').onclick();
 assert.deepEqual(plain('project.notes.map(n=>[n.id,n.start,n.length,n.pitch])'),[[1,0,8,60],[5,16,16,67]]);
 (await load('src/history.ts')).namespace.undo();assert.equal(run('JSON.stringify(project.notes)'),beforeOrnaments);
 run('project.notes=[{id:1,instrument:0,start:0,length:4,pitch:60,volume:11},{id:2,instrument:0,start:4,length:6,pitch:62,volume:8}]');commands.refresh();
 const beforeCompetition=run('JSON.stringify(project.notes)');
 doc.getElementById('simplify-length').value='8';doc.getElementById('simplify-timing').onclick();
 assert.deepEqual(plain('project.notes.map(n=>[n.id,n.start,n.length])'),[[1,0,8],[2,8,8]]);
 (await load('src/history.ts')).namespace.undo();assert.equal(run('JSON.stringify(project.notes)'),beforeCompetition);
 run('project.notes=[{id:1,instrument:0,start:0,length:20,pitch:60,volume:11},{id:2,instrument:0,start:7,length:16,pitch:60,volume:8}]');commands.refresh();
 const beforeOverlap=run('JSON.stringify(project.notes)');
 doc.getElementById('remove-overlap').onclick();
 assert.deepEqual(plain('project.notes.map(n=>[n.start,n.length,n.volume])'),[[0,7,11],[7,16,8]]);
 assert.match(doc.getElementById('status').textContent,/1 notes shortened/);
 assert.match(mmlBox().children[0].textContent,new RegExp('count: '+generate(run('project'),0).bytes+' bytes'));
 const overlapHistory=run('state.history.length');doc.getElementById('remove-overlap').onclick();assert.equal(run('state.history.length'),overlapHistory);
 (await load('src/history.ts')).namespace.undo();assert.equal(run('JSON.stringify(project.notes)'),beforeOverlap);

 run('project.notes=[{id:1,instrument:0,start:0,length:512,pitch:60,volume:11}]');commands.refresh();transport.seekToTick(170);
 currentSignature.onfocus();currentSignature.value='6/8';currentSignature.onchange();
 assert.deepEqual(plain('project.notes.filter(n=>n.timeSignature).map(n=>[n.start,n.timeSignature])'),[[0,'6/8']]);
 const initialMeter=run('JSON.stringify(project.notes)');
 transport.seekToTick(170);currentSignature.onfocus();transport.seekToTick(300);
 currentSignature.value='3/4';currentSignature.onchange();
 assert.deepEqual(plain('project.notes.filter(n=>n.timeSignature).map(n=>[n.start,n.timeSignature])'),[[0,'6/8'],[96,'3/4']]);
 (await load('src/history.ts')).namespace.undo();assert.equal(run('JSON.stringify(project.notes)'),initialMeter);
 transport.seekToTick(20);currentSignature.onfocus();currentSignature.value='5/4';currentSignature.onchange();
 assert.deepEqual(plain('project.notes.filter(n=>n.timeSignature).map(n=>[n.start,n.timeSignature])'),[[0,'5/4']]);

 // Actual uneven-row hit testing, full-cell note height, and semitone dragging.
 run('project.notes=[];selection.clear();state.active=0;state.zoom=3;setTool("draw")');commands.refresh();
 view.scrollLeft=0;view.scrollTop=pitchLayout.pitchTop(run('state.topPitch'),72);
 for(let pitch=72;pitch>=60;pitch--){
  const y=HEAD+pitchLayout.pitchTop(72,pitch)+pitchLayout.pitchHeight(pitch)/2;
  click(KEY+15,y);
  const added=run('project.notes.at(-1)'),bounds=geometry.rect(added);
  assert.equal(added.pitch,pitch);assert.equal(bounds.h,pitchLayout.pitchHeight(pitch)-1);assert.equal(bounds.w,added.length*run("state.zoom")-1);
  assert.equal(bounds.y+bounds.h/2,y-.5);assert.equal(geometry.hit({x:bounds.x+5,y}).id,added.id);
 }
 const lowC=run('project.notes.find(n=>n.pitch===60)'),lowBounds=geometry.rect(lowC);
 run(`selection=new Set([${lowC.id}]);setTool("select")`);
 drag(lowBounds.x+8,lowBounds.y+7,lowBounds.x+104,HEAD+pitchLayout.pitchTop(72,61)+7.5);
 assert.equal(run(`project.notes.find(n=>n.id===${lowC.id}).pitch`),61);
 assert.equal(run(`project.notes.find(n=>n.id===${lowC.id}).start`),32);
 const titleBefore=run('project.name');projectName.value='Blue Moon';projectName.onchange();
 assert.equal(doc.title,'MML Music Studio - Blue Moon');
 (await load('src/history.ts')).namespace.undo();assert.equal(doc.title,'MML Music Studio - '+titleBefore);
 doc.getElementById('new').onclick();assert.equal(doc.title,'MML Music Studio - Untitled');

 // Drawing a note backwards grows it to the left of the cell the drag started in.
 run('project.grid=4;project.notes=[];selection.clear();state.history=[];state.future=[];state.zoom=3');run('setTool("draw")');
 commands.refresh();doc.getElementById('view').scrollLeft=0;
 c.onpointerdown(event(350,240));const drawn=run('project.notes.at(-1)');
 c.onpointermove(event(254,240));c.onpointerup(event(254,240));
 const stretched=run('project.notes.at(-1)');
 assert.equal(stretched.start,drawn.start-32,'dragging left moves the new note back a cell');
 assert.equal(stretched.length,64,'and its end stays in the cell the drag started in');
 // Right button erases: a click removes one note, holding it removes everything it crosses.
 prefs.resetInstrumentView();
 run('project.notes=[{id:1,instrument:0,start:0,length:32,pitch:60,volume:8},{id:2,instrument:0,start:64,length:32,pitch:60,volume:8},{id:3,instrument:0,start:128,length:32,pitch:60,volume:8}];state.active=0;state.history=[];state.future=[];selection.clear();state.zoom=3');
 commands.refresh();
 const middle=id=>{const r=geometry.rect(run(`project.notes.find(n=>n.id===${id})`));return {x:r.x+r.w/2,y:r.y+r.h/2};};
 const rightButton=(x,y)=>({clientX:x,clientY:y,button:2,pointerId:9,preventDefault(){}});
 const firstNote=middle(1),thirdNote=middle(3);
 c.onpointerdown(rightButton(firstNote.x,firstNote.y));
 assert.equal(run('project.notes.length'),2,'a right click removes the note under the pointer');
 c.onpointermove(rightButton(thirdNote.x,thirdNote.y));c.onpointerup(rightButton(thirdNote.x,thirdNote.y));
 assert.equal(run('project.notes.length'),0,'holding the right button erases every note the pointer crosses');
 assert.equal(run('state.history.length'),1,'the whole erase drag is a single undo step');

 // Full-height Instructions, nested shading and live-loop controls.
 run('project.instruments=[{name:"Piano",color:"#4488aa"},{name:"Instructions",color:"#d0a020",isInstructions:true}];project.notes=[{id:1,instrument:0,start:0,length:128,pitch:60,volume:8},{id:2,instrument:1,start:0,length:1,pitch:-200,volume:0,loopEntry:true,loopCount:2},{id:3,instrument:1,start:32,length:1,pitch:300,volume:0,loopEntry:true,loopCount:2},{id:4,instrument:1,start:64,length:1,pitch:300,volume:0,loopExit:true},{id:5,instrument:1,start:96,length:1,pitch:300,volume:0,loopExit:true}];state.active=1;selection=new Set([2]);state.zoom=3');
 view.scrollLeft=0;commands.refresh();
 for(const key of ['pitch','length','volume'])assert.equal(doc.getElementById(key+'-field').hidden,true);
 assert.equal(doc.getElementById('loop-count-field').hidden,false);assert.equal(doc.getElementById('loop-tie-field').hidden,true);
 const countInput=doc.getElementById('loop-count');countInput.value='3';countInput.onchange();assert.equal(run('project.notes.find(n=>n.id===2).loopCount'),3);
 countInput.value='0';countInput.onchange();assert.equal(run('project.notes.find(n=>n.id===2).loopCount'),3);
 (await load('src/history.ts')).namespace.undo();assert.equal(run('project.notes.find(n=>n.id===2).loopCount'),2);
 const markerRect=geometry.rect(run('project.notes.find(n=>n.id===3)'));assert.equal(markerRect.w,15);assert.equal(markerRect.y,HEAD);assert.equal(markerRect.h,600-HEAD);
 fills.length=0;paint.draw();const regions=fills.filter(f=>f.color==='#d0a020'&&f.alpha===.1);assert.deepEqual(regions.map(r=>r.w),[288,96]);
 const lineIndex=fills.findIndex(f=>f.color==='#d0a020'&&f.w===15);const noteIndex=fills.findIndex(f=>f.color==='#4488aa');assert.ok(lineIndex>=0&&noteIndex>lineIndex);
 run('state.active=0;selection.clear()');click(KEY+32*3+5,550);assert.equal(run('state.active'),1);assert.equal(run('[...selection][0]'),3);
 run('state.active=0;selection.clear()');paint.draw();const instructionRendering=(await load('src/rendering/tempo.ts')).namespace;
 const captionPoint={x:KEY+96*3+35,y:HEAD+14};assert.equal(instructionRendering.instructionCaptionHit(captionPoint).id,5);click(captionPoint.x,captionPoint.y);assert.equal(run('[...selection][0]'),5);
 assert.equal(doc.getElementById('loop-count-field').hidden,true);assert.equal(doc.getElementById('loop-tie-field').hidden,false);
 doc.getElementById('loop-tie').checked=true;doc.getElementById('loop-tie').onchange();assert.equal(run('project.notes.find(n=>n.id===5).loopTie'),true);
 run('state.active=0;selection=new Set([1])');commands.refresh();assert.equal(doc.getElementById('pitch-field').hidden,false);
 // A paused live MML result stays frozen when a loop count changes.
 const loopMml=mmlBox();loopMml.children[1].children[0].checked=false;loopMml.children[1].children[0].onchange();const loopFrozen=loopMml.children[0].textContent;
 commands.commitNotes(run('project.notes.map(n=>n.id===2?{...n,loopCount:3}:n)'));assert.equal(mmlBox().children[0].textContent.replace(' · Out of date',''),loopFrozen);
 mmlBox().children[1].children[0].checked=true;mmlBox().children[1].children[0].onchange();assert.notEqual(mmlBox().children[0].textContent,loopFrozen);
 // Playback moves through expanded time while the visible playhead jumps back.
 doc.getElementById('section-nav').value='';transport.seekToTick(0);await transport.play();seq.currentHighResolutionTime=1.1;frame();assert.ok(transport.playback.tick>=38&&transport.playback.tick<39);
 doc.getElementById('play').onclick();const pausedTick=transport.playback.tick;await transport.play();assert.equal(transport.playback.tick,pausedTick);transport.stopPlayback(false);
 commands.commitNotes(run('project.notes.filter(n=>n.id!==5)'));run('state.active=1;selection=new Set([2])');commands.refresh();assert.match(doc.getElementById('loop-warning').textContent,/no Exit/);

 // Each explicit chord V survives inspector edits, copy/paste and Undo.
 prefs.resetInstrumentView();
 run('project.instruments=[{name:"Piano",color:"#abcdef"}];project.notes=[{id:1,instrument:0,start:0,length:32,pitch:60,volume:13},{id:2,instrument:0,start:0,length:32,pitch:64,volume:5},{id:3,instrument:0,start:32,length:32,pitch:67,volume:null}];state.active=0;selection=new Set([1]);state.history=[];state.future=[]');commands.refresh();
 assert.equal(doc.getElementById('volume').value,'13');assert.match(doc.getElementById('info').textContent,/effective V13/);
 doc.getElementById('volume').value='12';doc.getElementById('volume').onchange();assert.match(doc.getElementById('info').textContent,/effective V12/);
 (await load('src/history.ts')).namespace.undo();run('selection=new Set([1,2])');commands.refresh();
 clipboard.copyNotes();clipboard.pasteNotes();
 assert.deepEqual(plain('project.notes.slice(-2).map(n=>[n.start,n.pitch,n.volume])'),[[32,60,13],[32,64,5]]);
 run('selection=new Set([3])');commands.refresh();assert.match(doc.getElementById('info').textContent,/effective V5/);
 (await load('src/history.ts')).namespace.undo();assert.equal(run('project.notes.length'),3);


 // Every derived channel follows its owning Instrument's mute/solo and seek state.
 transport.stopPlayback(false);prefs.resetInstrumentView();
 run('project.instruments=[{name:"Piano",color:"#abcdef"},{name:"Other",color:"#abcdef"}];project.notes=[{id:1,instrument:0,start:0,length:128,pitch:60,volume:13},{id:2,instrument:0,start:16,length:16,pitch:60,volume:5},{id:3,instrument:1,start:0,length:128,pitch:64,volume:8}];state.active=0');commands.refresh();
 transport.seekToTick(24);await transport.play();
 assert.deepEqual(JSON.parse(JSON.stringify(restoredNotes.at(-1))),[{channel:0,pitch:60,velocity:110},{channel:2,pitch:64,velocity:68},{channel:1,pitch:60,velocity:42}]);
 prefs.instrumentView.muted.add(0);transport.updatePlaybackMutes();assert.deepEqual(muteCalls.slice(-3),[{channel:0,muted:true},{channel:1,muted:true},{channel:2,muted:false}]);
 prefs.instrumentView.muted.clear();prefs.instrumentView.solo=0;transport.updatePlaybackMutes();assert.deepEqual(muteCalls.slice(-3),[{channel:0,muted:false},{channel:1,muted:false},{channel:2,muted:true}]);
 transport.stopPlayback(false);prefs.resetInstrumentView();
 // Active-lane markers are visible before jumping and remain while scrolling.
 run('project.instruments=[{name:"Piano",color:"#abcdef"},{name:"Other",color:"#abcdef"}];project.notes=[{id:1,instrument:0,start:600,length:32,pitch:20,volume:8},{id:2,instrument:0,start:600,length:16,pitch:20,volume:8},{id:3,instrument:1,start:700,length:16,pitch:72,volume:8},{id:4,instrument:1,start:700,length:32,pitch:72,volume:8}];state.active=1;selection.clear();state.zoom=1');commands.refresh();
 prefs.instrumentView.muted.add(0);view.scrollLeft=500;fills.length=0;paint.draw();
 assert.ok(fills.some(f=>f.color==='#e5484d'&&f.x===KEY+700-500&&f.y===HEAD&&f.h===600-HEAD));
 assert.ok(!fills.some(f=>f.color==='#e5484d'&&f.x===KEY+600-500));
 const overlapBefore=run('JSON.stringify([project,state.history,state.dirty])');
 flag().onclick();assert.equal(run('state.active'),0);assert.deepEqual(plain('[...selection]'),[1,2]);
 assert.ok(view.scrollLeft>0);assert.ok(view.scrollTop>0);assert.equal(run('JSON.stringify([project,state.history,state.dirty])'),overlapBefore);
 prefs.resetInstrumentView();
});
