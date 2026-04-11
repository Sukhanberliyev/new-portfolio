import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
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

function FinderIcon({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? styles.finderIconSvg}
      aria-hidden
    >
      {children}
    </svg>
  )
}

function SidebarToggleIcon() {
  return (
    <FinderIcon>
      <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="2.4" />
      <path d="M6.3 3.4v9.2" />
    </FinderIcon>
  )
}

function ArrowLeftIcon() {
  return (
    <FinderIcon>
      <path d="M9.8 3.5 5.3 8l4.5 4.5" />
      <path d="M5.7 8h6.1" />
    </FinderIcon>
  )
}

function ArrowRightIcon() {
  return (
    <FinderIcon>
      <path d="m6.2 3.5 4.5 4.5-4.5 4.5" />
      <path d="M10.3 8H4.2" />
    </FinderIcon>
  )
}

function DesktopIcon() {
  return (
    <FinderIcon>
      <rect x="2.2" y="3" width="11.6" height="8.2" rx="1.8" />
      <path d="M2.8 8.6h10.4" />
    </FinderIcon>
  )
}

function ApplicationsIcon() {
  return (
    <FinderIcon>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 2.8v1.4" />
      <path d="M8 11.8v1.4" />
      <path d="m4.3 4.3 1 1" />
      <path d="m10.7 10.7 1 1" />
      <path d="M2.8 8h1.4" />
      <path d="M11.8 8h1.4" />
      <path d="m4.3 11.7 1-1" />
      <path d="m10.7 5.3 1-1" />
    </FinderIcon>
  )
}

function DocumentsIcon() {
  return (
    <FinderIcon>
      <path d="M4 2.5h5l3 3v8A1.5 1.5 0 0 1 10.5 15h-6A1.5 1.5 0 0 1 3 13.5v-9A2 2 0 0 1 5 2.5Z" />
      <path d="M9 2.5v3h3" />
    </FinderIcon>
  )
}

function DownloadsIcon() {
  return (
    <FinderIcon>
      <path d="M8 2.7v7.1" />
      <path d="m5.2 7.8 2.8 2.9 2.8-2.9" />
      <path d="M3.1 13.2h9.8" />
    </FinderIcon>
  )
}

interface FinderWindowProps {
  win: OpenFinderWindow
  folder: DesktopFolderItem | undefined
  dispatch: Dispatch<HistoryAction>
  desktopRef: RefObject<HTMLElement | null>
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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

  const onTitlePointerDown = (e: ReactPointerEvent) => {
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

  const onTitlePointerMove = (e: ReactPointerEvent) => {
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

  const onTitlePointerUp = (e: ReactPointerEvent) => {
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

  const onResizePointerDown = (e: ReactPointerEvent, edge: ResizeEdge) => {
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

  const onResizePointerMove = (e: ReactPointerEvent) => {
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

  const onResizePointerUp = (e: ReactPointerEvent) => {
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
  const currentViewTitle =
    sidebarView === 'folder'
      ? title
      : sidebarView === 'applications'
        ? 'Applications'
        : sidebarView === 'desktop'
          ? 'Desktop'
          : sidebarView === 'documents'
            ? 'Documents'
            : 'Downloads'
  const sidebarItems: Array<{
    view: Exclude<SidebarView, 'folder'>
    label: string
    icon: ReactNode
  }> = [
    { view: 'desktop', label: 'Desktop', icon: <DesktopIcon /> },
    { view: 'applications', label: 'Applications', icon: <ApplicationsIcon /> },
    { view: 'documents', label: 'Documents', icon: <DocumentsIcon /> },
    { view: 'downloads', label: 'Downloads', icon: <DownloadsIcon /> },
  ]

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

  const onContentPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
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

  const onContentPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
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

  const onContentPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
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

  const onContentContextMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
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

  const onTitleBarDoubleClick = (e: ReactMouseEvent) => {
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
  }

  const titleBarDragProps = {
    onPointerDown: onTitlePointerDown,
    onPointerMove: onTitlePointerMove,
    onPointerUp: onTitlePointerUp,
    onPointerCancel: onTitlePointerUp,
    onDoubleClick: onTitleBarDoubleClick,
  }

  const headerChrome = (
    <>
      <div className={styles.traffic} onDoubleClick={(e) => e.stopPropagation()}>
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

      <div className={styles.finderToolbarLeft} onDoubleClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.finderToolbarIcon}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            setSidebarCollapsed((prev) => !prev)
          }}
          aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
          <SidebarToggleIcon />
        </button>
        <button
          type="button"
          className={styles.finderToolbarIcon}
          aria-label="Back"
          disabled
          onPointerDown={(e) => e.stopPropagation()}
        >
          <ArrowLeftIcon />
        </button>
        <button
          type="button"
          className={styles.finderToolbarIcon}
          aria-label="Forward"
          disabled
          onPointerDown={(e) => e.stopPropagation()}
        >
          <ArrowRightIcon />
        </button>
      </div>
    </>
  )

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
      {sidebarCollapsed && (
        <div className={styles.finderHeader} {...titleBarDragProps}>
          <div className={styles.finderHeaderRowCollapsed}>
            <div className={styles.finderHeaderLeft}>
              {headerChrome}
              <div className={styles.finderHeaderTitle}>{currentViewTitle}</div>
            </div>
          </div>
        </div>
      )}
      <div
        className={`${styles.finderBody} ${sidebarCollapsed ? styles.finderBodyCollapsed : styles.finderBodyExpanded}`}
      >
        {!sidebarCollapsed && (
          <aside className={styles.finderSidebar} aria-label="Finder sidebar">
            <div className={styles.finderSidebarTop} {...titleBarDragProps}>
              <div className={styles.finderHeaderLeft}>{headerChrome}</div>
            </div>
            <div className={styles.finderSidebarSection}>
              {sidebarItems.map((item) => (
                <button
                  key={item.view}
                  type="button"
                  className={`${styles.finderSidebarItem} ${sidebarView === item.view ? styles.finderSidebarItemActive : ''}`}
                  onClick={() => {
                    setSidebarView(item.view)
                  }}
                >
                  <span className={styles.finderSidebarIcon} aria-hidden>
                    {item.icon}
                  </span>
                  <span className={styles.finderSidebarLabel}>{item.label}</span>
                </button>
              ))}
            </div>
          </aside>
        )}
        {!sidebarCollapsed && (
          <div className={styles.finderPaneHeaderCell} {...titleBarDragProps}>
            {!notesContentActive && !isTrash && (
              <div className={styles.finderPaneHeaderTitle}>{currentViewTitle}</div>
            )}
          </div>
        )}
        <div
          className={`${styles.finderPane} ${sidebarCollapsed ? styles.finderPaneCollapsed : ''}`}
        >
          <div
            className={`${styles.finderContent} ${notesContentActive ? styles.finderContentNotes : ''} ${sidebarCollapsed ? styles.finderContentCollapsed : ''}`}
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
    </div>
  )
}
