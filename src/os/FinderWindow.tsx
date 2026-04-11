import { useCallback, useEffect, useRef, useState } from 'react'
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
  folders: DesktopFolderItem[]
  notesFolder: DesktopFolderItem | undefined
  trashedFolders: DesktopFolderItem[]
}

type SidebarView = 'folder' | 'desktop' | 'applications' | 'documents' | 'downloads'

export default function FinderWindow({
  win,
  folder,
  dispatch,
  desktopRef,
  notes,
  selectedNoteId,
  folders,
  notesFolder,
  trashedFolders,
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
  const isTrash = folder?.kind === 'trash'
  const [sidebarView, setSidebarView] = useState<SidebarView>('folder')
  const [activeApp, setActiveApp] = useState<'notes' | null>(null)
  const [selectedGridIds, setSelectedGridIds] = useState<string[]>([])
  const [contentSelection, setContentSelection] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const [finderMenu, setFinderMenu] = useState<{ x: number; y: number } | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const contentSelectionRef = useRef<{
    pointerId: number
    originX: number
    originY: number
    active: boolean
  } | null>(null)

  useEffect(() => {
    setSidebarView('folder')
    setActiveApp(null)
    setSelectedGridIds([])
    setFinderMenu(null)
  }, [win.folderId])

  useEffect(() => {
    setSelectedGridIds([])
    setFinderMenu(null)
    setContentSelection(null)
  }, [sidebarView])

  useEffect(() => {
    if (!finderMenu) return
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target
      if (!(target instanceof Node)) return
      const menu = document.getElementById(`finder-menu-${win.id}`)
      if (menu?.contains(target)) return
      setFinderMenu(null)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [finderMenu, win.id])

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

  const desktopItems = [...folders].sort((a, b) => (a.y - b.y) || (a.x - b.x))
  const notesContentActive = isNotes && sidebarView === 'folder'
  const selectionEnabled =
    sidebarView === 'desktop' ||
    sidebarView === 'applications' ||
    (sidebarView === 'folder' && !isNotes)

  const updateContentSelection = (rect: {
    left: number
    top: number
    right: number
    bottom: number
  }) => {
    const content = contentRef.current
    if (!content) return
    const nodes = content.querySelectorAll<HTMLElement>('[data-grid-id]')
    const ids: string[] = []
    nodes.forEach((node) => {
      const id = node.dataset.gridId
      if (!id) return
      const box = node.getBoundingClientRect()
      const intersects =
        rect.left <= box.right &&
        rect.right >= box.left &&
        rect.top <= box.bottom &&
        rect.bottom >= box.top
      if (intersects) ids.push(id)
    })
    setSelectedGridIds(ids)
  }

  const onContentPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!selectionEnabled) return
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('[data-grid-id]')) return
    const content = contentRef.current
    if (!content) return
    content.setPointerCapture(e.pointerId)
    contentSelectionRef.current = {
      pointerId: e.pointerId,
      originX: e.clientX,
      originY: e.clientY,
      active: false,
    }
    setSelectedGridIds([])
    setContentSelection(null)
    setFinderMenu(null)
  }

  const onContentPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const sel = contentSelectionRef.current
    if (!sel || sel.pointerId !== e.pointerId) return
    const dx = e.clientX - sel.originX
    const dy = e.clientY - sel.originY
    const dist = dx * dx + dy * dy
    if (!sel.active && dist < 9) return
    sel.active = true
    const content = contentRef.current
    if (!content) return
    const bounds = content.getBoundingClientRect()
    const left = Math.min(sel.originX, e.clientX)
    const right = Math.max(sel.originX, e.clientX)
    const top = Math.min(sel.originY, e.clientY)
    const bottom = Math.max(sel.originY, e.clientY)
    setContentSelection({
      x: left - bounds.left,
      y: top - bounds.top,
      width: right - left,
      height: bottom - top,
    })
    updateContentSelection({ left, top, right, bottom })
  }

  const onContentPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const sel = contentSelectionRef.current
    if (!sel || sel.pointerId !== e.pointerId) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    contentSelectionRef.current = null
    setContentSelection(null)
  }

  const onContentContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (!selectionEnabled) return
    e.preventDefault()
    if (selectedGridIds.length <= 1) {
      setFinderMenu(null)
      return
    }
    setFinderMenu({ x: e.clientX, y: e.clientY })
  }

  const renderContent = () => {
    switch (sidebarView) {
      case 'desktop':
        return (
          <div className={styles.finderGrid}>
            {desktopItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.finderGridItem} ${selectedGridIds.includes(item.id) ? styles.finderGridItemSelected : ''}`}
                data-grid-id={item.id}
                onClick={() => dispatch({ type: 'OPEN_FINDER', folderId: item.id })}
              >
                <span className={styles.finderGridIcon} aria-hidden>
                  {item.kind === 'notes' ? '🗒️' : '📁'}
                </span>
                <span className={styles.finderGridLabel}>{item.label}</span>
              </button>
            ))}
          </div>
        )
      case 'applications':
        return (
          <div className={styles.finderGrid}>
            {notesFolder ? (
              <button
                type="button"
                className={`${styles.finderGridItem} ${selectedGridIds.includes('app-notes') ? styles.finderGridItemSelected : ''}`}
                data-grid-id="app-notes"
                onClick={() => dispatch({ type: 'OPEN_FINDER', folderId: notesFolder.id })}
              >
                <span className={styles.finderGridIcon} aria-hidden>
                  🗒️
                </span>
                <span className={styles.finderGridLabel}>Notes</span>
              </button>
            ) : (
              <p className={styles.emptyState}>No applications available.</p>
            )}
          </div>
        )
      case 'documents':
        return <p className={styles.emptyState}>No documents yet.</p>
      case 'downloads':
        return <p className={styles.emptyState}>No downloads yet.</p>
      case 'folder':
      default:
        if (!folder) return <p className={styles.emptyState}>Folder not found.</p>
        if (notesContentActive) {
          return (
            <NotesApp
              notes={notes}
              selectedNoteId={selectedNoteId}
              dispatch={dispatch}
            />
          )
        }
        if (isTrash) {
          return (
            <div className={styles.trashView}>
              <div className={styles.trashHeader}>
                <span className={styles.trashTitle}>Trash</span>
                <button
                  type="button"
                  className={styles.trashEmptyButton}
                  onClick={() => dispatch({ type: 'EMPTY_TRASH' })}
                  disabled={trashedFolders.length === 0}
                >
                  Empty
                </button>
              </div>
              {trashedFolders.length === 0 ? (
                <p className={styles.emptyState}>Trash is empty.</p>
              ) : (
                <div className={styles.finderGrid}>
                  {trashedFolders.map((item) => (
                    <div
                      key={item.id}
                      className={`${styles.finderGridItem} ${selectedGridIds.includes(item.id) ? styles.finderGridItemSelected : ''}`}
                      data-grid-id={item.id}
                    >
                      <span className={styles.finderGridIcon} aria-hidden>
                        {item.kind === 'notes' ? '🗒️' : '📁'}
                      </span>
                      <span className={styles.finderGridLabel}>{item.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        }
        return <FolderWindowBody kind={folder.kind} selectedIds={selectedGridIds} />
    }
  }

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
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
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
      <div className={styles.finderBody}>
        <aside className={styles.finderSidebar} aria-label="Finder sidebar">
          <div className={styles.finderSidebarSection}>
            <div className={styles.finderSidebarTitle}>Favorites</div>
            {folder && (
              <button
                type="button"
                className={`${styles.finderSidebarItem} ${sidebarView === 'folder' ? styles.finderSidebarItemActive : ''}`}
                onClick={() => {
                  setSidebarView('folder')
                  setActiveApp(null)
                }}
              >
                <span className={styles.finderSidebarIcon} aria-hidden>
                  📂
                </span>
                <span className={styles.finderSidebarLabel}>{folder.label}</span>
              </button>
            )}
            <button
              type="button"
              className={`${styles.finderSidebarItem} ${sidebarView === 'applications' ? styles.finderSidebarItemActive : ''}`}
              onClick={() => {
                setSidebarView('applications')
                setActiveApp(null)
              }}
            >
              <span className={styles.finderSidebarIcon} aria-hidden>
                🧭
              </span>
              <span className={styles.finderSidebarLabel}>Applications</span>
            </button>
            {notesFolder && (
              <button
                type="button"
                className={`${styles.finderSidebarItem} ${styles.finderSidebarSubItem} ${activeApp === 'notes' ? styles.finderSidebarItemActive : ''}`}
                onClick={() => {
                  setSidebarView('applications')
                  setActiveApp('notes')
                  dispatch({ type: 'OPEN_FINDER', folderId: notesFolder.id })
                }}
              >
                <span className={styles.finderSidebarIcon} aria-hidden>
                  🗒️
                </span>
                <span className={styles.finderSidebarLabel}>Notes</span>
              </button>
            )}
            <button
              type="button"
              className={`${styles.finderSidebarItem} ${sidebarView === 'desktop' ? styles.finderSidebarItemActive : ''}`}
              onClick={() => {
                setSidebarView('desktop')
                setActiveApp(null)
              }}
            >
              <span className={styles.finderSidebarIcon} aria-hidden>
                🖥️
              </span>
              <span className={styles.finderSidebarLabel}>Desktop</span>
            </button>
            <button
              type="button"
              className={`${styles.finderSidebarItem} ${sidebarView === 'documents' ? styles.finderSidebarItemActive : ''}`}
              onClick={() => {
                setSidebarView('documents')
                setActiveApp(null)
              }}
            >
              <span className={styles.finderSidebarIcon} aria-hidden>
                📄
              </span>
              <span className={styles.finderSidebarLabel}>Documents</span>
            </button>
            <button
              type="button"
              className={`${styles.finderSidebarItem} ${sidebarView === 'downloads' ? styles.finderSidebarItemActive : ''}`}
              onClick={() => {
                setSidebarView('downloads')
                setActiveApp(null)
              }}
            >
              <span className={styles.finderSidebarIcon} aria-hidden>
                ⬇️
              </span>
              <span className={styles.finderSidebarLabel}>Downloads</span>
            </button>
          </div>
        </aside>
        <div
          className={`${styles.finderContent} ${notesContentActive ? styles.finderContentNotes : ''}`}
          ref={contentRef}
          onPointerDown={onContentPointerDown}
          onPointerMove={onContentPointerMove}
          onPointerUp={onContentPointerUp}
          onPointerCancel={onContentPointerUp}
          onContextMenu={onContentContextMenu}
        >
          {renderContent()}
          {contentSelection && (
            <div
              className={styles.selectionBox}
              style={{
                left: contentSelection.x,
                top: contentSelection.y,
                width: contentSelection.width,
                height: contentSelection.height,
              }}
            />
          )}
          {finderMenu && (
            <div
              id={`finder-menu-${win.id}`}
              className={styles.finderContextMenu}
              style={{
                left: Math.max(8, Math.min(finderMenu.x, window.innerWidth - 160)),
                top: Math.max(8, Math.min(finderMenu.y, window.innerHeight - 80)),
              }}
              role="menu"
            >
              <button
                type="button"
                className={styles.menuItem}
                role="menuitem"
                onClick={() => {
                  if (sidebarView === 'desktop') {
                    dispatch({ type: 'REMOVE_FOLDERS', ids: selectedGridIds })
                  } else if (sidebarView === 'folder' && isTrash) {
                    dispatch({ type: 'REMOVE_TRASH_ITEMS', ids: selectedGridIds })
                  }
                  setSelectedGridIds([])
                  setFinderMenu(null)
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
