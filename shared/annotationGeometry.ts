export interface PagePoint { x: number; y: number }
export interface PageBox extends PagePoint { w: number; h: number }

/** Keep the tail outside a new note even if the model reversed the arrow. */
export function arrowStartAwayFromNote(from: PagePoint, to: PagePoint, note: PageBox): PagePoint {
  const distance = (point: PagePoint) => Math.hypot(
    point.x - Math.max(note.x, Math.min(point.x, note.x + note.w)),
    point.y - Math.max(note.y, Math.min(point.y, note.y + note.h)),
  );
  const start = distance(from) >= distance(to) ? from : to;
  if (distance(start) >= 80) return start;
  return { x: note.x + note.w + 180, y: note.y + note.h / 2 };
}
