const fs=require('node:fs/promises'),path=require('node:path');
const directory=path.join(__dirname,'assets');
const DEFAULT_BANK='TimGM6mb.sf2';
async function listSoundBanks(){
 const entries=await fs.readdir(directory,{withFileTypes:true});
 return entries.filter(e=>e.isFile()&&/\.(sf2|dls)$/i.test(e.name)).map(e=>({id:e.name,name:e.name})).sort((a,b)=>a.id===DEFAULT_BANK?-1:b.id===DEFAULT_BANK?1:a.name.localeCompare(b.name));
}
async function soundBankPath(id=DEFAULT_BANK){
 if(typeof id!=='string'||!(await listSoundBanks()).some(bank=>bank.id===id))throw Error('Sound bank unavailable. Choose an SF2 or DLS file from the assets folder.');
 return path.join(directory,id);
}
module.exports={DEFAULT_BANK,listSoundBanks,soundBankPath};
