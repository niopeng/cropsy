import { Rect } from '../types';

export const clampRectToImage = (rect: Rect, imgWidth: number, imgHeight: number): Rect => {
  // 1. Clamp Width/Height to not exceed image dimensions
  let width = Math.min(rect.width, imgWidth);
  let height = Math.min(rect.height, imgHeight);

  // 2. Clamp X/Y to be within bounds
  let x = Math.max(0, Math.min(rect.x, imgWidth - width));
  let y = Math.max(0, Math.min(rect.y, imgHeight - height));

  // 3. Ensure we have at least 1px to avoid crash
  width = Math.max(1, width);
  height = Math.max(1, height);

  return { x, y, width, height };
};

export const defaultRect = (imgWidth: number, imgHeight: number): Rect => ({
  x: Math.floor(imgWidth * 0.25),
  y: Math.floor(imgHeight * 0.25),
  width: Math.floor(imgWidth * 0.5),
  height: Math.floor(imgHeight * 0.5),
});
