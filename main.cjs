const {app,BrowserWindow,ipcMain,dialog,clipboard}=require('electron');
const path=require('node:path'),fs=require('node:fs/promises');
const existingUserData=app.getPath('userData');
app.setName('MML Music Studio');
app.setPath('userData',existingUserData);
app.setAppUserModelId('com.mmlstudio.editor');
// All editor assets are local. Avoid Chromium disk-cache locks/permission errors
// on Windows without moving userData (which holds saved workspace preferences).
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
function safeFileStem(value){let name=(typeof value==='string'?value:'Untitled').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').trim()||'Untitled';if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))name='_'+name;return name;}
const {zipArchive}=require('./zip.cjs');
const {createPortableUpdater,launchPortableUpdate}=require('./updater.cjs');
// Windows opens a file dialog wherever its shell was last used, which on many machines is
// OneDrive. Passing an absolute defaultPath keeps that decision here: the folder the last
// file went to, and the system Downloads folder on a fresh profile.
let lastFolder=null;
const folderMemory=()=>path.join(app.getPath('userData'),'last-folder.json');
async function startFolder(){
 if(lastFolder)return lastFolder;
 try{const stored=JSON.parse(await fs.readFile(folderMemory(),'utf8')).folder;if(typeof stored==='string')lastFolder=stored;}catch{}
 if(!lastFolder)lastFolder=app.getPath('downloads');
 return lastFolder;
}
function rememberFolder(folder){lastFolder=folder;fs.writeFile(folderMemory(),JSON.stringify({folder})).catch(()=>{});}
const startPath=async name=>path.join(await startFolder(),safeFileStem(name));
const exists=async target=>{try{await fs.access(target);return true;}catch{return false;}};
// A set of files is described the same way whichever way it is delivered.
const validSet=files=>Array.isArray(files)&&files.length>0&&files.every(file=>file&&typeof file.name==='string'&&(typeof file.text==='string'||file.bytes instanceof Uint8Array));
let win,closeReady=false,closePending=false,closeAllowed=false,closeRequest=0,pendingUpdate=null,updateHandoff=null;
ipcMain.on('editor-close-ready',event=>{if(win&&event.sender===win.webContents)closeReady=true;});
ipcMain.on('editor-close-response',(event,id,allowed)=>{
 if(!win||win.isDestroyed()||event.sender!==win.webContents||!closePending||id!==closeRequest)return;
 closePending=false;if(allowed===true){closeAllowed=true;win.close();}else pendingUpdate=null;
});
ipcMain.handle('close-choice',async event=>{
 if(!win||win.isDestroyed()||event.sender!==win.webContents)return 'cancel';
 const result=await fileDialog('showMessageBox',{type:'question',title:'Unsaved changes',message:'Save changes before closing?',buttons:['Save','Discard','Cancel'],defaultId:0,cancelId:2,noLink:true});
 return ['save','discard','cancel'][result.response]??'cancel';
});
function restoreEditorFocus(){if(win&&!win.isDestroyed()){win.focus();win.webContents.focus();}}
async function fileDialog(kind,options){try{return await dialog[kind](win,options);}finally{restoreEditorFocus();}}
ipcMain.on('confirm-action',(event,message)=>{
 if(!win||win.isDestroyed()||event.sender!==win.webContents||typeof message!=='string'){event.returnValue=false;return;}
 let accepted=false;
 try{accepted=dialog.showMessageBoxSync(win,{type:'question',title:'MML Studio',message,buttons:['Continue','Cancel'],defaultId:1,cancelId:1,noLink:true})===0;}
 finally{restoreEditorFocus();event.returnValue=accepted;}
});
ipcMain.handle('app-version',event=>win&&!win.isDestroyed()&&event.sender===win.webContents?app.getVersion():null);
ipcMain.on('import-tempo-choice',(event,name)=>{
 if(!win||win.isDestroyed()||event.sender!==win.webContents){event.returnValue=false;return;}
 let keep=false;
 try{keep=dialog.showMessageBoxSync(win,{type:'question',title:'Import tempo instructions',message:`Import tempo instructions from ${typeof name==='string'?name:'this file'}?`,detail:'Imported tempos replace conflicting tempos at the same position. The last encountered tempo wins. Remove tempos to import the notes using the current project clock (120 BPM by default).',buttons:['Import tempos','Remove tempos'],defaultId:0,cancelId:1,noLink:true})===0;}
 finally{restoreEditorFocus();event.returnValue=keep;}
});
app.whenReady().then(()=>{
 win=new BrowserWindow({width:1320,height:850,minWidth:900,minHeight:560,icon:path.join(__dirname,'assets','logo.png'),backgroundColor:'#171d21',show:false,
  // Playback keeps its own time while the editor sits behind another window, so this
  // renderer's timers must not be throttled the way a background browser tab's are:
  // the rehearsal loop is brought round by a timer, not by the frames being painted.
  webPreferences:{backgroundThrottling:false,preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 win.on('close',event=>{
  if(closeAllowed||!closeReady)return;event.preventDefault();if(closePending)return;
  closePending=true;win.webContents.send('editor-close-request',++closeRequest);
 });
 // Stay hidden until the module script has run, so the empty skeleton is never shown.
 win.webContents.once('did-finish-load',()=>win.show());
 win.setMenuBarVisibility(false);win.setClosable(true);win.loadFile(path.join(__dirname,'index.html'));win.on('closed',()=>{if(mmlWindow&&!mmlWindow.isDestroyed())mmlWindow.close();mmlWindow=null;mmlData=null;const update=pendingUpdate;pendingUpdate=null;if(update)updateHandoff=launchPortableUpdate(update).catch(error=>dialog.showMessageBox({type:'error',title:'Update failed',message:'Could not start the update installer.',detail:String(error),buttons:['OK']}));});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',e=>e.preventDefault());
 createPortableUpdater({app,dialog,getWindow:()=>win,onReady:update=>{pendingUpdate=update;if(win&&!win.isDestroyed())win.close();}}).start();
});
ipcMain.handle('save',async(_,text)=>{if(typeof text!=='string')throw Error('Invalid project');const r=await fileDialog('showSaveDialog',{defaultPath:await startPath(JSON.parse(text).name+'.json'),filters:[{name:'Studio JSON',extensions:['json']}]});if(r.canceled)return false;await fs.writeFile(r.filePath,text);rememberFolder(path.dirname(r.filePath));return true;});
ipcMain.handle('open',async()=>{const r=await fileDialog('showOpenDialog',{defaultPath:await startFolder(),properties:['openFile'],filters:[{name:'Studio JSON',extensions:['json']}]});if(r.canceled)return null;rememberFolder(path.dirname(r.filePaths[0]));return fs.readFile(r.filePaths[0],'utf8');});
ipcMain.handle('import-midi',async()=>{
 const r=await fileDialog('showOpenDialog',{title:'Import MIDI or MML',defaultPath:await startFolder(),properties:['openFile'],filters:[{name:'MIDI and MML files',extensions:['mid','midi','mml','ms2mml','mne']},{name:'Text files',extensions:['txt','xml']},{name:'All files',extensions:['*']}]});
 if(r.canceled)return null;
 const file=r.filePaths[0],bytes=await fs.readFile(file);rememberFolder(path.dirname(file));
 return {name:path.basename(file),bytes:new Uint8Array(bytes)};
});
ipcMain.handle('export-mml',async(_,name,text)=>{if(typeof name!=='string'||typeof text!=='string')throw Error('Invalid MML export');const r=await fileDialog('showSaveDialog',{defaultPath:await startPath(name),filters:[{name:'MapleStory 2 MML',extensions:['ms2mml']}]});if(r.canceled)return false;await fs.writeFile(r.filePath,text,'utf8');rememberFolder(path.dirname(r.filePath));return true;});
// Plain MML text and MIDI are the same export decision with a different file on the end.
ipcMain.handle('export-text',async(_,name,text)=>{if(typeof name!=='string'||typeof text!=='string')throw Error('Invalid text export');const r=await fileDialog('showSaveDialog',{defaultPath:await startPath(name),filters:[{name:'MML text',extensions:['txt']},{name:'All files',extensions:['*']}]});if(r.canceled)return false;await fs.writeFile(r.filePath,text,'utf8');rememberFolder(path.dirname(r.filePath));return true;});
ipcMain.handle('export-midi',async(_,name,bytes)=>{if(typeof name!=='string'||!(bytes instanceof Uint8Array))throw Error('Invalid MIDI export');const r=await fileDialog('showSaveDialog',{defaultPath:await startPath(name),filters:[{name:'MIDI file',extensions:['mid']}]});if(r.canceled)return false;await fs.writeFile(r.filePath,Buffer.from(bytes));rememberFolder(path.dirname(r.filePath));return true;});
// A whole project, or a sheet split into parts, is many files at once. Asking for a filename
// each time meant one save dialog per file; the destination is chosen once instead, either as
// a folder of loose files ready to be loaded, or as one archive to hand to somebody.
ipcMain.handle('export-folder',async(_,folderName,files)=>{
 if(typeof folderName!=='string'||!validSet(files))throw Error('Invalid export');
 const r=await fileDialog('showOpenDialog',{title:'Choose where to save the export',defaultPath:await startFolder(),buttonLabel:'Export here',properties:['openDirectory','createDirectory']});
 if(r.canceled)return null;
 const parent=r.filePaths[0];rememberFolder(parent);
 const stem=safeFileStem(folderName);let folder=path.join(parent,stem);
 // An earlier export of the same name is never written over; this one becomes 'Name (2)'.
 for(let n=2;await exists(folder);n++)folder=path.join(parent,stem+' ('+n+')');
 await fs.mkdir(folder,{recursive:true});
 for(const file of files)await fs.writeFile(path.join(folder,safeFileStem(file.name)),file.bytes?Buffer.from(file.bytes):file.text,file.bytes?undefined:'utf8');
 return folder;
});
ipcMain.handle('export-zip',async(_,archiveName,files)=>{
 if(typeof archiveName!=='string'||!validSet(files))throw Error('Invalid export');
 const r=await fileDialog('showSaveDialog',{title:'Save the export as an archive',defaultPath:await startPath(archiveName+'.zip'),filters:[{name:'Zip archive',extensions:['zip']}]});
 if(r.canceled)return null;
 await fs.writeFile(r.filePath,zipArchive(files.map(file=>({name:safeFileStem(file.name),text:file.text,bytes:file.bytes}))));
 rememberFolder(path.dirname(r.filePath));
 return r.filePath;
});
require('./audio-export.cjs')({ipcMain,getWindow:()=>win,fileDialog,safeFileStem});
app.on('window-all-closed',async()=>{if(updateHandoff)await updateHandoff;app.quit();});
ipcMain.handle('sound-bank',async()=>new Uint8Array(await fs.readFile(path.join(__dirname,'assets','TimGM6mb.sf2'))));

let mmlWindow,mmlData;
function validMml(data){return data&&typeof data.name==='string'&&Array.isArray(data.channels)&&data.channels.every(s=>typeof s==='string')&&Array.isArray(data.warnings)&&data.warnings.every(s=>typeof s==='string');}
ipcMain.handle('mml-open',(event,data)=>{
 if(event.sender!==win.webContents||!validMml(data))throw Error('Invalid MML request');mmlData=data;
 if(mmlWindow&&!mmlWindow.isDestroyed()){mmlWindow.webContents.send('mml-data',data);mmlWindow.show();mmlWindow.focus();return;}
 mmlWindow=new BrowserWindow({parent:win,width:820,height:600,minWidth:450,minHeight:350,icon:path.join(__dirname,'assets','logo.png'),backgroundColor:'#23262a',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 mmlWindow.setMenuBarVisibility(false);mmlWindow.setClosable(true);mmlWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));mmlWindow.webContents.on('will-navigate',e=>e.preventDefault());mmlWindow.on('closed',()=>{mmlWindow=null;mmlData=null;});mmlWindow.loadFile(path.join(__dirname,'mml.html'));
});
ipcMain.handle('mml-update',(event,data)=>{if(event.sender!==win.webContents||!validMml(data))return;mmlData=data;if(mmlWindow&&!mmlWindow.isDestroyed())mmlWindow.webContents.send('mml-data',data);});
ipcMain.on('mml-ready',event=>{if(mmlWindow&&event.sender===mmlWindow.webContents&&mmlData)event.sender.send('mml-data',mmlData);});
ipcMain.handle('mml-copy',(event,text)=>{if(!mmlWindow||event.sender!==mmlWindow.webContents||typeof text!=='string')throw Error('Invalid clipboard request');clipboard.writeText(text);});
