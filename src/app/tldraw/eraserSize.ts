import { atom } from 'tldraw';

/**
 * The eraser doesn't have a built-in "brush size" concept in tldraw (it erases
 * anything the pointer's path touches, using a small fixed hit-test margin).
 * We add a real, adjustable eraser radius here so the size picker we show in
 * the style panel while the eraser tool is active actually changes behavior.
 */
export const ERASER_SIZES = {
  s: 4,
  m: 10,
  l: 20,
  xl: 36,
} as const;

export type EraserSizeKey = keyof typeof ERASER_SIZES;

export const eraserSizeAtom = atom<EraserSizeKey>('eraserSize', 'm');

export function getEraserRadius(): number {
  return ERASER_SIZES[eraserSizeAtom.get()];
}
