import {
  Box,
  StateNode,
  pointInPolygon,
  type TLKeyboardEventInfo,
  type TLPointerEventInfo,
  type TLShapeId,
  type TLStateNodeConstructor,
} from 'tldraw';

// `isAccelKey` isn't re-exported from the `tldraw` package's public types,
// only from the underlying `@tldraw/editor`. Mirror its (trivial) logic here
// instead of reaching into a transitive dependency.
function isAccelKey(info: { ctrlKey: boolean; metaKey: boolean }): boolean {
  return info.ctrlKey || info.metaKey;
}
import { getEraserRadius } from './eraserSize';

/**
 * A drop-in replacement for tldraw's default EraserTool that uses an
 * adjustable radius (driven by the "Size" picker in our style panel) instead
 * of the fixed, tiny hit-test margin tldraw uses by default. Registering a
 * tool with id "eraser" via the `tools` prop replaces the built-in one.
 */
export class CustomEraserTool extends StateNode {
  static override id = 'eraser';
  static override initial = 'idle';
  static override isLockable = false;
  static override children(): TLStateNodeConstructor[] {
    return [EraserIdle, EraserPointing, EraserErasing];
  }

  info = {} as { onInteractionEnd?: string };

  override onEnter(info: { onInteractionEnd?: string } = {}) {
    this.info = info;
    if (info.onInteractionEnd) {
      this.setCurrentToolIdMask(info.onInteractionEnd);
    }
    this.editor.setCursor({ type: 'cross', rotation: 0 });
  }

  override onExit() {
    this.setCurrentToolIdMask(undefined);
    this.info = {};
  }

  maybeReturnToOriginatingTool() {
    const { onInteractionEnd } = this.info;
    if (!onInteractionEnd) return;
    this.editor.setCurrentTool(onInteractionEnd);
  }
}

class EraserIdle extends StateNode {
  static override id = 'idle';

  override onEnter(info?: TLPointerEventInfo) {
    if (!(info?.accelKey ?? this.editor.inputs.getAccelKey())) {
      (this.parent as CustomEraserTool).maybeReturnToOriginatingTool();
    }
  }

  override onKeyUp(info: TLKeyboardEventInfo) {
    if (!isAccelKey(info)) {
      (this.parent as CustomEraserTool).maybeReturnToOriginatingTool();
    }
  }

  override onPointerDown(info: TLPointerEventInfo) {
    this.parent.transition('pointing', info);
  }

  override onCancel() {
    const onInteractionEnd = (this.parent as CustomEraserTool).info.onInteractionEnd;
    this.editor.setCurrentTool(onInteractionEnd ?? 'select');
  }
}

class EraserPointing extends StateNode {
  static override id = 'pointing';

  override onEnter(info: TLPointerEventInfo) {
    const onlyEraseTopShape = info.accelKey;
    const currentPageShapesSorted = this.editor.getCurrentPageRenderingShapesSorted();
    const currentPagePoint = this.editor.inputs.getCurrentPagePoint();

    const erasing = new Set<TLShapeId>();
    const initialSize = erasing.size;

    for (let n = currentPageShapesSorted.length, i = n - 1; i >= 0; i--) {
      const shape = currentPageShapesSorted[i];
      if (this.editor.isShapeOrAncestorLocked(shape) || this.editor.isShapeOfType(shape, 'group')) {
        continue;
      }

      if (
        this.editor.isPointInShape(shape, currentPagePoint, {
          hitInside: false,
          margin: getEraserRadius(),
        })
      ) {
        const hitShape = this.editor.getOutermostSelectableShape(shape);
        if (this.editor.isShapeFrameLike(hitShape) && erasing.size > initialSize) {
          break;
        }

        erasing.add(hitShape.id);

        if (onlyEraseTopShape) break;
      }
    }

    this.editor.setErasingShapes([...erasing]);
  }

  override onLongPress(info: TLPointerEventInfo) {
    if (info.accelKey) return;
    this.startErasing(info);
  }

  override onExit(_info: unknown, to: string) {
    if (to !== 'erasing') {
      this.editor.setErasingShapes([]);
    }
  }

  override onPointerMove(info: TLPointerEventInfo) {
    if (this.editor.inputs.getIsDragging()) {
      this.startErasing(info);
    }
  }

  override onPointerUp(info: TLPointerEventInfo) {
    this.complete(info);
  }

  override onCancel() {
    this.cancel();
  }

  override onComplete() {
    this.complete();
  }

  override onInterrupt() {
    this.cancel();
  }

  private startErasing(info: TLPointerEventInfo) {
    this.parent.transition('erasing', info);
  }

  complete(info?: TLPointerEventInfo) {
    const erasingShapeIds = this.editor.getErasingShapeIds();

    if (erasingShapeIds.length) {
      this.editor.markHistoryStoppingPoint('erase end');
      this.editor.deleteShapes(erasingShapeIds);
    }

    this.parent.transition('idle', info);
  }

  cancel() {
    this.parent.transition('idle');
  }
}

class EraserErasing extends StateNode {
  static override id = 'erasing';
  static override trackPerformance = true;

  private info = {} as TLPointerEventInfo;
  private scribbleId = 'id';
  private markId = '';
  private excludedShapeIds = new Set<TLShapeId>();

  _erasingShapeIds: TLShapeId[] = [];

  override onEnter(info: TLPointerEventInfo) {
    this.markId = this.editor.markHistoryStoppingPoint('erase scribble begin');
    this.info = info;

    const originPagePoint = this.editor.inputs.getOriginPagePoint();
    const pressedShapeIds = new Set(this.editor.getErasingShapeIds());
    this.excludedShapeIds = new Set(
      this.editor
        .getCurrentPageShapes()
        .filter((shape) => {
          if (this.editor.isShapeOrAncestorLocked(shape)) return true;
          if (this.editor.isShapeFrameLike(shape) && pressedShapeIds.has(shape.id)) return false;
          if (this.editor.isShapeOfType(shape, 'group') || this.editor.isShapeFrameLike(shape)) {
            const pointInShapeShape = this.editor.getPointInShapeSpace(shape, originPagePoint);
            const geometry = this.editor.getShapeGeometry(shape);
            return geometry.bounds.containsPoint(pointInShapeShape);
          }
          return false;
        })
        .map((shape) => shape.id)
    );

    this._erasingShapeIds = this.editor
      .getShapesAtPoint(originPagePoint)
      .filter((s) => !this.excludedShapeIds.has(s.id))
      .map((s) => s.id);

    this.editor.setErasingShapes([
      ...new Set([...this.editor.getErasingShapeIds(), ...this._erasingShapeIds]),
    ]);

    const scribble = this.editor.scribbles.addScribble({
      color: 'muted-1',
      size: Math.max(12, getEraserRadius() * 1.5),
    });
    this.scribbleId = scribble.id;

    this.update();
  }

  private pushPointToScribble() {
    const { x, y } = this.editor.inputs.getCurrentPagePoint();
    this.editor.scribbles.addPoint(this.scribbleId, x, y);
  }

  override onExit() {
    this.editor.setErasingShapes([]);
    this.editor.scribbles.stop(this.scribbleId);
  }

  override onPointerMove() {
    this.update();
  }

  override onPointerUp(info: TLPointerEventInfo) {
    this.complete(info);
  }

  override onCancel() {
    this.cancel();
  }

  override onComplete() {
    this.complete();
  }

  update() {
    const { editor, excludedShapeIds } = this;
    const erasingShapeIds = editor.getErasingShapeIds();
    const currentPagePoint = editor.inputs.getCurrentPagePoint();
    const previousPagePoint = editor.inputs.getPreviousPagePoint();

    this.pushPointToScribble();

    const erasing = new Set<TLShapeId>(erasingShapeIds);
    const minDist = getEraserRadius();

    const lineBounds = Box.FromPoints([previousPagePoint, currentPagePoint]).expandBy(minDist);
    const candidateIds = editor.getShapeIdsInsideBounds(lineBounds);

    if (candidateIds.size === 0) {
      editor.setErasingShapes(Array.from(erasing));
      return;
    }

    const allShapes = editor.getCurrentPageRenderingShapesSorted();
    const currentPageShapes = allShapes.filter((shape) => candidateIds.has(shape.id));

    for (const shape of currentPageShapes) {
      if (editor.isShapeOfType(shape, 'group')) continue;

      const pageMask = editor.getShapeMask(shape.id);
      if (pageMask && !pointInPolygon(currentPagePoint, pageMask)) {
        continue;
      }

      const geometry = editor.getShapeGeometry(shape);
      const pageTransform = editor.getShapePageTransform(shape);
      if (!geometry || !pageTransform) continue;
      const pt = pageTransform.clone().invert();
      const A = pt.applyToPoint(previousPagePoint);
      const B = pt.applyToPoint(currentPagePoint);

      const { bounds } = geometry;
      if (
        bounds.minX - minDist > Math.max(A.x, B.x) ||
        bounds.minY - minDist > Math.max(A.y, B.y) ||
        bounds.maxX + minDist < Math.min(A.x, B.x) ||
        bounds.maxY + minDist < Math.min(A.y, B.y)
      ) {
        continue;
      }

      if (geometry.hitTestLineSegment(A, B, minDist)) {
        const outermost = editor.getOutermostSelectableShape(shape);
        if (excludedShapeIds.has(outermost.id)) {
          erasing.add(
            editor.getOutermostSelectableShape(shape, (s) => !excludedShapeIds.has(s.id)).id
          );
        } else {
          erasing.add(outermost.id);
        }
      }

      this._erasingShapeIds = [...erasing];
    }

    this.editor.setErasingShapes(this._erasingShapeIds.filter((id) => !excludedShapeIds.has(id)));
  }

  complete(info?: TLPointerEventInfo) {
    const { editor } = this;
    editor.deleteShapes(editor.getCurrentPageState().erasingShapeIds);
    this.parent.transition('idle', info);
    this._erasingShapeIds = [];
  }

  cancel() {
    const { editor } = this;
    editor.bailToMark(this.markId);
    this.parent.transition('idle', this.info);
  }
}
