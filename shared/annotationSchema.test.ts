import assert from 'node:assert/strict';
import test from 'node:test';
import { anchorPdfTakeawayArrows, parseAnnotationPlan } from './annotationSchema';

test('accepts the supported bounded actions', () => {
  assert.equal(parseAnnotationPlan({ actions: [
    { type: 'note', text: 'Explain the result', x: 0.2, y: 0.3 },
    { type: 'arrow', from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, label: 'points to result', dash: 'dotted' },
    { type: 'highlight', x: 0.1, y: 0.2, w: 0.4, h: 0.2 },
  ] }).length, 3);
});

test('rejects unsupported, unbounded, and extra model output', () => {
  const invalid = [
    { actions: [{ type: 'delete', id: 'shape:other' }] },
    { actions: [{ type: 'note', text: 'x', x: 20, y: 0 }] },
    { actions: [{ type: 'note', text: 'x', x: 0, y: 0, command: 'undo' }] },
    { actions: [{ type: 'note', text: 'x'.repeat(241), x: 0, y: 0 }] },
    { actions: [{ type: 'highlight', x: 0.9, y: 0.2, w: 0.3, h: 0.2 }] },
    { actions: [{ type: 'arrow', from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, label: 'x', dash: 'striped' }] },
    { actions: [{ type: 'arrow', from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, label: 'x', targetNoteIndex: 0 }] },
    { actions: Array.from({ length: 5 }, () => ({ type: 'text', text: 'x', x: 0, y: 0 })) },
  ];
  for (const plan of invalid) assert.throws(() => parseAnnotationPlan(plan));
});

test('anchors a PDF main-takeaway arrow to its first new note', () => {
  const actions = parseAnnotationPlan({ actions: [
    { type: 'note', text: 'Key takeaway', x: 0.1, y: 0.1 },
    { type: 'arrow', from: { x: 0.2, y: 0.1 }, to: { x: 0.8, y: 0.1 }, label: 'most important', dash: 'dotted' },
  ] });
  const anchored = anchorPdfTakeawayArrows(actions, 'Point a dotted arrow to the most important part of the PDF');
  assert.equal(anchored[1].type, 'arrow');
  if (anchored[1].type === 'arrow') assert.equal(anchored[1].targetNoteIndex, 0);
});
