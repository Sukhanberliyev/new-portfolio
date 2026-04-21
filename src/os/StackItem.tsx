import { useRef, useState } from 'react'
import type { DesktopFolderItem } from './osTypes'
import type { HistoryAction } from './osHistoryReducer'
import styles from './OSMode.module.css'

export interface DesktopStack {
  id: string
  label: string
  x: number
  y: number
  folders: DesktopFolderItem[]
  kind: DesktopFolderItem['kind']
  hasContents: boolean
}

interface StackItemProps {
  stack: DesktopStack
  selected: boolean
  dispatch: React.Dispatch<HistoryAction>
}

const DRAG_THRESHOLD = 4

export default function StackItem({ stack, selected, dispatch }: StackItemProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{
    pointerId: number
    originX: number
    originY: number
    dragging: boolean
  } | null>(null)
  const top = stack.folders[0]
  const count = stack.folders.length
  const isNotes = stack.kind === 'notes'
  const iconSrc = stack.hasContents ? '/icons/folder-filled.svg' : '/icons/folder.svg'
  const iconClass = stack.hasContents ? styles.folderIconFilled : styles.folderIcon

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      originX: e.clientX,
      originY: e.clientY,
      dragging: false,
    }
    dispatch({ type: 'SELECT_FOLDER', id: top.id })
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    const dx = e.clientX - d.originX
    const dy = e.clientY - d.originY
    if (!d.dragging) {
      if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return
      d.dragging = true
      setDragging(true)
    }
    setOffset({ x: dx, y: dy })
  }

  const endDrag = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    const wasDragging = d.dragging
    dragRef.current = null
    if (wasDragging) {
      setDragging(false)
      setOffset({ x: 0, y: 0 })
    }
  }

  const onDoubleClick = () => {
    if (dragRef.current?.dragging || dragging) return
    dispatch({ type: 'OPEN_FINDER', folderId: top.id })
  }

  const translateStyle =
    offset.x !== 0 || offset.y !== 0
      ? { transform: `translate(${offset.x}px, ${offset.y}px)` }
      : undefined

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${stack.label} stack, ${count} item${count === 1 ? '' : 's'}`}
      className={`${styles.folder} ${styles.stack} ${selected ? styles.folderSelected : ''} ${dragging ? styles.stackDragging : ''}`}
      style={{ left: stack.x, top: stack.y, ...translateStyle }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onDoubleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          dispatch({ type: 'OPEN_FINDER', folderId: top.id })
        }
      }}
    >
      <div className={styles.folderIconWrap}>
        {count > 2 && <span className={`${styles.stackPeek} ${styles.stackPeekBack}`} aria-hidden />}
        {count > 1 && <span className={`${styles.stackPeek} ${styles.stackPeekMid}`} aria-hidden />}
        {isNotes ? (
          <span className={styles.folderGlyph} aria-hidden>
            🗒️
          </span>
        ) : (
          <img
            className={iconClass}
            src={iconSrc}
            alt=""
            aria-hidden
            draggable={false}
          />
        )}
      </div>
      <span className={styles.folderLabel}>
        {stack.label}
        {count > 1 ? ` (${count})` : ''}
      </span>
    </div>
  )
}
