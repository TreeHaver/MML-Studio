const vlq=n=>{const b=[n&127];while(n>>=7)b.unshift((n&127)|128);return b;};
const u32=n=>[n>>>24,(n>>>16)&255,(n>>>8)&255,n&255];
const chunk=(tag,data)=>[...Buffer.from(tag),...u32(data.length),...data];
const event=(delta,...data)=>[...vlq(delta),...data];
const end=(delta=0)=>event(delta,255,47,0);
const midi=(tracks,ppq=32,format=tracks.length===1?0:1)=>new Uint8Array([
 ...chunk('MThd',[0,format,tracks.length>>8,tracks.length&255,ppq>>8,ppq&255]),
 ...tracks.flatMap(track=>chunk('MTrk',track.flat()))
]);
const repeatedMidi=count=>{
 const bytes=new Uint8Array(22+count*8+4),view=new DataView(bytes.buffer);
 bytes.set([77,84,104,100,0,0,0,6,0,0,0,1,0,32,77,84,114,107]);
 view.setUint32(18,count*8+4);
 for(let i=0;i<count;i++)bytes.set([0,144,60,100,1,128,60,0],22+i*8);
 bytes.set([0,255,47,0],bytes.length-4);return bytes;
};
// Insert a legal sequencer-specific metadata payload before the final EOT.
const padMidi=(source,size)=>{
 const prefix=new Uint8Array([0,255,127,...vlq(size)]),cut=source.length-4;
 const bytes=new Uint8Array(source.length+prefix.length+size);
 bytes.set(source.subarray(0,cut));bytes.set(prefix,cut);bytes.set(source.subarray(cut),bytes.length-4);
 new DataView(bytes.buffer).setUint32(18,bytes.length-22);return bytes;
};
module.exports={midi,event,end,repeatedMidi,padMidi};
