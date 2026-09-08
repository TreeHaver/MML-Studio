import test from 'node:test';
import assert from 'node:assert/strict';
import {state} from '../dist/state.js';
import {loopRegion,loopSpan,looping,snapTick,freeTick,setLoopRegion,clearLoopRegion,toggleLoop,loopEdgeAt,markLoopStart,markLoopEnd} from '../dist/playback/loop-region.js';

test('the loop goes exactly where it is put, and normalizes the drag direction', () => {
  state.project.grid = 4; // quarter notes: 32 ticks a cell
  clearLoopRegion();
  assert.equal(looping(), false);
  assert.equal(freeTick(40.4), 40, 'whole ticks, not cells');
  assert.equal(freeTick(-10), 0, 'a drag off the left edge stops at the start of the piece');

  // Dragging right to left gives the same loop as dragging left to right, off the grid included.
  assert.equal(setLoopRegion(203, 41), true);
  assert.deepEqual([loopRegion.start, loopRegion.end], [41, 203]);
  assert.equal(loopSpan(), 162);
  assert.equal(looping(), true);
});

test('holding the grid modifier pulls both ends onto the current cells', () => {
  state.project.grid = 4;
  assert.equal(snapTick(40), 32);
  assert.equal(snapTick(50), 64);
  assert.equal(setLoopRegion(203, 41, true), true);
  assert.deepEqual([loopRegion.start, loopRegion.end], [32, 192]);

  // The grid follows the project's own setting rather than a fixed size.
  state.project.grid = 2;
  assert.equal(setLoopRegion(41, 203, true), true);
  assert.deepEqual([loopRegion.start, loopRegion.end], [64, 192]);
  state.project.grid = 4;
});

test('a loop with both ends on one tick clears instead of repeating nothing', () => {
  state.project.grid = 4;
  assert.equal(setLoopRegion(0, 320), true);
  assert.equal(setLoopRegion(41, 41), false);
  assert.equal(loopSpan(), 0);
  assert.equal(looping(), false);
  // A single tick is a real, if tiny, loop: the freedom is the point.
  assert.equal(setLoopRegion(41, 42), true);
  assert.equal(loopSpan(), 1);
});

test('switching the loop off keeps the stretch marked, so it can come back unchanged', () => {
  state.project.grid = 4;
  setLoopRegion(70, 260);
  assert.equal(toggleLoop(), false);
  assert.equal(looping(), false);
  assert.deepEqual([loopRegion.start, loopRegion.end], [70, 260], 'the marks survive being switched off');
  assert.equal(toggleLoop(), true);
  assert.equal(looping(), true);
  clearLoopRegion();
  assert.equal(toggleLoop(), false, 'with nothing marked there is nothing to switch on');
});

test('the ends are grabbable within a tolerance, and the nearer one wins', () => {
  state.project.grid = 4;
  clearLoopRegion();
  assert.equal(loopEdgeAt(64, 8), null, 'no loop, nothing to grab');
  setLoopRegion(70, 260);
  assert.equal(loopEdgeAt(72, 8), 'start');
  assert.equal(loopEdgeAt(256, 8), 'end');
  assert.equal(loopEdgeAt(160, 8), null, 'the middle of the loop is not an end');
  assert.equal(loopEdgeAt(160, 200), 'start', 'a tolerance that covers both takes the nearer end');
  clearLoopRegion();
});

test('B and N trim the loop at the playhead, exactly there, and never leave it empty', () => {
  state.project.grid = 4;
  clearLoopRegion();
  // With no loop yet, marking a start takes the end of the music as the far end.
  markLoopStart(97, 500);
  assert.deepEqual([loopRegion.start, loopRegion.end], [97, 500], 'no rounding to the grid');
  markLoopEnd(223);
  assert.deepEqual([loopRegion.start, loopRegion.end], [97, 223], 'the end moves, the start stays');
  markLoopStart(160, 500);
  assert.deepEqual([loopRegion.start, loopRegion.end], [160, 223], 'the start moves, the end stays');

  // Marking a start beyond the existing end reaches past it rather than clearing the loop.
  markLoopStart(321, 0);
  assert.deepEqual([loopRegion.start, loopRegion.end], [321, 449]);
  clearLoopRegion();
  markLoopEnd(97);
  assert.deepEqual([loopRegion.start, loopRegion.end], [0, 97], 'an end with no start reaches back a measure, floored at the beginning');
  clearLoopRegion();
});
