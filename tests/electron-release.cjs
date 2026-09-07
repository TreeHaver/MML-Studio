// Native smoke check of packaged app assets using the identical installed runtime.
const {app}=require('electron'),path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const output=path.resolve('.validation/electron-release.json');fs.mkdirSync(path.dirname(output),{recursive:true});
const deadline=setTimeout(()=>finish(Error('Packaged app startup timed out')),30000);
function finish(error){clearTimeout(deadline);fs.writeFileSync(output,JSON.stringify({passed:!error,error:error?String(error.stack??error):null},null,2));app.exit(error?1:0);}
app.on('browser-window-created',(_,win)=>{
 win.webContents.once('did-fail-load',(_,code,message)=>finish(Error(`${code}: ${message}`)));
 win.webContents.once('did-finish-load',async()=>{
  try{
   assert.ok(await win.webContents.executeJavaScript(`document.querySelector('#remove-overlap') !== null && document.querySelector('#instruments').children.length > 0`));
   assert.ok(await win.webContents.executeJavaScript(`window.files.soundBank().then(bytes=>bytes.length>1000000)`));
   assert.ok(await win.webContents.executeJavaScript(`import('./dist/playback/engine.js').then(async module=>!!(await module.getEngine()))`,true));
   finish();
  }catch(error){finish(error);}
 });
});
require('../releases/MML Music Studio-win32-x64/resources/app/main.cjs');
