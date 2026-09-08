// Standard MIDI File reader with chunk-boundary validation, not project caps.
export type MidiEvent={tick:number,track:number,port:number,status:number,data:Uint8Array,meta?:number};
export type MidiFile={ppq:number,names:string[],events:MidiEvent[],end:number,warnings:string[]};
export function readSMF(bytes:Uint8Array):MidiFile{
 let pos=0,limit=bytes.length;
 const need=(n:number)=>{if(n<0||pos+n>limit)throw Error('Truncated MIDI file.');};
 const byte=()=>{need(1);return bytes[pos++];};
 const word=()=>byte()*256+byte();
 const uint=()=>word()*65536+word();
 const tag=()=>String.fromCharCode(byte(),byte(),byte(),byte());
 const vlq=()=>{let value=0;for(let i=0;i<4;i++){const b=byte();value=value*128+(b&127);if(!(b&128))return value;}throw Error('Invalid MIDI variable-length value.');};
 const take=(n:number)=>{need(n);const data=bytes.subarray(pos,pos+n);pos+=n;return data;};
 if(tag()!=='MThd')throw Error('Expected a Standard MIDI File (.mid or .midi).');
 const headerLength=uint();if(headerLength<6)throw Error('Invalid MIDI header.');need(headerLength);
 const format=word(),tracks=word(),ppq=word();pos+=headerLength-6;
 if(format!==0&&format!==1)throw Error('Only MIDI formats 0 and 1 are supported; convert format 2 to format 1 first.');
 if(!tracks||(format===0&&tracks!==1))throw Error('Invalid MIDI track count.');
 if(ppq&0x8000)throw Error('SMPTE-timed MIDI is not supported; export with ticks-per-quarter-note timing.');
 if(!ppq)throw Error('Invalid MIDI timing resolution.');
 const events:MidiEvent[]=[],names:string[]=[],warnings:string[]=[];let end=0,invalidVelocities=0,invalidBends=0;
 const recoveries=new Map<string,number>();
 const report=(reason:string)=>recoveries.set(reason,(recoveries.get(reason)??0)+1);
 for(let track=0;track<tracks;track++){
  limit=bytes.length;if(tag()!=='MTrk')throw Error('Expected a MIDI track chunk.');
  const length=uint();need(length);limit=pos+length;
  let tick=0,running=0,port=0,ended=false;names.push(`Track ${track+1}`);
  while(pos<limit){
   tick+=vlq();if(!Number.isSafeInteger(tick))throw Error('MIDI timeline is too long.');
   let status=byte();if(status<128){if(!running)throw Error('Invalid MIDI running status.');pos--;status=running;}
   if(status===255){
    running=0;const meta=byte(),data=take(vlq());
    if(meta===3)names[track]=new TextDecoder().decode(data).replace(/[\x00-\x1f]/g,'').trim()||names[track];
    if(meta===33){if(data.length!==1||data[0]>127){report('invalid MIDI port events were skipped; the previous port was retained.');continue;}port=data[0];}
    if(meta===81&&(data.length!==3||data.every(b=>b===0))){report('invalid MIDI tempo events were skipped; the previous tempo was retained.');continue;}
    if(meta===88&&(data.length!==4||data[0]===0)){report('invalid MIDI time signature events were skipped; the previous signature was retained.');continue;}
    events.push({tick,track,port,status,data,meta});
    if(meta===47){if(data.length)report('end-of-track events had unexpected payloads; payloads were ignored.');ended=true;pos=limit;break;}
   }else if(status===240||status===247){
    running=0;events.push({tick,track,port,status,data:take(vlq())});
   }else{
    if(status<128||status>=240)throw Error('Unsupported MIDI system event.');
    running=status;let data=take((status>>4)===12||(status>>4)===13?1:2);
    if(data.some(b=>b>127)){
     // Event widths are known, so invalid values need not discard the file.
     // Never guess a pitch/controller/program; skip those events. Release
     // velocity is unused by the model, so retain the note-off at its tick.
     // Copy repairs to keep the caller's source bytes untouched.
     if(data[0]<=127&&data[1]>127&&(status>>4)===9){data=new Uint8Array([data[0],127]);invalidVelocities++;}
     else if(data[0]<=127&&data[1]>127&&(status>>4)===8){data=new Uint8Array([data[0],0]);report('invalid MIDI release velocities were ignored; note-off timing was retained.');}
     else if((status>>4)===14){invalidBends++;continue;}
     else{
      const kind=({8:'note-off',9:'note-on',10:'polyphonic aftertouch',11:'controller',12:'program change',13:'channel aftertouch'} as Record<number,string>)[status>>4];
      report(`invalid MIDI ${kind} events were skipped; previous channel settings were retained.`);continue;
     }
    }
    events.push({tick,track,port,status,data});
   }
  }
  if(!ended)warnings.push(`Track ${track+1} has no end-of-track marker.`);
  end=Math.max(end,tick);
 }
 if(invalidVelocities)warnings.push(`${invalidVelocities} invalid MIDI note-on velocities above 127 were reduced to 127 (maximum volume).`);
 if(invalidBends)warnings.push(`${invalidBends} invalid MIDI pitch-bend events were skipped; pitch bend is not imported.`);
 for(const [reason,count] of recoveries)warnings.push(`${count} ${reason}`);
 // Stable sorting keeps track/event order when timestamps coincide.
 events.sort((a,b)=>a.tick-b.tick);
 return {ppq,names,events,end,warnings};
}
