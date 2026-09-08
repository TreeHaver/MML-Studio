const path=require('node:path'),{Worker}=require('node:worker_threads'),{randomUUID}=require('node:crypto');
const FORMATS={
 wav:{name:'WAV — uncompressed audio',codec:['-c:a','pcm_s16le','-rf64','auto','-f','wav']},
 mp3:{name:'MP3 — compressed audio',codec:['-c:a','libmp3lame','-b:a','192k','-f','mp3']},
 ogg:{name:'OGG Vorbis — compressed audio',codec:['-c:a','libvorbis','-q:a','5','-f','ogg']},
 flac:{name:'FLAC — lossless audio',codec:['-c:a','flac','-f','flac']},
 m4a:{name:'M4A (AAC) — compressed audio',codec:['-c:a','aac','-b:a','192k','-f','ipod']},
 opus:{name:'Opus — compressed audio',codec:['-c:a','libopus','-b:a','160k','-f','opus']}
};
module.exports=function installAudioExport({ipcMain,getWindow,fileDialog,safeFileStem}){
 let busy=false,worker=null,cancelRequested=false;
 const owned=event=>{const win=getWindow();return win&&!win.isDestroyed()&&event.sender===win.webContents;};
 ipcMain.on('cancel-audio-export',event=>{if(owned(event)){cancelRequested=true;worker?.postMessage('cancel');}});
 ipcMain.handle('export-audio',async(event,name,request)=>{
  if(!owned(event)||typeof name!=='string'||!request)throw Error('Invalid audio export.');
  if(busy)throw Error('An audio export is already running.');busy=true;cancelRequested=false;
  const sender=event.sender,cancel=()=>{cancelRequested=true;worker?.postMessage('cancel');};sender.once('destroyed',cancel);
  try{
   const choice=await fileDialog('showSaveDialog',{title:'Export audio',defaultPath:safeFileStem(name)+'.wav',filters:Object.entries(FORMATS).map(([ext,format])=>({name:format.name,extensions:[ext]}))});
   if(choice.canceled||cancelRequested)return {canceled:true};
   let target=choice.filePath,extension=path.extname(target).slice(1).toLowerCase();
   if(!extension){extension='wav';target+='.wav';}
   const format=FORMATS[extension];if(!format)throw Error('Choose a supported audio extension: .wav, .mp3, .ogg, .flac, .m4a or .opus.');
   const temporary=path.join(path.dirname(target),`.mml-audio-${randomUUID()}.tmp`);
   worker=new Worker(path.join(__dirname,'vendor/audio-worker.cjs'),{workerData:{request,encoder:path.join(__dirname,'vendor/ffmpeg.exe'),bank:path.join(__dirname,'assets/TimGM6mb.sf2'),target,temporary,codec:format.codec}});
   return await new Promise((resolve,reject)=>{
    let outcome;
    worker.on('message',message=>{
     if(message.progress!==undefined&&!sender.isDestroyed())sender.send('audio-export-progress',message.progress);
     if(message.result)outcome={...message.result,format:extension};
     if(message.error)outcome=message.canceled?{canceled:true}:{error:message.error};
    });
    worker.on('error',reject);
    worker.on('exit',code=>{if(outcome?.error)reject(Error(outcome.error));else if(outcome)resolve(outcome);else reject(Error(`Audio renderer exited unexpectedly (${code}).`));});
   });
  }finally{sender.removeListener('destroyed',cancel);worker=null;busy=false;}
 });
};
