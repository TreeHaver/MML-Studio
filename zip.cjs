// A minimal ZIP writer. An export of several sheets is easier to hand to a band as one
// archive, and Node already deflates, so this avoids adding a dependency for forty lines
// of container format: local headers, the central directory, and the end record.
const {deflateRawSync}=require('node:zlib');

const CRC_TABLE=(()=>{
 const table=new Int32Array(256);
 for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c;}
 return table;
})();
function crc32(buffer){
 let crc=-1;
 for(const byte of buffer)crc=CRC_TABLE[(crc^byte)&0xff]^(crc>>>8);
 return (crc^-1)>>>0;
}
// MS-DOS date and time, which is what the format stores. Seconds have two-second resolution.
function dosStamp(date){
 const time=(date.getHours()<<11)|(date.getMinutes()<<5)|(date.getSeconds()>>1);
 const day=((date.getFullYear()-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate();
 return {time,day};
}

/**
 * Builds the archive in memory: an export is a handful of text files, never large enough
 * to be worth streaming. `files` is [{name, text}] or [{name, bytes}].
 */
function zipArchive(files,now=new Date()){
 const {time,day}=dosStamp(now);
 const parts=[],central=[];
 let offset=0;
 for(const file of files){
  const name=Buffer.from(file.name,'utf8');
  const raw=file.bytes?Buffer.from(file.bytes):Buffer.from(file.text,'utf8');
  const deflated=deflateRawSync(raw);
  // Compression that makes a file bigger is not compression: store those as they are.
  const compressed=deflated.length<raw.length,body=compressed?deflated:raw;
  const crc=crc32(raw);
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);
  local.writeUInt16LE(compressed?8:0,8);local.writeUInt16LE(time,10);local.writeUInt16LE(day,12);
  local.writeUInt32LE(crc,14);local.writeUInt32LE(body.length,18);local.writeUInt32LE(raw.length,22);
  local.writeUInt16LE(name.length,26);local.writeUInt16LE(0,28);
  parts.push(local,name,body);
  const entry=Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50,0);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(0x800,8);
  entry.writeUInt16LE(compressed?8:0,10);entry.writeUInt16LE(time,12);entry.writeUInt16LE(day,14);
  entry.writeUInt32LE(crc,16);entry.writeUInt32LE(body.length,20);entry.writeUInt32LE(raw.length,24);
  entry.writeUInt16LE(name.length,28);entry.writeUInt16LE(0,30);entry.writeUInt16LE(0,32);
  entry.writeUInt16LE(0,34);entry.writeUInt16LE(0,36);entry.writeUInt32LE(0,38);entry.writeUInt32LE(offset,42);
  central.push(entry,name);
  offset+=local.length+name.length+body.length;
 }
 const directory=Buffer.concat(central);
 const end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(0,4);end.writeUInt16LE(0,6);
 end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);
 end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);end.writeUInt16LE(0,20);
 return Buffer.concat([...parts,directory,end]);
}

module.exports={zipArchive,crc32};
