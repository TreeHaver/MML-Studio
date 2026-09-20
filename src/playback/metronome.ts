import type {Project} from '../model/types.ts';
import type {TempoEvent} from '../music/tempo.ts';
import {secondsAtTick} from '../music/tempo.ts';
import {measureLines} from '../music/structure.ts';

/**
 * A click on every beat while the piece plays, louder on the first beat of the bar.
 *
 * The beats are not invented here: the editor already works out where every bar line and
 * beat falls, time signature changes and measure resets included, because it draws them.
 * The same list is reused, so the click always agrees with what is on screen.
 *
 * Session only, like playback speed and volume beside it: a metronome that came back on by
 * itself at the next launch would be a surprise, not a preference.
 */
export const metronome={on:false,volume:.5,scheduled:0};

export type Beat={time:number,major:boolean};
/**
 * Every beat of the performance, as seconds from its start. The compiled performance is
 * used rather than the written project, since loops are already unrolled in it: a repeated
 * bar is heard twice and must be counted twice.
 */
export function metronomeBeats(project:Project,map:TempoEvent[],end:number):Beat[]{
 if(!(end>0))return [];
 // Up to the end, not through it: a beat landing exactly where the piece stops has nothing
 // left to count.
 return measureLines(project,0,end).map(line=>({time:secondsAtTick(map,line.tick),major:line.major}));
}
/** The first beat at or after a moment, for picking up again after a seek or a loop wrap. */
export function beatIndexAt(beats:Beat[],time:number){
 let low=0,high=beats.length;
 while(low<high){const middle=(low+high)>>1;if(beats[middle].time<time)low=middle+1;else high=middle;}
 return low;
}

let beats:Beat[]=[],cursor=0,lastHeard=-1;
const pending=new Set<OscillatorNode>();
/** Half a second of clicks is prepared in advance, which is what keeps them steady. */
const LOOKAHEAD=.25;

export function setMetronomeBeats(next:Beat[]){beats=next;cursor=0;lastHeard=-1;}
/** Silence anything already scheduled: after a seek those clicks belong to a moment that is no longer coming. */
export function clearMetronome(){
 for(const osc of pending){try{osc.stop();}catch{}}
 pending.clear();cursor=0;lastHeard=-1;
}
function click(context:AudioContext,when:number,major:boolean){
 const level=metronome.volume*(major?.5:.32);
 if(level<=0)return;
 const osc=context.createOscillator(),gain=context.createGain();
 osc.type='sine';osc.frequency.value=major?1600:1050;
 // A square-edged burst pops; the level is ramped rather than switched.
 gain.gain.setValueAtTime(.0001,when);
 gain.gain.exponentialRampToValueAtTime(level,when+.002);
 gain.gain.exponentialRampToValueAtTime(.0001,when+(major?.07:.05));
 osc.connect(gain);gain.connect(context.destination);
 osc.start(when);osc.stop(when+.09);
 pending.add(osc);osc.onended=()=>{pending.delete(osc);gain.disconnect();};
 metronome.scheduled++;
}
/**
 * Called from the same timer that keeps the rehearsal loop honest, for the same reason: a
 * window behind another application stops being painted, and a metronome that stopped
 * ticking whenever the editor lost focus would be useless.
 *
 * `heard` is the sequencer's own clock. It jumps backwards when a loop wraps and forwards
 * on a seek, so a jump means the prepared clicks are wrong and the list is picked up again
 * from the new position.
 */
export function scheduleMetronome(context:AudioContext,heard:number,speed:number){
 if(!metronome.on||!beats.length)return;
 if(lastHeard<0||heard<lastHeard-.05||heard>lastHeard+1){clearMetronome();cursor=beatIndexAt(beats,heard);}
 lastHeard=heard;
 while(cursor<beats.length&&beats[cursor].time<heard+LOOKAHEAD){
  const beat=beats[cursor++];
  // The sequencer plays a slowed or hurried performance, so a beat one second away in the
  // music is not one second away on the clock the audio is scheduled against.
  click(context,context.currentTime+Math.max(0,(beat.time-heard)/speed),beat.major);
 }
}
