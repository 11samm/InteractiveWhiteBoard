export type AnnotationAction =
  | { type: 'note' | 'text'; text: string; x: number; y: number }
  | { type: 'arrow'; from: { x: number; y: number }; to: { x: number; y: number }; label: string; dash?: 'solid' | 'dashed' | 'dotted'; targetNoteIndex?: number }
  | { type: 'highlight'; x: number; y: number; w: number; h: number };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function keys(value: Record<string, unknown>, expected: string[]): boolean {
  return Object.keys(value).every((key) => expected.includes(key));
}

function coordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function point(value: unknown): value is { x: number; y: number } {
  return record(value) && keys(value, ['x', 'y']) && coordinate(value.x) && coordinate(value.y);
}

/** Accept only the four bounded shape intents our client knows how to apply. */
export function parseAnnotationPlan(value: unknown): AnnotationAction[] {
  if (!record(value) || !keys(value, ['actions']) || !Array.isArray(value.actions) || value.actions.length > 4) {
    throw new Error('Invalid annotation plan');
  }

  const actions: AnnotationAction[] = value.actions.map((item: unknown) => {
    if (!record(item)) throw new Error('Invalid annotation action');

    if (item.type === 'note' || item.type === 'text') {
      if (!keys(item, ['type', 'text', 'x', 'y']) || !text(item.text, 240)
        || !coordinate(item.x) || !coordinate(item.y)) {
        throw new Error('Invalid annotation text');
      }
      return { type: item.type, text: item.text.trim(), x: item.x, y: item.y };
    }

    if (item.type === 'arrow') {
      if (!keys(item, ['type', 'from', 'to', 'label', 'dash', 'targetNoteIndex']) || !point(item.from) || !point(item.to)
        || !text(item.label, 80) || (item.dash !== undefined && !['solid', 'dashed', 'dotted'].includes(item.dash as string))
        || (item.targetNoteIndex !== undefined && (!Number.isInteger(item.targetNoteIndex) || (item.targetNoteIndex as number) < 0 || (item.targetNoteIndex as number) > 3))
        || Math.hypot(item.to.x - item.from.x, item.to.y - item.from.y) < 0.02) {
        throw new Error('Invalid annotation arrow');
      }
      return { type: 'arrow', from: item.from, to: item.to, label: item.label.trim(),
        ...(item.dash === undefined ? {} : { dash: item.dash as 'solid' | 'dashed' | 'dotted' }),
        ...(item.targetNoteIndex === undefined ? {} : { targetNoteIndex: item.targetNoteIndex as number }),
      };
    }

    if (item.type === 'highlight') {
      if (!keys(item, ['type', 'x', 'y', 'w', 'h']) || !coordinate(item.x) || !coordinate(item.y)
        || !coordinate(item.w) || !coordinate(item.h) || item.w < 0.02 || item.h < 0.02
        || item.x + item.w > 1 || item.y + item.h > 1) {
        throw new Error('Invalid annotation highlight');
      }
      return { type: 'highlight', x: item.x, y: item.y, w: item.w, h: item.h };
    }

    throw new Error('Unsupported annotation action');
  });
  const noteCount = actions.filter((action) => action.type === 'note').length;
  if (actions.some((action) => action.type === 'arrow' && action.targetNoteIndex !== undefined && action.targetNoteIndex >= noteCount)) {
    throw new Error('Invalid annotation arrow target');
  }
  return actions;
}

/** The main takeaway note is first in PDF summary plans; anchor its arrow there. */
export function anchorPdfTakeawayArrows(actions: AnnotationAction[], instruction: string): AnnotationAction[] {
  if (!/\b(pdf|document|slides?)\b/i.test(instruction)
    || !/\b(most important|main takeaway|key takeaway|main point)\b/i.test(instruction)
    || !actions.some((action) => action.type === 'note')) return actions;
  return actions.map((action) => action.type === 'arrow' ? { ...action, targetNoteIndex: 0 } : action);
}
