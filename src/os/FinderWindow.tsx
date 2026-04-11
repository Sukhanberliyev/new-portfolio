import { useCallback, useRef, useState } from 'react'
import type { DesktopFolderItem, NoteItem, OpenFinderWindow } from './osTypes'
import type { HistoryAction } from './osHistoryReducer'
import {
  applyResizeDelta,
  clampFinderRect,
  resolveFinderSize,
  type ResizeEdge,
} from './finderLayout'
import { FolderWindowBody } from './folderContents'
import NotesApp from './NotesApp'
import styles from './OSMode.module.css'

const DRAG_THRESHOLD = 4

const RESIZE_HANDLES: { edge: ResizeEdge; className: string; label: string }[] = [
  { edge: 'n', className: styles.resizeN, label: 'Resize top edge' },
  { edge: 's', className: styles.resizeS, label: 'Resize bottom edge' },
  { edge: 'e', className: styles.resizeE, label: 'Resize right edge' },
  { edge: 'w', className: styles.resizeW, label: 'Resize left edge' },
  { edge: 'nw', className: styles.resizeNW, label: 'Resize top-left corner' },
  { edge: 'ne', className: styles.resizeNE, label: 'Resize top-right corner' },
  { edge: 'sw', className: styles.resizeSW, label: 'Resize bottom-left corner' },
  { edge: 'se', className: styles.resizeSE, label: 'Resize bottom-right corner' },
]

interface FinderWindowProps {
  win: OpenFinderWindow
  folder: DesktopFolderItem | undefined
  dispatch: React.Dispatch<HistoryAction>
  desktopRef: React.RefObject<HTMLElement | null>
  notes: NoteItem[]
  selectedNoteId: string | null
}

export default function FinderWindow({
  win,
  folder,
  dispatch,
  desktopRef,
  notes,
  selectedNoteId,
}: FinderWindowProps) {
  const [dragVisual, setDragVisual] = useState<{ x: number; y: number } | null>(null)
  const [resizePreview, setResizePreview] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)

  const dragRef = useRef<{
    pointerId: number
    originX: number
    originY: number
    startWinX: number
    startWinY: number
    dragging: boolean
    lastX: number
    lastY: number
  } | null>(null)

  const resizeRef = useRef<{
    edge: ResizeEdge
    pointerId: number
    originX: number
    originY: number
    startX: number
    startY: number
    startW: number
    startH: number
    lastRect: { x: number; y: number; width: number; height: number }
  } | null>(null)

  const title = folder?.label ?? 'Folder'
  const baseSize = resolveFinderSize(win)
  const isNotes = folder?.kind === 'notes'

  const clampMove = useCallback(
    (x: number, y: number, w: number, h: number) => {
      const desk = desktopRef.current
      if (!desk) return { x, y }
      const rect = desk.getBoundingClientRect()
      const margin = 8
      const maxX = Math.max(margin, rect.width - w - margin)
      const maxY = Math.max(margin, rect.height - h - margin)
      return {
        x: Math.min(maxX, Math.max(margin, x)),
        y: Math.min(maxY, Math.max(margin, y)),
      }
    },
    [desktopRef]
  )

  const onTitlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || resizeRef.current) return
    e.stopPropagation()
    dispatch({ type: 'FOCUS_WINDOW', windowId: win.id })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      originX: e.clientX,
      originY: e.clientY,
      startWinX: win.x,
      startWinY: win.y,
      dragging: false,
      lastX: win.x,
      lastY: win.y,
    }
    setDragVisual(null)
  }

  const onTitlePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    const dx = e.clientX - d.originX
    const dy = e.clientY - d.originY
    if (!d.dragging) {
      if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return
      d.dragging = true
    }
    const next = clampMove(
      d.startWinX + dx,
      d.startWinY + dy,
      baseSize.width,
      baseSize.height
    )
    d.lastX = next.x
    d.lastY = next.y
    setDragVisual(next)
  }

  const onTitlePointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (d.dragging && (d.lastX !== d.startWinX || d.lastY !== d.startWinY)) {
      dispatch({
        type: 'MOVE_WINDOW',
        windowId: win.id,
        x: d.lastX,
        y: d.lastY,
      })
    }
    dragRef.current = null
    setDragVisual(null)
  }

  const onResizePointerDown = (e: React.PointerEvent, edge: ResizeEdge) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    dispatch({ type: 'FOCUS_WINDOW', windowId: win.id })
    dragRef.current = null
    setDragVisual(null)

    const { width: sw, height: sh } = resolveFinderSize(win)
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const deskEl = desktopRef.current
    const dw = deskEl?.getBoundingClientRect().width ?? window.innerWidth
    const dh = deskEl?.getBoundingClientRect().height ?? window.innerHeight
    const startRect = clampFinderRect(dw, dh, win.x, win.y, sw, sh)
    resizeRef.current = {
      edge,
      pointerId: e.pointerId,
      originX: e.clientX,
      originY: e.clientY,
      startX: startRect.x,
      startY: startRect.y,
      startW: startRect.width,
      startH: startRect.height,
      lastRect: startRect,
    }
    setResizePreview(startRect)
  }

  const onResizePointerMove = (e: React.PointerEvent) => {
    const r = resizeRef.current
    if (!r || r.pointerId !== e.pointerId) return
    const deskEl = desktopRef.current
    if (!deskEl) return
    const desk = deskEl.getBoundingClientRect()
    const dx = e.clientX - r.originX
    const dy = e.clientY - r.originY
    let next = applyResizeDelta(
      r.edge,
      r.startX,
      r.startY,
      r.startW,
      r.startH,
      dx,
      dy
    )
    next = clampFinderRect(desk.width, desk.height, next.x, next.y, next.width, next.height)
    r.lastRect = next
    setResizePreview(next)
  }

  const onResizePointerUp = (e: React.PointerEvent) => {
    const r = resizeRef.current
    if (!r || r.pointerId !== e.pointerId) return
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    const last = r.lastRect
    const changed =
      last.x !== r.startX ||
      last.y !== r.startY ||
      last.width !== r.startW ||
      last.height !== r.startH
    if (changed) {
      dispatch({
        type: 'RESIZE_WINDOW',
        windowId: win.id,
        x: last.x,
        y: last.y,
        width: last.width,
        height: last.height,
      })
    }
    resizeRef.current = null
    setResizePreview(null)
  }

  const onWindowPointerDown = () => {
    if (!resizeRef.current) {
      dispatch({ type: 'FOCUS_WINDOW', windowId: win.id })
    }
  }

  const left = resizePreview?.x ?? dragVisual?.x ?? win.x
  const top = resizePreview?.y ?? dragVisual?.y ?? win.y
  const fw = resizePreview?.width ?? baseSize.width
  const fh = resizePreview?.height ?? baseSize.height

  return (
    <div
      className={styles.finderWindow}
      style={{
        left,
        top,
        width: fw,
        height: fh,
        zIndex: win.z,
      }}
      onPointerDown={onWindowPointerDown}
    >
      <div className={styles.resizeHandles}>
        {RESIZE_HANDLES.map(({ edge, className, label }) => (
          <button
            key={edge}
            type="button"
            className={`${styles.resizeHandle} ${className}`}
            aria-label={label}
            tabIndex={-1}
            onPointerDown={(e) => onResizePointerDown(e, edge)}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            onPointerCancel={onResizePointerUp}
          />
        ))}
      </div>
      <div
        className={styles.finderTitleBar}
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={onTitlePointerUp}
        onPointerCancel={onTitlePointerUp}
        onDoubleClick={(e) => {
          e.stopPropagation()
          const desk = desktopRef.current
          if (!desk) return
          const { width, height } = desk.getBoundingClientRect()
          dispatch({
            type: 'TOGGLE_WINDOW_ZOOM',
            windowId: win.id,
            desktopWidth: width,
            desktopHeight: height,
          })
        }}
      >
        <div
          className={styles.traffic}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={`${styles.trafficBtn} ${styles.trafficClose}`}
            aria-label="Close"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              dispatch({ type: 'CLOSE_WINDOW', windowId: win.id })
            }}
          />
          <button
            type="button"
            className={`${styles.trafficBtn} ${styles.trafficMin}`}
            aria-label="Minimize"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              dispatch({ type: 'MINIMIZE_WINDOW', windowId: win.id })
            }}
          />
          <span className={`${styles.trafficBtn} ${styles.trafficMax}`} aria-hidden />
        </div>
        <div className={styles.finderTitle}>{title}</div>
        <span />
      </div>
      <div className={styles.finderToolbar}>
        <div className={styles.finderNav}>
          <span className={styles.finderNavBtn} aria-hidden>
            ‹
          </span>
          <span className={styles.finderNavBtn} aria-hidden>
            ›
          </span>
        </div>
      </div>
      <div className={`${styles.finderBody} ${isNotes ? styles.notesBody : ''}`}>
        {folder ? (
          isNotes ? (
            <NotesApp
              notes={notes}
              selectedNoteId={selectedNoteId}
              dispatch={dispatch}
            />
          ) : (
            <FolderWindowBody kind={folder.kind} />
          )
        ) : (
          <p className={styles.emptyState}>Folder not found.</p>
        )}
      </div>
    </div>
  )
}
