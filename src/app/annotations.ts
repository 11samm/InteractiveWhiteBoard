import { createShapeId, toRichText, type Editor } from 'tldraw';
import type { AnnotationAction } from '../../shared/annotationSchema';
import { arrowStartAwayFromNote } from '../../shared/annotationGeometry';

export interface AnnotationContext {
  boardImage?: string;
  bounds: { x: number; y: number; w: number; h: number };
  selected: boolean;
}

/** The exported image and its page-space bounds must be captured together. */
export async function captureAnnotationContext(editor: Editor): Promise<AnnotationContext> {
  const selectedIds = editor.getSelectedShapeIds();
  const selected = selectedIds.length > 0;
  const ids = selected ? selectedIds : [...editor.getCurrentPageShapeIds()];
  const bounds = (selected ? editor.getSelectionPageBounds() : editor.getCurrentPageBounds())
    ?? editor.getViewportPageBounds();
  let boardImage: string | undefined;
  if (ids.length > 0) {
    try {
      const { url } = await editor.toImageDataUrl(ids, {
        format: 'png', background: true, padding: 0, pixelRatio: 1,
      });
      boardImage = url.split(',', 2)[1];
    } catch {
      // A proposal can still be generated from the student's instruction.
    }
  }
  return { boardImage, bounds: { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h }, selected };
}

export function applyAnnotations(editor: Editor, actions: AnnotationAction[], bounds: AnnotationContext['bounds']): void {
  if (editor.getIsReadonly() || actions.length === 0) return;
  // createShapeId works on plain LAN HTTP, where crypto.randomUUID is unavailable.
  const batchId = createShapeId();
  const meta = { createdBy: 'AI tutor', aiBatchId: batchId };
  const pageX = (x: number) => bounds.x + x * bounds.w;
  const pageY = (y: number) => bounds.y + y * bounds.h;
  const noteColors = ['light-blue', 'light-green', 'orange', 'light-violet'] as const;
  let noteCount = editor.getCurrentPageShapes().filter((shape) =>
    shape.meta.createdBy === 'AI tutor' && (shape.type === 'note' || shape.meta.annotationType === 'note')
  ).length;
  const newNotes: { id: ReturnType<typeof createShapeId>; x: number; y: number; w: number; h: number }[] = [];

  const mark = editor.markHistoryStoppingPoint('before AI annotations');
  try {
    editor.run(() => {
      for (const action of actions) {
        if (action.type === 'note') {
          // Geo rectangles can be wider than tldraw's fixed 200 px sticky notes.
          const lines = action.text.split('\n').reduce((count, paragraph) => count + Math.max(1, Math.ceil(paragraph.length / 36)), 0);
          const note = { id: createShapeId(), x: pageX(action.x), y: pageY(action.y), w: 340, h: Math.max(112, 58 + lines * 24) };
          newNotes.push(note);
          editor.createShape({
            id: note.id, type: 'geo', x: note.x, y: note.y,
            meta: { ...meta, annotationType: 'note' },
            props: {
              geo: 'rectangle', w: note.w, h: note.h,
              color: noteColors[noteCount++ % noteColors.length], fill: 'solid', dash: 'solid',
              size: 's', font: 'sans', align: 'start', verticalAlign: 'start',
              richText: toRichText(`✦  ${action.text}`),
            },
          });
        } else if (action.type === 'text') {
          editor.createShape({
            id: createShapeId(), type: 'text', x: pageX(action.x), y: pageY(action.y), meta,
            props: { color: 'violet', size: 's', font: 'sans', w: 300, richText: toRichText(`✦  ${action.text}`) },
          });
        } else if (action.type === 'highlight') {
          const x = pageX(action.x);
          const y = pageY(action.y);
          editor.createShape({
            id: createShapeId(), type: 'geo', x, y, meta: { ...meta, annotationType: 'highlight' }, opacity: 0.25,
            props: { geo: 'rectangle', color: 'yellow', fill: 'fill', dash: 'solid', w: Math.max(16, action.w * bounds.w), h: Math.max(16, action.h * bounds.h) },
          });
        }
      }
      // Create arrows after notes, so a referenced note exists even when the
      // model listed its arrow first. The binding keeps the tip on the note.
      for (const action of actions) {
        if (action.type !== 'arrow') continue;
        const target = action.targetNoteIndex === undefined ? undefined : newNotes[action.targetNoteIndex];
        const rawFrom = { x: pageX(action.from.x), y: pageY(action.from.y) };
        const rawTo = { x: pageX(action.to.x), y: pageY(action.to.y) };
        const start = target ? arrowStartAwayFromNote(rawFrom, rawTo, target) : rawFrom;
        const end = target ? { x: target.x + target.w / 2, y: target.y + target.h / 2 } : rawTo;
        const id = createShapeId();
        editor.createShape({
          id, type: 'arrow', x: start.x, y: start.y, meta,
          props: {
            color: 'violet', dash: action.dash ?? 'solid',
            start: { x: 0, y: 0 }, end: { x: end.x - start.x, y: end.y - start.y },
            size: 's', font: 'sans', richText: toRichText(`✦  ${action.label}`),
          },
        });
        if (target) editor.createBindings([{ type: 'arrow', fromId: id, toId: target.id,
          props: { terminal: 'end', normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false },
        }]);
      }
    });
  } catch (err) {
    editor.bailToMark(mark);
    throw err;
  }
  editor.squashToMark(mark);
  editor.markHistoryStoppingPoint('after AI annotations');
}
