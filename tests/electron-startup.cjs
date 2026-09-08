// Run with node_modules/electron/dist/electron.exe tests/electron-startup.cjs
const {app}=require('electron');
const assert=require('node:assert/strict');
const deadline=setTimeout(()=>{console.error('Startup timed out');app.exit(1);},20000);
app.on('browser-window-created',(_,win)=>{
 win.webContents.once('did-fail-load',(_,code,message)=>{
  console.error(code,message);app.exit(1);
 });
 win.webContents.once('did-finish-load',async()=>{
  try{
   assert.ok(app.commandLine.hasSwitch('disable-http-cache'));
   assert.ok(app.commandLine.hasSwitch('disable-gpu-shader-disk-cache'));
   assert.ok(await win.webContents.executeJavaScript("!!document.getElementById('canvas')"));
   assert.equal(await win.webContents.executeJavaScript("document.getElementById('app-version').textContent"),'v'+app.getVersion());
   console.log('Native startup passed: editor loaded with disk caches disabled.');
   clearTimeout(deadline);app.exit(0);
  }catch(error){console.error(error);app.exit(1);}
 });
});
require('../main.cjs');
