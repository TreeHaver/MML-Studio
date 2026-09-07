import {fresh,colors} from '../model/project.ts';
import {ensureInstructions} from '../model/instructions.ts';
import {valid} from '../model/validation.ts';
import type {Note} from '../model/types.ts';

const strip=(s:string)=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\r\n]*/g,'');
/** Strict common MML dialect. Unknown commands fail rather than dropping music. */
export function importMml(text:string,name='MML'){
 const project=fresh();project.instruments=[];
 const warnings=new Set<string>(),tempos=new Map<number,number>();let id=0,span=0;
 const parts:{name:string,channels:string[],program?:number}[]=[];
 text=text.replace(/^\uFEFF/,'').trim();
 if(/^\s*(?:<\?xml|<ms2\b)/i.test(text)){
  const xml=text.replace(/^<\?xml[^?]*\?>\s*/i,'').replace(/<!--[\s\S]*?-->/g,'');
  if(!/^<ms2\s*>[\s\S]*<\/ms2>\s*$/i.test(xml))throw Error('Invalid MS2MML XML.');
  let body=xml.replace(/^<ms2\s*>/i,'').replace(/<\/ms2>\s*$/i,'');const channels:string[]=[];
  body=body.replace(/<(melody|chord)(?:\s+index="\d+")?\s*>([\s\S]*?)<\/\1>/gi,(_,tag,content)=>{
   channels.push(content.replace(/<!\[CDATA\[([\s\S]*?)\]\]>|&(?:amp|lt|gt|quot|apos);/g,(token:string,cdata:string)=>cdata!==undefined?cdata:({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[token]!)));return '';

  });
  if(body.trim()||!channels.length)throw Error('Invalid or unsupported MS2MML XML elements.');
  parts.push({name,channels});
 }else if(/^\/\/\s*FORMAT:\s*MNE/im.test(text)){
  const blocks=text.split(/(?=^\/\/\s*PART\s+\d+\s+NAME:)/im).slice(1);
  for(const block of blocks){
   const label=block.match(/^\/\/\s*PART\s+\d+\s+NAME:\s*(.*)$/im)?.[1]?.trim()||name;
   const program=Number(block.match(/^\/\/\s*PART\s+\d+\s+INSTRUMENT:\s*(\d+)/im)?.[1]??0);
   if(program>127)throw Error('Unsupported MNE instrument '+program);
   parts.push({name:label,program,channels:wrapped(strip(block))});
  }
  warnings.add('MNE names and GM instruments imported. Editor metadata (mute, pan, volume, delays, song and beat settings) is not represented; MML commands determine timing and volume.');
 }else if(/^\[Settings\]/im.test(text)||/^\[Channel\d+\]/im.test(text)){
  const sections=[...text.matchAll(/^\[([^\]]+)\]\s*\r?\n([\s\S]*?)(?=^\[|$(?![\s\S]))/gm)];
  for(const section of sections){const number=section[1].match(/^Channel(\d+)$/i)?.[1];if(!number)continue;
   const label=text.match(new RegExp('^TrackName'+number+'\\s*=\\s*(.*)$','im'))?.[1]?.trim()||'Channel '+number;
   parts.push({name:label,channels:[strip(section[2]).trim()]});
  }
  warnings.add('3MLE channel names imported; editor settings and instrument assignments are not represented.');
 }else parts.push({name,channels:wrapped(strip(text))});
 if(!parts.length)throw Error('No MML parts found.');
 for(const part of parts){
  const instrument=project.instruments.length;
  project.instruments.push({name:part.name,color:colors[instrument%colors.length],midiProgram:part.program??0});
  for(const raw of part.channels){
   const s=strip(raw).replace(/\s/g,'').toLowerCase();let p=0,tick=0,octave=4,volume=8,defaultLength=32,tie=false,last:Note|undefined;
   const number=(required=false)=>{const m=s.slice(p).match(/^\d+/);if(!m){if(required)throw Error('Expected number at '+p);return undefined;}p+=m[0].length;const n=Number(m[0]);if(!Number.isSafeInteger(n))throw Error('Number exceeds timing precision.');return n;};
   const length=()=>{const d=number();if(d===0)throw Error('Length denominator must be positive.');let n=d===undefined?defaultLength:128/d,extra=n/2;while(s[p]==='.'){n+=extra;extra/=2;p++;}return n;};
   while(p<s.length){const c=s[p++];
    if(c==='o'){const sign=s[p]==='-'?(p++,-1):1;octave=sign*number(true)!;continue;}
    if(c==='<'||c==='>'){octave+=c==='>'?1:-1;continue;}
    if(c==='l'){if(!/\d/.test(s[p]??''))throw Error('L needs a length.');defaultLength=length();continue;}
    if(c==='v'){volume=number(true)!;if(volume>15)throw Error('Volume outside model range 0–15.');continue;}
    if(c==='t'){const bpm=number(true)!;if(bpm<1)throw Error('Tempo must be a positive integer.');const at=Math.round(tick);if(tempos.has(at)&&tempos.get(at)!==bpm)throw Error('Conflicting global tempos at '+at);tempos.set(at,bpm);continue;}
    if(c==='&'){if(tie||!last)throw Error('Invalid tie.');tie=true;continue;}
    if(!'cdefgabnr'.includes(c))throw Error('Unsupported MML token '+JSON.stringify(c)+' at '+(p-1));
    let pitch=c==='n'?number(true)!:(octave+1)*12+({c:0,d:2,e:4,f:5,g:7,a:9,b:11}[c]??0);
    if(c!=='n'&&c!=='r'&&['+','#','-'].includes(s[p]))pitch+=s[p++]==='-'?-1:1;
    const duration=c==='n'?defaultLength:length(),start=Math.round(tick),end=Math.round(tick+duration);
    if(!Number.isSafeInteger(end)||end<=start)throw Error('Duration is finer than the version-2 timing model can represent.');
    if(Math.abs(tick-start)>1e-7||Math.abs(tick+duration-end)>1e-7)warnings.add('Fractional timing rounded to the nearest 1/128 whole-note unit; no grid snapping applied.');
    if(c==='r'){if(tie)throw Error('Cannot tie a rest.');last=undefined;}
    else if(tie){if(!last||last.pitch!==pitch||last.start+last.length!==start)throw Error('Tie must continue the same adjacent pitch.');if(last.volume!==volume)warnings.add('Volume changes inside tied notes cannot be represented and retain the initial note volume.');last.length=end-last.start;tie=false;}
    else{last={id:++id,instrument,start,length:end-start,pitch,volume};project.notes.push(last);}
    tick+=duration;
   }
   if(tie)throw Error('Unfinished tie.');span=Math.max(span,Math.round(tick));
  }
 }
 if(!project.notes.length&&!tempos.size)throw Error('No notes or tempo instructions found.');
 for(const [start,tempo] of tempos){const note=project.notes.find(n=>n.start===start);if(note)note.tempo=tempo;else project.notes.push({id:++id,instrument:ensureInstructions(project),start,length:1,pitch:60,volume:0,tempo});}
 const volumes=new Map<string,number>();
 for(const n of project.notes){if(project.instruments[n.instrument].isInstructions)continue;const key=n.instrument+':'+n.start;const prior=volumes.get(key);if(prior!==undefined&&prior!==n.volume)warnings.add('Simultaneous channels have different volumes. Notes retain explicit volumes, but this model resolves one volume per instrument/position for playback and export.');volumes.set(key,n.volume!);}
 if(!valid(project.notes))throw Error('Invalid imported timing or tempo.');
 return {project,warnings:[...warnings],noteCount:project.notes.filter(n=>!project.instruments[n.instrument].isInstructions).length,span};
}
function wrapped(text:string):string[]{
 const s=text.trim();if(/^mml@/i.test(s)){if(!s.endsWith(';'))throw Error('MML@ must end with a semicolon.');return s.slice(4,-1).split(',');}
 return s.replace(/;\s*$/,'').split(',');
}
