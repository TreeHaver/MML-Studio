import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pitchHeight,pitchTop,pitchAtY} from '../dist/music/pitch-layout.js';
test('sharp rows use 75% height with contiguous boundaries and exact inverse hit coordinates',()=>{
 assert.equal(pitchHeight(60),20);assert.equal(pitchHeight(61),15);
 for(const top of [-13,0,60,127,160])for(let pitch=-40;pitch<=180;pitch++){
  const y=pitchTop(top,pitch),height=pitchHeight(pitch);
  assert.equal(pitchTop(top,pitch-1),y+height);
  assert.equal(pitchAtY(top,y),pitch);
  assert.equal(pitchAtY(top,y+height/2),pitch);
  assert.equal(pitchAtY(top,y+height-.01),pitch);
  assert.equal(pitchAtY(top,y+height),pitch-1);
  assert.equal(pitchTop(top,pitch-12)-y,215);
 }
});
