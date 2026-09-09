// Native Windows install handoff against an isolated tiny application fixture.
// No user installation, GitHub download or editor project is touched.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn,execFileSync}=require('node:child_process');
if(process.argv.includes('--launch')){
 const {app,BrowserWindow}=require('electron'),{launchPortableUpdate}=require('../updater.cjs');
 const root=process.argv[process.argv.indexOf('--launch')+1];
 app.setPath('userData',path.join(root,'profile'));app.disableHardwareAcceleration();
 let handoff;
 app.whenReady().then(()=>{const win=new BrowserWindow({show:false});win.on('closed',()=>{handoff=launchPortableUpdate({archive:path.join(root,'app.zip'),installDirectory:path.join(root,'install'),executable:path.join(root,'install','MML Music Studio.exe'),version:'0.3.8'});});win.close();});
 app.on('window-all-closed',async()=>{await handoff;app.quit();});
}else{
 (async()=>{
  assert.equal(process.platform,'win32');fs.mkdirSync('.validation',{recursive:true});
  const root=fs.mkdtempSync(path.resolve('.validation/updater-native-')),install=path.join(root,'install');fs.mkdirSync(install);
  const source=path.join(root,'Marker.cs'),exe=path.join(root,'Marker.exe');
  fs.writeFileSync(source,'using System; using System.IO; class Marker { static void Main() { File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"restarted.txt"),"updated"); } }');
  const quote=s=>"'"+s.replaceAll("'","''")+"'";
  execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Add-Type -Path ${quote(source)} -OutputAssembly ${quote(exe)} -OutputType WindowsApplication`],{windowsHide:true});
  fs.copyFileSync(exe,path.join(install,'MML Music Studio.exe'));fs.mkdirSync(path.join(install,'resources','app'),{recursive:true});
  fs.writeFileSync(path.join(install,'resources','app','package.json'),'{"version":"0.3.7"}');
  fs.mkdirSync(path.join(install,'Example Project'));fs.writeFileSync(path.join(install,'Example Project','keep.json'),'user example');
  const {zipArchive}=require('../zip.cjs');
  fs.writeFileSync(path.join(root,'app.zip'),zipArchive([{name:'app/MML Music Studio.exe',bytes:fs.readFileSync(exe)},{name:'app/resources/app/package.json',text:'{"version":"0.3.8"}'},{name:'app/Example Project/keep.json',text:'replacement example'}]));
  const child=spawn(require('electron'),[__filename,'--launch',root],{stdio:'ignore',windowsHide:true});
  await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Electron exit '+code)));});
  const deadline=Date.now()+20000;
  while(Date.now()<deadline&&(!fs.existsSync(path.join(install,'restarted.txt'))||fs.existsSync(path.join(root,'app.zip'))))await new Promise(r=>setTimeout(r,100));
  assert.ok(fs.existsSync(path.join(install,'restarted.txt')),fs.existsSync(path.join(root,'update-error.log'))?fs.readFileSync(path.join(root,'update-error.log'),'utf8'):'Helper did not restart fixture');
  assert.equal(JSON.parse(fs.readFileSync(path.join(install,'resources','app','package.json'))).version,'0.3.8');
  assert.equal(fs.readFileSync(path.join(install,'Example Project','keep.json'),'utf8'),'user example');
  assert.ok(!fs.existsSync(path.join(root,'app.zip')));assert.ok(!fs.existsSync(path.join(root,'apply-update-0.3.8.ps1')));
  fs.writeFileSync('.validation/electron-updater.json',JSON.stringify({passed:true,root,checks:['helper survives Electron exit','real PowerShell extracts and replaces fixture','updated executable restarts','existing examples preserved','archive and script cleaned']},null,2));
  console.log('Native updater handoff passed.');
 })().catch(error=>{console.error(error);process.exitCode=1;});
}
