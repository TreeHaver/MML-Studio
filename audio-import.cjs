const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process');

/** Decode local bytes, including seek-dependent containers, without touching the source. */
async function decodeAudio(bytes,{encoder=path.join(__dirname,'vendor/ffmpeg.exe'),signal}={}){
 if(!(bytes instanceof Uint8Array)||!bytes.length)throw Error('The audio file is empty or invalid.');
 try{await fs.access(encoder);}catch{throw Error('The bundled FFmpeg is missing. Restore vendor/ffmpeg.exe to import audio.');}
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'mml-voice-'));
 try{
  const input=path.join(folder,'input');await fs.writeFile(input,bytes);
  const pcm=await new Promise((resolve,reject)=>{
   const child=spawn(encoder,['-hide_banner','-loglevel','error','-nostdin','-protocol_whitelist','file,pipe','-i',input,'-map','0:a:0','-vn','-ac','1','-ar','16000','-c:a','pcm_f32le','-f','f32le','pipe:1'],{windowsHide:true,stdio:['ignore','pipe','pipe'],signal});
   const chunks=[];let errors='',failure;
   child.stdout.on('data',chunk=>chunks.push(chunk));
   child.stderr.on('data',chunk=>{errors=(errors+chunk.toString()).slice(-4000);});
   child.on('error',error=>{failure=error;});
   // Wait for file handles to close before cleanup, including aborted decodes.
   child.on('close',code=>failure?reject(failure):code===0?resolve(Buffer.concat(chunks)):reject(Error('Could not decode audio with FFmpeg: '+(errors.trim()||`exit ${code}`))));
  });
  if(!pcm.length||pcm.length%4)throw Error('FFmpeg returned no usable audio samples.');
  const samples=new Float32Array(pcm.length/4);
  for(let i=0;i<samples.length;i++)samples[i]=pcm.readFloatLE(i*4);
  return {samples,sampleRate:16000};
 }finally{await fs.rm(folder,{recursive:true,force:true});}
}

function installAudioImport({ipcMain,getWindow}){
 let busy=false;
 ipcMain.handle('decode-audio',async(event,bytes)=>{
  const win=getWindow();
  if(!win||win.isDestroyed()||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('Invalid audio import request.');
  if(busy)throw Error('An audio file is already being decoded.');
  busy=true;const controller=new AbortController(),cancel=()=>controller.abort();
  event.sender.once('destroyed',cancel);
  try{return await decodeAudio(bytes,{signal:controller.signal});}
  finally{event.sender.removeListener('destroyed',cancel);busy=false;}
 });
}
module.exports={decodeAudio,installAudioImport};
