import {fresh} from '../model/project.ts';
import {ensureInstructions} from '../model/instructions.ts';
import {valid} from '../model/validation.ts';
import {validSignature} from '../music/structure.ts';
import type {Note} from '../model/types.ts';
import {condenseImportInstructions} from './instructions.ts';

type Tone={pitch:number|null,duration:number,tie:boolean};
/** Single-part ABC and game chords. File callers opt into reported recovery;
 * direct strict callers retain atomic rejection for unsupported syntax. */
export function importAbc(text:string,name='ABC',options:{recover?:boolean}={}){
 const recover=options.recover===true;
 const project=fresh();project.name=name;project.instruments[0].name=name;
 const warnings=new Set<string>(),accidentals=new Map<number,number>(),key=new Map<string,number>();
 const tempos=new Map<number,number>(),signatures=new Map<number,string>();
 // Inspect the complete music before parsing: a rest in a later chord also selects
 // shortest-member timing for earlier chords. Ignore titles, comments and labels.
 const music=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>!/^\s*[A-Za-z]:/.test(line)).map(line=>line.replace(/"[^"\r\n]*"/g,'').replace(/%.*$/,'')).join('\n');
 const restChord=[...music.matchAll(/\[([^\]\r\n]*)\]/g)].some(m=>/[zx]/.test(m[1])&&/^[\sA-Ga-gzx^_=,'/0-9-]+$/.test(m[1]));
 // Metadata or game-only rest chords select timing, never a pitch transpose.
 const game=restChord||/^\s*(?:Z:.*(?:LotRO MIDI Player|Maestro|Starbound Composer)|%%lotro-compatible\s*$)/im.test(text);
 if(game)warnings.add('Game ABC chord timing: the shortest member (including rests) advances the clock; longer notes sustain. Pitches use ABC C = middle C, without game-specific transposition.');
 let tick=0,unit=16,meter='4/4',explicitUnit=false,body=false,hasKey=false,references=0,title=false,id=0,volume=8;
 let pending=new Map<number,Note>(),tupletLeft=0,tupletFactor=1,nextRhythm=1;
 const rounded=(value:number)=>{
  const result=Math.round(value);
  if(!Number.isSafeInteger(result)||result<0)throw Error('ABC timing exceeds the version-2 numeric range.');
  if(Math.abs(value-result)>1e-7)warnings.add('Fractional timing rounded cumulatively to the nearest 1/128 whole-note unit; no grid snapping applied.');
  return result;
 };
 const fraction=(value:string)=>{const m=value.match(/^(\d+)\s*\/\s*(\d+)$/);if(!m||!Number(m[1])||!Number(m[2]))throw Error('Invalid ABC fraction: '+value);const n=Number(m[1])/Number(m[2]);if(!Number.isFinite(n)||n<=0)throw Error('Invalid ABC fraction: '+value);return n;};
 function field(code:string,value:string){
  value=value.trim();
  if(recover&&code==='V'){warnings.add('ABC voice routing is not represented: voice blocks were read sequentially into one instrument. Check alignment or import separate part files.');return;}
  if(code==='X'){if(body||++references>1)throw Error('Multiple ABC tunes are not supported in one file. Export each part as a separate ABC file.');if(!/^\d+$/.test(value))throw Error('Invalid ABC tune number.');return;}
  if(code==='T'){if(!title){project.instruments[0].name=value||name;title=true;}return;}
  if('BCDFGHNORSAZWw'.includes(code)){warnings.add('ABC descriptive metadata and lyrics are not stored; the first title names the imported instrument.');return;}
  if(code==='L'){unit=128*fraction(value);explicitUnit=true;return;}
  if(code==='M'){
   meter=value==='C'?'4/4':value==='C|'?'2/2':value.replace(/\s/g,'');
   if(!validSignature(meter))throw Error('Unsupported ABC meter: '+value);
   signatures.set(rounded(tick),meter);
   if(!body&&!explicitUnit)unit=fraction(meter)<.75?8:16;
   return;
  }
  if(code==='Q'){
   const clean=value.replace(/"[^"\r\n]*"/g,'').trim(),m=clean.match(/^(?:(\d+\s*\/\s*\d+)\s*=\s*)?(\d+(?:\.\d+)?)$/);
   if(!m)throw Error('Unsupported ABC tempo: '+value);
   const raw=Number(m[2])*(m[1]?fraction(m[1])*4:1),tempo=Math.round(raw),start=rounded(tick);
   if(!Number.isSafeInteger(tempo)||tempo<=0)throw Error('ABC tempo cannot be represented as positive integer BPM.');
   if(Math.abs(raw-tempo)>1e-7)warnings.add('ABC tempo rounded to the nearest whole quarter-note BPM.');
   if(tempos.has(start)&&tempos.get(start)!==tempo)warnings.add('Conflicting ABC tempos at the same position use the last encountered value.');
   tempos.set(start,tempo);return;
  }
  if(code==='K'){
   key.clear();accidentals.clear();hasKey=true;
   if(/^none$/i.test(value))return;
   const m=value.match(/^([A-G])([#b]?)(?:\s*(maj(?:or)?|ion(?:ian)?|m|min(?:or)?|aeo(?:lian)?|dor(?:ian)?|phr(?:ygian)?|lyd(?:ian)?|mix(?:olydian)?|loc(?:rian)?))?$/i);
   if(!m)throw Error('Unsupported ABC key or key parameters: '+value);
   const mode=(m[3]||'maj').toLowerCase(),offset=mode==='m'||mode.startsWith('min')||mode.startsWith('aeo')?-3:mode.startsWith('dor')?-2:mode.startsWith('phr')?-4:mode.startsWith('lyd')?1:mode.startsWith('mix')?-1:mode.startsWith('loc')?-5:0;
   const fifths=({C:0,D:2,E:4,F:-1,G:1,A:3,B:5}[m[1].toUpperCase()]!)+(m[2]==='#'?7:m[2]==='b'?-7:0)+offset;
   if(Math.abs(fifths)>7)throw Error('Unsupported ABC key signature: '+value);
   for(const letter of (fifths<0?'BEADGCF':'FCGDAEB').slice(0,Math.abs(fifths)))key.set(letter,fifths<0?-1:1);
   return;
  }
  throw Error('Unsupported ABC field '+code+': '+value);
 }
 for(const [lineIndex,raw] of text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
  try{
   if(/^\s*%%/.test(raw)&&!/^\s*%%lotro-compatible\s*$/i.test(raw))throw Error('Unsupported ABC directive: '+raw.trim());
   const line=raw.replace(/%.*$/,'').trim();if(!line)continue;
   const header=line.match(/^([A-Za-z]):\s*(.*)$/);if(header){field(header[1],header[2]);continue;}
   if(!hasKey)throw Error('ABC music must follow a K: key header.');body=true;
   let p=0;
   const length=()=>{
    const m=line.slice(p).match(/^(\d+)?(\/+(?:\d+)?)?/)!;p+=m[0].length;
    let result=Number(m[1]??1);
    if(m[2]){const divisor=m[2].match(/^(\/+)(\d+)?$/)!;result/=(divisor[2]?Number(divisor[2]):2)*2**(divisor[1].length-1);}
    if(!Number.isFinite(result)||result<=0)throw Error('Invalid ABC note length.');return result;
   };
   const tone=():Tone=>{
    const m=line.slice(p).match(/^(\^\^|__|\^|_|=)?([A-Ga-gzx])([,']*)/);
    if(!m)throw Error('Expected an ABC note or rest at column '+(p+1));p+=m[0].length;
    const letter=m[2],rest=letter==='z'||letter==='x';
    if(rest&&(m[1]||m[3]))throw Error('An ABC rest cannot have accidentals or octave marks.');
    const natural=60+({C:0,D:2,E:4,F:5,G:7,A:9,B:11}[letter.toUpperCase()]??0)+(letter===letter.toLowerCase()?12:0)+[...m[3]].reduce((n,c)=>n+(c==="'"?12:-12),0);
    if(m[1])accidentals.set(natural,m[1]==='='?0:m[1][0]==='^'?m[1].length:-m[1].length);
    const pitch=rest?null:natural+(accidentals.get(natural)??key.get(letter.toUpperCase())??0),duration=unit*length(),tie=line[p]==='-';if(tie)p++;
    if(rest&&tie)throw Error('Cannot tie an ABC rest.');return {pitch,duration,tie};
   };
   while(p<line.length){
    const c=line[p];if(/\s/.test(c)){p++;continue;}
    if(recover&&c==='('&&/^\([2-9](?::\d*)?(?::\d+)?/.test(line.slice(p))){
     const m=line.slice(p).match(/^\(([2-9])(?::(\d*))?(?::(\d+))?/)!;
     const count=Number(m[1]),compound=Number(meter.split('/')[0])%3===0&&Number(meter.split('/')[0])>3;
     const time=m[2]?Number(m[2]):[2,4,8].includes(count)?3:[3,6].includes(count)?2:compound?3:2;
     tupletLeft=m[3]?Number(m[3]):count;if(!time||!tupletLeft)throw Error('Invalid ABC tuplet.');tupletFactor=time/count;p+=m[0].length;continue;
    }
    if(recover&&(c==='('||c===')'||c==='.'||c==='~')){warnings.add('ABC slurs and articulation marks were omitted; written note durations were retained.');p++;continue;}
    if(recover&&c==='{'){const end=line.indexOf('}',p);if(end<0)throw Error('Unclosed ABC grace group.');warnings.add('ABC grace notes were omitted; main notes and their written timing were retained.');p=end+1;continue;}
    if(recover&&(c===':'||/^\[\d/.test(line.slice(p))||/^\|\d/.test(line.slice(p)))){
     const m=line.slice(p).match(/^(?::+|[\[|]\d+(?:[-,]\d+)*)/)!;p+=m[0].length;accidentals.clear();warnings.add('ABC repeats/endings were read once in written order, without repeat expansion. Check the arrangement.');continue;
    }
    if(c==='['&&/^[A-Za-z]:/.test(line.slice(p+1))){const end=line.indexOf(']',p);if(end<0)throw Error('Unclosed ABC inline field.');field(line[p+1],line.slice(p+3,end));p=end+1;continue;}
    if(c==='|'||line.startsWith('[|',p)){
     if(/^\|[:\d]/.test(line.slice(p))&&!recover)throw Error('ABC repeats and numbered endings are not supported. Expand them before importing.');
     p+=line.startsWith('[|',p)?2:1;if(line[p]===']')p++;accidentals.clear();continue;
    }
    if(c==='"'){const end=line.indexOf('"',p+1);if(end<0)throw Error('Unclosed ABC annotation.');p=end+1;warnings.add('ABC chord symbols and text annotations are not performed or stored.');continue;}
    if(c==='+'||c==='!'){
     const end=line.indexOf(c,p+1);if(end<0)throw Error('Unclosed ABC decoration.');
     const mark=line.slice(p+1,end),dynamics:Record<string,number>={pppp:1,ppp:2,pp:3,p:5,mp:7,mf:9,f:11,ff:12,fff:14,ffff:15};
     if(dynamics[mark]===undefined){if(!recover)throw Error('Unsupported ABC decoration: '+mark);warnings.add('ABC decoration '+mark+' was omitted; written note timing was retained.');p=end+1;continue;}
     volume=dynamics[mark];warnings.add('ABC dynamics mapped to editor V1–15; game-specific loudness is not reproduced.');p=end+1;continue;
    }
    let tones:Tone[],advance:number;
    if(c==='['){
     p++;tones=[];while(p<line.length&&line[p]!==']'){if(/\s/.test(line[p])){p++;continue;}tones.push(tone());}
     if(line[p]!==']'||!tones.length)throw Error('Empty or unclosed ABC chord.');p++;const scale=length(),tie=line[p]==='-';if(tie)p++;
     for(const t of tones){t.duration*=scale;if(tie&&t.pitch!==null)t.tie=true;}
     if(!game&&tones.some(t=>t.pitch===null))throw Error('Rests inside chords require game ABC metadata (%%lotro-compatible).');
     advance=game?tones.reduce((n,t)=>Math.min(n,t.duration),Infinity):tones[0].duration;
    }else{tones=[tone()];advance=tones[0].duration;}
    if(recover){
     let factor=nextRhythm*(tupletLeft>0?tupletFactor:1);nextRhythm=1;if(tupletLeft>0)tupletLeft--;
     const rhythm=line.slice(p).match(/^\s*(>+|<+)/);if(rhythm){const short=2**(-rhythm[1].length),long=2-short;factor*=rhythm[1][0]==='>'?long:short;nextRhythm=rhythm[1][0]==='>'?short:long;p+=rhythm[0].length;}
     advance*=factor;for(const t of tones)t.duration*=factor;
    }
    const start=rounded(tick),next=new Map<number,Note>();
    if(rounded(tick+advance)<=start&&tones.some(t=>t.pitch===null))warnings.add('Sub-unit ABC rests rounded to zero duration at some positions. Cumulative timing and all musical notes are retained.');
    for(const t of tones){
     if(t.pitch===null)continue;
     let end=rounded(tick+t.duration);if(end<=start){if(!recover)throw Error('ABC note duration is finer than the version-2 timing model can represent.');end=start+1;warnings.add('Sub-unit ABC notes were expanded to one timing unit, retaining every note and the cumulative onset clock. Overlaps may result.');}
     let note=pending.get(t.pitch);
     if(note&&note.start+note.length!==start){if(!recover)throw Error('ABC tie must continue the same adjacent pitch.');warnings.add('Non-adjacent ABC ties were separated into their written notes.');pending.delete(t.pitch);note=undefined;}
     if(note){pending.delete(t.pitch);note.length=end-note.start;if(note.volume!==volume)warnings.add('Volume changes inside ABC ties retain the initial onset volume.');}
     else{note={id:++id,instrument:0,start,length:end-start,pitch:t.pitch,volume};project.notes.push(note);}
     if(t.tie){if(next.has(t.pitch)){if(!recover)throw Error('Ambiguous same-pitch ABC chord ties.');warnings.add('Ambiguous same-pitch ABC ties use the last chord member; other notes were retained.');}next.set(t.pitch,note);}
    }
    if(pending.size){if(!recover)throw Error('ABC tie must continue the same adjacent pitch.');warnings.add('Unmatched ABC ties were left as separate written notes.');}pending=next;tick+=advance;
   }
  }catch(error){
   if(!recover)throw Error(`ABC line ${lineIndex+1}: ${(error as Error).message}`);
   warnings.add(`ABC line ${lineIndex+1}: ${(error as Error).message} The unread remainder of this line was skipped; subsequent music follows the last recovered position. Check timing and missing material.`);
   pending.clear();tupletLeft=0;nextRhythm=1;
   if(!Number.isFinite(tick)||tick>Number.MAX_SAFE_INTEGER)break;
  }
 }
 if(pending.size){if(!recover)throw Error('Unfinished ABC tie.');warnings.add('Unfinished ABC ties retain the last written duration.');}
 if(!project.notes.length)throw Error('No ABC notes could be recovered.'+(recover?' '+[...warnings].join(' '):''));
 const noteCount=project.notes.length;
 for(const [start,tempo] of tempos)project.notes.push({id:++id,instrument:ensureInstructions(project),start,length:1,pitch:60,volume:0,tempo});
 for(const [start,timeSignature] of signatures)project.notes.push({id:++id,instrument:ensureInstructions(project),start,length:1,pitch:60,volume:0,timeSignature});
 const notices=[...warnings];condenseImportInstructions(project,notices);
 if(!valid(project.notes))throw Error('Invalid imported ABC timing or instructions.');
 return {project,noteCount,warnings:notices};
}
