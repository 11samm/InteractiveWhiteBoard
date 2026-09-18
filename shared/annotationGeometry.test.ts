import assert from 'node:assert/strict';
import test from 'node:test';
import { arrowStartAwayFromNote } from './annotationGeometry';

test('reverses an arrow that starts at the note and points into empty space', () => {
  const note = { x: 50, y: 120, w: 340, h: 220 };
  assert.deepEqual(
    arrowStartAwayFromNote({ x: 400, y: 125 }, { x: 640, y: 125 }, note),
    { x: 640, y: 125 },
  );
});

test('keeps the tail outside the note when both proposed points are too close', () => {
  const note = { x: 50, y: 120, w: 340, h: 220 };
  assert.deepEqual(
    arrowStartAwayFromNote({ x: 370, y: 140 }, { x: 400, y: 140 }, note),
    { x: 570, y: 230 },
  );
});
