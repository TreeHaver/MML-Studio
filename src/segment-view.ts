import {state,instrumentView} from './state.ts';
import {$,view,ctx,status} from './dom.ts';
import {playback,stopPlayback,seekToTick} from './playback/transport.ts';
import {rangeAt,sectionMarkers,type SegmentRange} from './model/segment-view.ts';
import {enterSegment,fullProject,resetSegment} from './segment-session.ts';
import {refresh} from './commands.ts';
import {setPastePosition} from './note-clipboard.ts';
import {KEY,HEAD} from './constants.ts';

export function refreshSegmentControls(){
 const session=state.segment,markers=sectionMarkers(state.project),tick=playback.tick??0;
 const lastEnd=session?session.projection.range.end-session.projection.range.start:undefined;
 const songs=markers.some(m=>m.song),segments=markers.some(m=>!m.song);
 $('open-song').hidden=!!session||!songs;
 $('open-segment').hidden=session?.projection.range.kind==='segment'||!segments;
 ($('open-song') as HTMLButtonElement).disabled=!!state.gesture||!rangeAt(state.project,tick,'song',lastEnd);
 ($('open-segment') as HTMLButtonElement).disabled=!!state.gesture||!rangeAt(state.project,tick,'segment',lastEnd);
 $('segment-view-label').hidden=!session;$('return-project').hidden=!session;
 $('segment-view-label').textContent=session?`${session.projection.range.kind==='song'?'Song':'Segment'}: ${session.projection.range.name}`:'';
 ($('export-sections') as HTMLInputElement).disabled=!!session;
}
function clearSelection(){state.selection.clear();state.gesture=null;($('section-nav') as HTMLSelectElement).value='';instrumentView.mmlEpoch++;setPastePosition(0);}
export function openSegmentView(kind:SegmentRange['kind']){
 if(state.gesture)return;
 try{
  const root=fullProject(),tick=(state.segment?.projection.range.start??0)+(playback.tick??0),range=rangeAt(root,tick,kind);
  if(!range){status(`Place the playhead inside a ${kind} first.`);return;}
  stopPlayback(false);enterSegment(root,range);clearSelection();view.scrollLeft=0;refresh();seekToTick(0);
  status(`${kind==='song'?'Song':'Segment'} view: ${range.name}. Edits update the project; boundary-crossing notes change only inside this view.`);
 }catch(error){status('Could not open view: '+error);}
}
export function returnToProject(){
 if(!state.segment||state.gesture)return;
 try{const tick=state.segment.projection.range.start+(playback.tick??0),root=fullProject();stopPlayback(false);resetSegment();state.project=root;clearSelection();refresh();seekToTick(tick);view.scrollLeft=tick*state.zoom;status('Returned to the full project.');}
 catch(error){status('Could not return to project: '+error);}
}
export function drawSegmentBoundary(){
 if(!state.segment)return;
 const duration=state.segment.projection.range.end-state.segment.projection.range.start,x=KEY+duration*state.zoom-view.scrollLeft;
 if(x>state.width)return;
 ctx.save();ctx.beginPath();ctx.rect(KEY,HEAD,state.width-KEY,state.height-HEAD);ctx.clip();ctx.fillStyle='#66778835';ctx.fillRect(Math.max(KEY,x),HEAD,state.width-Math.max(KEY,x),state.height-HEAD);ctx.fillStyle='#718096';ctx.fillRect(x,HEAD,2,state.height-HEAD);ctx.font='11px Segoe UI';ctx.textBaseline='top';ctx.fillText('End of '+state.segment.projection.range.kind,x+5,HEAD+5);ctx.restore();
}
export function installSegmentView(){
 $('open-song').onclick=()=>openSegmentView('song');$('open-segment').onclick=()=>openSegmentView('segment');$('return-project').onclick=()=>returnToProject();
}
