// Run after build.bat: node --test tests/release.test.cjs
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'staging/app'),release=path.join(root,'releases/MML Music Studio-win32-x64');
function files(dir,prefix=''){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name),prefix+e.name+'/'):[prefix+e.name]);}
test('release app exactly matches clean staging and includes runtime code/assets/licenses only',()=>{
 const staged=files(stage).sort(),app=path.join(release,'resources/app');
 assert.deepEqual(files(app).sort(),staged);
 for(const file of files(path.join(root,'Example Project'))){
  const relative='Example Project/'+file;
  assert.ok(staged.includes(relative),relative);
  assert.ok(fs.readFileSync(path.join(root,relative)).equals(fs.readFileSync(path.join(stage,relative))),relative);
 }
 for(const file of staged){
  assert.doesNotMatch(file,/\.md$|\.zip$|\.map$|^\.|node_modules|^src\/|^tests\/|\.bat$|\.ps1$/);
  assert.ok(fs.readFileSync(path.join(stage,file)).equals(fs.readFileSync(path.join(app,file))),file);
 }
 for(const file of ['main.cjs','preload.cjs','dist/renderer.js','dist/mml-window.js','vendor/synth.js','vendor/spessasynth_processor.min.js','vendor/SpessaSynth-Core-LICENSE.txt','assets/TimGM6mb.sf2','assets/GPL-2.txt'])assert.ok(staged.includes(file),file);
 const manifest=JSON.parse(fs.readFileSync(path.join(app,'package.json')));
 assert.equal(manifest.main,'main.cjs');assert.equal(manifest.type,'module');assert.equal(manifest.dependencies,undefined);assert.equal(manifest.scripts,undefined);
 assert.ok(fs.existsSync(path.join(release,'MML Music Studio.exe')));
 assert.ok(fs.existsSync(path.join(release,'LICENSES.chromium.html')));
 assert.ok(fs.existsSync(path.join(release,'locales/en-US.pak')));
 assert.equal(fs.existsSync(path.join(release,'resources/default_app.asar')),false);
});
test('release executable embeds the studio ICO image payloads',()=>{
 const ico=fs.readFileSync(path.join(root,'assets/logo.ico')),exe=fs.readFileSync(path.join(release,'MML Music Studio.exe'));
 assert.equal(exe.toString('ascii',0,2),'MZ');assert.equal(exe.readUInt32LE(exe.readUInt32LE(60)),0x4550);
 const count=ico.readUInt16LE(4);assert.ok(count>0);
 for(let i=0;i<count;i++){
  const size=ico.readUInt32LE(6+i*16+8),offset=ico.readUInt32LE(6+i*16+12);
  assert.ok(exe.includes(ico.subarray(offset,offset+size)),`Missing studio icon frame ${i}`);
 }
});
