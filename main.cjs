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
let win;
function restoreEditorFocus(){if(win&&!win.isDestroyed()){win.focus();win.webContents.focus();}}
async function fileDialog(kind,options){try{return await dialog[kind](win,options);}finally{restoreEditorFocus();}}
ipcMain.on('confirm-action',(event,message)=>{
 if(!win||win.isDestroyed()||event.sender!==win.webContents||typeof message!=='string'){event.returnValue=false;return;}
 let accepted=false;
 try{accepted=dialog.showMessageBoxSync(win,{type:'question',title:'MML Studio',message,buttons:['Continue','Cancel'],defaultId:1,cancelId:1,noLink:true})===0;}
 finally{restoreEditorFocus();event.returnValue=accepted;}
});
app.whenReady().then(()=>{
 win=new BrowserWindow({width:1320,height:850,minWidth:900,minHeight:560,icon:path.join(__dirname,'assets','logo.png'),backgroundColor:'#171d21',show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 // Stay hidden until the module script has run, so the empty skeleton is never shown.
 win.webContents.once('did-finish-load',()=>win.show());
 win.setMenuBarVisibility(false);win.setClosable(true);win.loadFile(path.join(__dirname,'index.html'));win.on('closed',()=>{if(mmlWindow&&!mmlWindow.isDestroyed())mmlWindow.close();mmlWindow=null;mmlData=null;});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',e=>e.preventDefault());
});
ipcMain.handle('save',async(_,text)=>{if(typeof text!=='string')throw Error('Invalid project');const r=await fileDialog('showSaveDialog',{defaultPath:safeFileStem(JSON.parse(text).name)+'.json',filters:[{name:'Studio JSON',extensions:['json']}]});if(r.canceled)return false;await fs.writeFile(r.filePath,text);return true;});
ipcMain.handle('open',async()=>{const r=await fileDialog('showOpenDialog',{properties:['openFile'],filters:[{name:'Studio JSON',extensions:['json']}]});return r.canceled?null:fs.readFile(r.filePaths[0],'utf8');});
ipcMain.handle('import-midi',async()=>{
 const r=await fileDialog('showOpenDialog',{title:'Import MIDI or MML',properties:['openFile'],filters:[{name:'MIDI and MML files',extensions:['mid','midi','mml','ms2mml','mne']}]});
 if(r.canceled)return null;
 const file=r.filePaths[0],bytes=await fs.readFile(file);
 return {name:path.basename(file),bytes:new Uint8Array(bytes)};
});
ipcMain.handle('export-mml',async(_,name,text)=>{if(typeof name!=='string'||typeof text!=='string')throw Error('Invalid MML export');const r=await fileDialog('showSaveDialog',{defaultPath:safeFileStem(name),filters:[{name:'MapleStory 2 MML',extensions:['ms2mml']}]});if(r.canceled)return false;await fs.writeFile(r.filePath,text,'utf8');return true;});
app.on('window-all-closed',()=>app.quit());
ipcMain.handle('sound-bank',async()=>new Uint8Array(await fs.readFile(path.join(__dirname,'assets','TimGM6mb.sf2'))));

let mmlWindow,mmlData;
function validMml(data){return data&&typeof data.name==='string'&&Array.isArray(data.channels)&&data.channels.every(s=>typeof s==='string')&&Array.isArray(data.warnings)&&data.warnings.every(s=>typeof s==='string');}
ipcMain.handle('mml-open',(event,data)=>{
 if(event.sender!==win.webContents||!validMml(data))throw Error('Invalid MML request');mmlData=data;
 if(mmlWindow&&!mmlWindow.isDestroyed()){mmlWindow.webContents.send('mml-data',data);mmlWindow.show();mmlWindow.focus();return;}
 mmlWindow=new BrowserWindow({parent:win,width:820,height:600,minWidth:450,minHeight:350,backgroundColor:'#23262a',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 mmlWindow.setMenuBarVisibility(false);mmlWindow.setClosable(true);mmlWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));mmlWindow.webContents.on('will-navigate',e=>e.preventDefault());mmlWindow.on('closed',()=>{mmlWindow=null;mmlData=null;});mmlWindow.loadFile(path.join(__dirname,'mml.html'));
});
ipcMain.handle('mml-update',(event,data)=>{if(event.sender!==win.webContents||!validMml(data))return;mmlData=data;if(mmlWindow&&!mmlWindow.isDestroyed())mmlWindow.webContents.send('mml-data',data);});
ipcMain.on('mml-ready',event=>{if(mmlWindow&&event.sender===mmlWindow.webContents&&mmlData)event.sender.send('mml-data',mmlData);});
ipcMain.handle('mml-copy',(event,text)=>{if(!mmlWindow||event.sender!==mmlWindow.webContents||typeof text!=='string')throw Error('Invalid clipboard request');clipboard.writeText(text);});
