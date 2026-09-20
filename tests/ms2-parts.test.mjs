import test from 'node:test';
import assert from 'node:assert/strict';
import {partName,partsSummary} from '../dist/music/ms2-parts.js';

// The names are the ones MapleStory 2 puts on its own tabs, so a part copied out of the
// editor lands in the tab it is named after.
test('the first part is the melody and the next nine are Harmony A to I', ()=>{
 assert.deepEqual([...Array(10).keys()].map(partName),
  ['Melody','Harmony A','Harmony B','Harmony C','Harmony D','Harmony E','Harmony F','Harmony G','Harmony H','Harmony I']);
});

test('past the tenth there is no tab in the game to name, so the numbering carries on', ()=>{
 assert.equal(partName(10),'Channel 11');
 assert.equal(partName(11),'Channel 12');
});

test('the count reads the way the game states it', ()=>{
 assert.equal(partsSummary(0),'no parts yet');
 assert.equal(partsSummary(1),'1 melody and no harmonies');
 assert.equal(partsSummary(2),'1 melody and 1 harmony');
 assert.equal(partsSummary(10),'1 melody and 9 harmonies');
 assert.equal(partsSummary(11),'1 melody and 10 harmonies','one too many is still stated plainly');
});
