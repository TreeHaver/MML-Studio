const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('nativeDialogs',{confirm:message=>ipcRenderer.sendSync('confirm-action',message),closeChoice:()=>ipcRenderer.invoke('close-choice')});
contextBridge.exposeInMainWorld('files',{soundBank:()=>ipcRenderer.invoke('sound-bank'),save:text=>ipcRenderer.invoke('save',text),open:()=>ipcRenderer.invoke('open'),importMidi:()=>ipcRenderer.invoke('import-midi'),exportMml:(name,text)=>ipcRenderer.invoke('export-mml',name,text)});

contextBridge.exposeInMainWorld('mml',{open:data=>ipcRenderer.invoke('mml-open',data),update:data=>ipcRenderer.invoke('mml-update',data),onData:callback=>ipcRenderer.on('mml-data',(_,data)=>callback(data)),ready:()=>ipcRenderer.send('mml-ready'),copy:text=>ipcRenderer.invoke('mml-copy',text)});

contextBridge.exposeInMainWorld('editorClose',{onRequest:callback=>{ipcRenderer.on('editor-close-request',async(_,id)=>{let allowed=false;try{allowed=await callback()===true;}catch{allowed=false;}finally{ipcRenderer.send('editor-close-response',id,allowed);}});ipcRenderer.send('editor-close-ready');}});
