/** Default Finder window size (matches prior fixed layout). */
export const FINDER_DEFAULT_WIDTH = 400
export const FINDER_DEFAULT_HEIGHT = 360
export const FINDER_MIN_WIDTH = 260
export const FINDER_MIN_HEIGHT = 196

export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export function resolveFinderSize(win: {
  width?: number
  height?: number
}): { width: number; height: number } {
  return {
    width: win.width ?? FINDER_DEFAULT_WIDTH,
    height: win.height ?? FINDER_DEFAULT_HEIGHT,
  }
}

/** Clamp window rectangle inside the desktop; enforce min size. */
export function clampFinderRect(
  deskW: number,
  deskH: number,
  x: number,
  y: number,
  width: number,
  height: number,
  margin = 8
): { x: number; y: number; width: number; height: number } {
  let w = Math.max(FINDER_MIN_WIDTH, width)
  let h = Math.max(FINDER_MIN_HEIGHT, height)
  const maxW = Math.max(FINDER_MIN_WIDTH, deskW - margin * 2)
  const maxH = Math.max(FINDER_MIN_HEIGHT, deskH - margin * 2)
  w = Math.min(w, maxW)
  h = Math.min(h, maxH)
  let nx = Math.max(margin, Math.min(x, deskW - w - margin))
  let ny = Math.max(margin, Math.min(y, deskH - h - margin))
  return { x: nx, y: ny, width: w, height: h }
}

/** Apply pointer delta for a given edge from starting rect. */
export function applyResizeDelta(
  edge: ResizeEdge,
  startX: number,
  startY: number,
  startW: number,
  startH: number,
  dx: number,
  dy: number
): { x: number; y: number; width: number; height: number } {
  let x = startX
  let y = startY
  let w = startW
  let h = startH

  switch (edge) {
    case 'e':
      w = startW + dx
      break
    case 'w':
      w = startW - dx
      x = startX + dx
      break
    case 's':
      h = startH + dy
      break
    case 'n':
      h = startH - dy
      y = startY + dy
      break
    case 'se':
      w = startW + dx
      h = startH + dy
      break
    case 'sw':
      w = startW - dx
      x = startX + dx
      h = startH + dy
      break
    case 'ne':
      w = startW + dx
      h = startH - dy
      y = startY + dy
      break
    case 'nw':
      w = startW - dx
      x = startX + dx
      h = startH - dy
      y = startY + dy
      break
    default:
      break
  }

  return { x, y, width: w, height: h }
}
