import { useCallback, useEffect, useRef, useState } from 'react'
import type { DesktopFolderItem, FolderKind } from './osTypes'
import type { HistoryAction } from './osHistoryReducer'
import styles from './OSMode.module.css'

const DRAG_THRESHOLD = 4

function folderHasContents(kind: FolderKind): boolean {
  switch (kind) {
    case 'about':
    case 'projects':
    case 'contact':
      return true
    case 'playground':
    case 'custom':
    default:
      return false
  }
}

interface DesktopFolderProps {
  folder: DesktopFolderItem
  selected: boolean
  selectedCount: number
  isRenaming: boolean
  dispatch: React.Dispatch<HistoryAction>
  desktopRef: React.RefObject<HTMLElement | null>
}

export default function DesktopFolder({
  folder,
  selected,
  selectedCount,
  isRenaming,
  dispatch,
  desktopRef,
}: DesktopFolderProps) {
  const [dragVisual, setDragVisual] = useState<{ x: number; y: number } | null>(null)
  const [renameDraft, setRenameDraft] = useState(folder.label)
  const [renameWidth, setRenameWidth] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const skipBlurCommitRef = useRef(false)
  const dragRef = useRef<{
    pointerId: number
    originX: number
    originY: number
    startFolderX: number
    startFolderY: number
    dragging: boolean
    lastX: number
    lastY: number
  } | null>(null)

  const measureTextWidth = useCallback((text: string) => {
    const sizer = document.createElement('span')
    sizer.textContent = text.length ? text : ' '
    sizer.style.cssText =
      'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;' +
      "font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" +
      'font-size:12px;font-weight:400;line-height:20px;letter-spacing:normal;'
    document.body.appendChild(sizer)
    const textWidth = sizer.getBoundingClientRect().width
    document.body.removeChild(sizer)
    return Math.ceil(textWidth) + 2
  }, [])

  useEffect(() => {
    if (!isRenaming) return
    setRenameDraft(folder.label)
    setRenameWidth(measureTextWidth(folder.label))
    const id = requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      el.select()
    })
    return () => cancelAnimationFrame(id)
  }, [isRenaming, folder.label, measureTextWidth])

  const clamp = useCallback(
    (x: number, y: number) => {
      const desk = desktopRef.current
      if (!desk) return { x, y }
      const rect = desk.getBoundingClientRect()
      const w = 88
      const h = 72
      const minX = 8
      const minY = 8
      const maxX = Math.max(minX, rect.width - w - 8)
      const maxY = Math.max(minY, rect.height - h - 8)
      return {
        x: Math.min(maxX, Math.max(minX, x)),
        y: Math.min(maxY, Math.max(minY, y)),
      }
    },
    [desktopRef]
  )

  const finishRename = () => {
    if (skipBlurCommitRef.current) {
      skipBlurCommitRef.current = false
      return
    }
    const t = renameDraft.trim()
    if (!t || t === folder.label) {
      dispatch({ type: 'CANCEL_RENAME_FOLDER' })
    } else {
      dispatch({ type: 'RENAME_FOLDER', id: folder.id, label: t })
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (isRenaming) return
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      originX: e.clientX,
      originY: e.clientY,
      startFolderX: folder.x,
      startFolderY: folder.y,
      dragging: false,
      lastX: folder.x,
      lastY: folder.y,
    }
    setDragVisual(null)
    dispatch({ type: 'SELECT_FOLDER', id: folder.id })
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (isRenaming) return
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    const dx = e.clientX - d.originX
    const dy = e.clientY - d.originY
    if (!d.dragging) {
      if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return
      d.dragging = true
    }
    const next = clamp(d.startFolderX + dx, d.startFolderY + dy)
    d.lastX = next.x
    d.lastY = next.y
    setDragVisual(next)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (isRenaming) return
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (
      d.dragging &&
      (d.lastX !== d.startFolderX || d.lastY !== d.startFolderY)
    ) {
      dispatch({
        type: 'MOVE_FOLDER',
        id: folder.id,
        x: d.lastX,
        y: d.lastY,
      })
    }
    dragRef.current = null
    setDragVisual(null)
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    if (isRenaming) return
    e.stopPropagation()
    dispatch({ type: 'OPEN_FINDER', folderId: folder.id })
  }

  const left = dragVisual?.x ?? folder.x
  const top = dragVisual?.y ?? folder.y

  return (
    <div
      role={isRenaming ? 'group' : 'button'}
      tabIndex={isRenaming ? -1 : 0}
      aria-label={isRenaming ? `Renaming ${folder.label}` : folder.label}
      className={`${styles.folder} ${selected ? styles.folderSelected : ''} ${isRenaming ? styles.folderRenaming : ''}`}
      style={{ left, top }}
      data-folder-id={folder.id}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => {
        if (isRenaming) return
        e.preventDefault()
        e.stopPropagation()
        if (selectedCount <= 1) {
          dispatch({ type: 'SELECT_FOLDER', id: folder.id })
        }
        dispatch({
          type: 'OPEN_CONTEXT_MENU',
          x: e.clientX,
          y: e.clientY,
          folderId: folder.id,
        })
      }}
      onKeyDown={(e) => {
        if (isRenaming) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          dispatch({ type: 'OPEN_FINDER', folderId: folder.id })
        }
      }}
    >
      <div className={styles.folderIconWrap}>
        {folder.kind === 'notes' ? (
          <span className={styles.folderGlyph} aria-hidden>
            🗒️
          </span>
        ) : (
          <img
            className={
              folderHasContents(folder.kind)
                ? styles.folderIconFilled
                : styles.folderIcon
            }
            src={
              folderHasContents(folder.kind)
                ? '/icons/folder-filled.svg'
                : '/icons/folder.svg'
            }
            alt=""
            aria-hidden
            draggable={false}
          />
        )}
      </div>
      {isRenaming ? (
        <input
          ref={inputRef}
          className={styles.folderRenameInput}
          style={renameWidth != null ? { width: `${renameWidth}px` } : undefined}
          value={renameDraft}
          onChange={(e) => {
            const v = e.target.value
            setRenameDraft(v)
            setRenameWidth(measureTextWidth(v))
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.stopPropagation()
              finishRename()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              skipBlurCommitRef.current = true
              dispatch({ type: 'CANCEL_RENAME_FOLDER' })
            }
          }}
          onBlur={finishRename}
          aria-label="Folder name"
          maxLength={120}
        />
      ) : (
        <span className={styles.folderLabel}>{folder.label}</span>
      )}
    </div>
  )
}
