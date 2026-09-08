const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),crypto=require('node:crypto');
const {Readable,Transform}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const {spawn}=require('node:child_process');

const RELEASE_API='https://api.github.com/repos/TreeHaver/MML-Studio/releases/latest';
const MAX_UPDATE_BYTES=512*1024*1024;

function versionParts(value){const match=/^v?(\d+(?:\.\d+){2,3})(?:[-+][0-9A-Za-z.-]+)?$/.exec(String(value).trim());if(!match)throw Error('Invalid release version: '+value);return match[1].split('.').map(Number);}
function compareVersions(a,b){const left=versionParts(a),right=versionParts(b),length=Math.max(left.length,right.length);for(let i=0;i<length;i++){const difference=(left[i]??0)-(right[i]??0);if(difference)return Math.sign(difference);}return 0;}
function findWindowsAsset(release){if(!release||release.draft||release.prerelease||!Array.isArray(release.assets))return null;return release.assets.find(asset=>asset&&/MML[ .]Music[ .]Studio-win32-x64\.zip$/i.test(asset.name)&&typeof asset.browser_download_url==='string')??null;}
function digestValue(value){const match=/^sha256:([0-9a-f]{64})$/i.exec(String(value??''));if(!match)throw Error('The release asset has no valid SHA-256 digest.');return match[1].toLowerCase();}

async function downloadAsset({fetchImpl,url,target,size,digest,onProgress=()=>{}}){
 if(!Number.isSafeInteger(size)||size<1||size>MAX_UPDATE_BYTES)throw Error('Invalid update size.');
 const response=await fetchImpl(url,{redirect:'follow',headers:{'User-Agent':'MML-Music-Studio-Updater','Accept':'application/octet-stream'}});if(!response.ok||!response.body)throw Error(`Update download failed (${response.status}).`);
 await fsp.mkdir(path.dirname(target),{recursive:true});const temporary=target+'.part';await fsp.rm(temporary,{force:true});
 const hash=crypto.createHash('sha256');let received=0;
 const meter=new Transform({transform(chunk,encoding,callback){received+=chunk.length;if(received>MAX_UPDATE_BYTES){callback(Error('Update download exceeded the size limit.'));return;}hash.update(chunk);onProgress(received,size);callback(null,chunk);}});
 try{await pipeline(Readable.fromWeb(response.body),meter,fs.createWriteStream(temporary,{flags:'wx'}));if(received!==size)throw Error(`Update size mismatch: expected ${size}, received ${received}.`);if(hash.digest('hex')!==digestValue(digest))throw Error('Update SHA-256 verification failed.');await fsp.rm(target,{force:true});await fsp.rename(temporary,target);return target;}catch(error){await fsp.rm(temporary,{force:true});throw error;}
}

const ps=value=>"'"+String(value).replaceAll("'","''")+"'";
function portableScript({archive,installDirectory,executable,pid,version}){
 const updateDirectory=path.dirname(archive),stage=path.join(updateDirectory,'extract-'+version.replace(/[^0-9A-Za-z.-]/g,'_'));
 return `$ErrorActionPreference='Stop'\n$archive=${ps(archive)}\n$install=${ps(installDirectory)}\n$targetExe=${ps(executable)}\n$stage=${ps(stage)}\n$log=${ps(path.join(updateDirectory,'update-error.log'))}\ntry {\n  for($i=0;$i -lt 120;$i++){if(-not (Get-Process -Id ${Number(pid)} -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 250}\n  if(Get-Process -Id ${Number(pid)} -ErrorAction SilentlyContinue){throw 'MML Studio did not close in time.'}\n  if(-not (Test-Path -LiteralPath $targetExe -PathType Leaf)){throw 'The installed executable was not found.'}\n  if(Test-Path -LiteralPath $stage){Remove-Item -LiteralPath $stage -Recurse -Force}\n  Expand-Archive -LiteralPath $archive -DestinationPath $stage -Force\n  $executables=@(Get-ChildItem -LiteralPath $stage -Filter 'MML Music Studio.exe' -Recurse -File)\n  if($executables.Count -ne 1){throw 'The update archive does not contain exactly one MML Music Studio.exe.'}\n  $source=$executables[0].Directory.FullName\n  if(-not (Test-Path -LiteralPath (Join-Path $source 'resources\\app\\package.json') -PathType Leaf)){throw 'The update archive has no packaged application payload.'}\n  Get-ChildItem -LiteralPath $source -Force | Where-Object {$_.Name -ne 'Example Project'} | Copy-Item -Destination $install -Recurse -Force\n  $sourceExample=Join-Path $source 'Example Project';$targetExample=Join-Path $install 'Example Project'\n  if((Test-Path -LiteralPath $sourceExample) -and -not (Test-Path -LiteralPath $targetExample)){Copy-Item -LiteralPath $sourceExample -Destination $targetExample -Recurse}\n  Start-Process -FilePath $targetExe -WorkingDirectory $install\n  Remove-Item -LiteralPath $stage -Recurse -Force\n  Remove-Item -LiteralPath $archive -Force\n  Remove-Item -LiteralPath $PSCommandPath -Force\n} catch {\n  $_ | Out-File -LiteralPath $log -Encoding utf8\n  if(Test-Path -LiteralPath $targetExe){Start-Process -FilePath $targetExe -WorkingDirectory $install}\n}\n`;
}

function launchPortableUpdate(update){const directory=path.dirname(update.archive),script=path.join(directory,'apply-update-'+update.version.replace(/[^0-9A-Za-z.-]/g,'_')+'.ps1');fs.writeFileSync(script,portableScript({...update,pid:process.pid}),'utf8');const child=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',script],{detached:true,stdio:'ignore',windowsHide:true});child.unref();}

function createPortableUpdater({app,dialog,getWindow,onReady,fetchImpl=globalThis.fetch,platform=process.platform,schedule=setTimeout}){
 let checking=false;
 const check=async()=>{
  if(checking||platform!=='win32'||!app.isPackaged)return {status:'skipped'};checking=true;let chosen=false;const win=getWindow();
  try{
   const response=await fetchImpl(RELEASE_API,{headers:{'User-Agent':'MML-Music-Studio-Updater','Accept':'application/vnd.github+json'}});if(!response.ok)throw Error(`Update check failed (${response.status}).`);
   const release=await response.json(),current=app.getVersion(),version=String(release.tag_name??'');if(compareVersions(version,current)<=0)return {status:'current',version:current};
   const asset=findWindowsAsset(release);if(!asset)throw Error('The latest release has no Windows x64 portable ZIP.');digestValue(asset.digest);
   const answer=await dialog.showMessageBox(win,{type:'info',title:'MML Studio update',message:`MML Studio ${version} is available.`,detail:`You are using ${current}. Download and install the portable update now? The app will restart after your work is saved.`,buttons:['Download and install','Later'],defaultId:0,cancelId:1,noLink:true});if(answer.response!==0)return {status:'later',version};chosen=true;
   const directory=path.join(app.getPath('userData'),'updates'),archive=path.join(directory,'MML.Music.Studio-'+version+'-win32-x64.zip');
   await downloadAsset({fetchImpl,url:asset.browser_download_url,target:archive,size:asset.size,digest:asset.digest,onProgress:(received,total)=>{const active=getWindow();if(active&&!active.isDestroyed())active.setProgressBar(received/total);}});
   if(win&&!win.isDestroyed())win.setProgressBar(-1);onReady({archive,version,installDirectory:path.dirname(process.execPath),executable:process.execPath});return {status:'ready',version};
  }catch(error){if(win&&!win.isDestroyed())win.setProgressBar(-1);if(chosen&&win&&!win.isDestroyed())await dialog.showMessageBox(win,{type:'error',title:'Update failed',message:'MML Studio could not install the update.',detail:String(error?.message??error),buttons:['OK']});return {status:'error',error};}finally{checking=false;}
 };
 const start=()=>{if(platform!=='win32'||!app.isPackaged)return;const timer=schedule(()=>{void check();},4000);timer?.unref?.();};
 return {check,start};
}

module.exports={RELEASE_API,compareVersions,findWindowsAsset,digestValue,downloadAsset,portableScript,launchPortableUpdate,createPortableUpdater};
