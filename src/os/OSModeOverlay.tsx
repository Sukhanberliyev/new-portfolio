import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import MenuBar from './MenuBar'
import DesktopFolder from './DesktopFolder'
import StackItem, { type DesktopStack } from './StackItem'
import FinderWindow from './FinderWindow'
import MinimizedWindowsBar from './MinimizedWindowsBar'
import Dock from './Dock'
import type { OSReducerState } from './osReducer'
import type { HistoryAction } from './osHistoryReducer'
import type { DesktopFolderItem, FolderKind } from './osTypes'
import { WALLPAPERS } from './wallpapers'
import styles from './OSMode.module.css'

type StackGroupBy = 'added' | 'modified' | 'created' | 'opened' | 'kind'

const KIND_GROUP_LABELS: Record<FolderKind, string> = {
  about: 'Documents',
  projects: 'Documents',
  playground: 'Documents',
  contact: 'Documents',
  custom: 'Folders',
  notes: 'Notes',
  trash: 'Trash',
  calculator: 'Applications',
  calendar: 'Applications',
}

const KIND_ORDER: Record<FolderKind, number> = {
  about: 0,
  projects: 1,
  contact: 2,
  playground: 3,
  custom: 4,
  notes: 5,
  trash: 6,
  calculator: 7,
  calendar: 8,
}

function dayBucketLabel(ts: number): { key: string; label: string } {
  if (!ts) return { key: 'unknown', label: 'Earlier' }
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - d.getTime()) / 86_400_000)
  const key = d.toISOString().slice(0, 10)
  let label: string
  if (diffDays === 0) label = 'Today'
  else if (diffDays === 1) label = 'Yesterday'
  else if (diffDays < 7) label = d.toLocaleDateString(undefined, { weekday: 'long' })
  else label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return { key, label }
}

function buildStacks(
  folders: DesktopFolderItem[],
  groupBy: StackGroupBy,
  desktopWidth: number
): DesktopStack[] {
  const groups = new Map<
    string,
    { label: string; folders: DesktopFolderItem[]; order: number }
  >()

  folders.forEach((f) => {
    let key: string
    let label: string
    let order: number
    if (groupBy === 'kind') {
      key = `kind:${KIND_GROUP_LABELS[f.kind]}`
      label = KIND_GROUP_LABELS[f.kind]
      order = KIND_ORDER[f.kind] ?? 99
    } else {
      const bucket = dayBucketLabel(f.createdAt ?? 0)
      key = `day:${bucket.key}`
      label = bucket.label
      order = -(f.createdAt ?? 0)
    }
    const g = groups.get(key)
    if (g) {
      g.folders.push(f)
      g.order = Math.min(g.order, order)
    } else {
      groups.set(key, { label, folders: [f], order })
    }
  })

  const ordered = Array.from(groups.entries())
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, g]) => ({ key, ...g }))

  const SLOT_W = 104
  const SLOT_H = 116
  const MARGIN_X = 24
  const MARGIN_Y = 24
  const usableH = Math.max(SLOT_H, 640)
  const perCol = Math.max(1, Math.floor(usableH / SLOT_H))

  return ordered.map((g, i) => {
    const col = Math.floor(i / perCol)
    const row = i % perCol
    const representative = g.folders[0]
    const hasContents =
      g.folders.some(
        (f) => f.kind === 'about' || f.kind === 'projects' || f.kind === 'contact'
      ) || g.folders.length > 1
    return {
      id: `stack-${g.key}`,
      label: g.label,
      x: Math.max(MARGIN_X, desktopWidth - MARGIN_X - SLOT_W - col * SLOT_W),
      y: MARGIN_Y + row * SLOT_H,
      folders: g.folders,
      kind: representative.kind,
      hasContents,
    }
  })
}

interface OSModeOverlayProps {
  open: boolean
  onClose: () => void
  state: OSReducerState
  dispatch: React.Dispatch<HistoryAction>
  canUndo: boolean
  canRedo: boolean
}

export default function OSModeOverlay({
  open,
  onClose,
  state,
  dispatch,
  canUndo,
  canRedo,
}: OSModeOverlayProps) {
  const desktopRef = useRef<HTMLDivElement>(null)
  const menuBarRef = useRef<HTMLElement>(null)
  const [useStacks, setUseStacks] = useState(false)
  const [stackGroupBy, setStackGroupBy] = useState<
    'added' | 'modified' | 'created' | 'opened' | 'kind'
  >('added')
  const [stackSubmenuOpen, setStackSubmenuOpen] = useState(false)
  const [selectionBox, setSelectionBox] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const selectionRef = useRef<{
    pointerId: number
    originX: number
    originY: number
    active: boolean
  } | null>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!state.contextMenu) setStackSubmenuOpen(false)
  }, [state.contextMenu])

  useEffect(() => {
    if (!open || !state.activeMenu) return
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target
      if (!(t instanceof Node)) return
      if (menuBarRef.current?.contains(t)) return
      dispatch({ type: 'SET_ACTIVE_MENU', menu: null })
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open, state.activeMenu, dispatch])

  useEffect(() => {
    if (
      !open ||
      state.selectedFolderIds.length === 0 ||
      state.contextMenu ||
      state.wallpaperPickerOpen ||
      state.renamingFolderId
    )
      return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return
      e.preventDefault()
      if (state.selectedFolderIds.length === 1) {
        dispatch({ type: 'REMOVE_FOLDER', id: state.selectedFolderIds[0] })
      } else {
        dispatch({ type: 'REMOVE_FOLDERS', ids: state.selectedFolderIds })
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [
    open,
    state.selectedFolderIds,
    state.contextMenu,
    state.wallpaperPickerOpen,
    state.renamingFolderId,
    dispatch,
  ])

  useEffect(() => {
    if (!open || state.renamingFolderId || state.contextMenu || state.wallpaperPickerOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'F2') return
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return
      if (!state.selectedFolderId || state.selectedFolderIds.length !== 1) return
      e.preventDefault()
      dispatch({ type: 'START_RENAME_FOLDER', id: state.selectedFolderId })
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [
    open,
    state.selectedFolderId,
    state.selectedFolderIds,
    state.renamingFolderId,
    state.contextMenu,
    state.wallpaperPickerOpen,
    dispatch,
  ])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod || e.key.toLowerCase() !== 'z') return
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return
      e.preventDefault()
      if (e.shiftKey) {
        if (canRedo) dispatch({ type: 'REDO' })
      } else if (canUndo) {
        dispatch({ type: 'UNDO' })
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, canUndo, canRedo, dispatch])

  const wallpaper = WALLPAPERS.find((w) => w.id === state.wallpaperId) ?? WALLPAPERS[0]

  const dismissContextMenu = () => {
    dispatch({ type: 'CLOSE_CONTEXT_MENU' })
  }

  const onDesktopContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    dispatch({ type: 'OPEN_CONTEXT_MENU', x: e.clientX, y: e.clientY })
  }

  const updateSelectionFromRect = (rect: {
    left: number
    top: number
    right: number
    bottom: number
  }) => {
    const desk = desktopRef.current
    if (!desk) return
    const nodes = desk.querySelectorAll<HTMLElement>('[data-folder-id]')
    const ids: string[] = []
    nodes.forEach((el) => {
      const id = el.dataset.folderId
      if (!id) return
      const box = el.getBoundingClientRect()
      const intersects =
        rect.left <= box.right &&
        rect.right >= box.left &&
        rect.top <= box.bottom &&
        rect.bottom >= box.top
      if (intersects) ids.push(id)
    })
    dispatch({ type: 'SET_SELECTED_FOLDERS', ids })
  }

  const onDesktopPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if (e.target !== e.currentTarget) return
    dispatch({ type: 'SET_SELECTED_FOLDERS', ids: [] })
    const desk = desktopRef.current
    if (!desk) return
    desk.setPointerCapture(e.pointerId)
    selectionRef.current = {
      pointerId: e.pointerId,
      originX: e.clientX,
      originY: e.clientY,
      active: false,
    }
    setSelectionBox(null)
  }

  const onDesktopPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const sel = selectionRef.current
    if (!sel || sel.pointerId !== e.pointerId) return
    const dx = e.clientX - sel.originX
    const dy = e.clientY - sel.originY
    const dist = dx * dx + dy * dy
    if (!sel.active && dist < 9) return
    sel.active = true
    const desk = desktopRef.current
    if (!desk) return
    const rect = desk.getBoundingClientRect()
    const left = Math.min(sel.originX, e.clientX)
    const right = Math.max(sel.originX, e.clientX)
    const top = Math.min(sel.originY, e.clientY)
    const bottom = Math.max(sel.originY, e.clientY)
    setSelectionBox({
      x: left - rect.left,
      y: top - rect.top,
      width: right - left,
      height: bottom - top,
    })
    updateSelectionFromRect({ left, top, right, bottom })
  }

  const onDesktopPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const sel = selectionRef.current
    if (!sel || sel.pointerId !== e.pointerId) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    selectionRef.current = null
    setSelectionBox(null)
  }

  const folderById = (id: string) =>
    state.folders.find((f) => f.id === id) ??
    state.applications.find((a) => a.id === id) ??
    (state.trashFolder.id === id ? state.trashFolder : undefined)
  const notesFolder = state.folders.find((f) => f.kind === 'notes')
  const calendarApp = state.applications.find((a) => a.kind === 'calendar')
  const minimizedWindows = state.windows.filter((w) => w.minimized)
  const visibleWindows = state.windows.filter((w) => !w.minimized)
  const frontWindow =
    visibleWindows.length > 0
      ? visibleWindows.reduce((a, b) => (b.z > a.z ? b : a))
      : null
  const frontFolderKind = frontWindow ? folderById(frontWindow.folderId)?.kind ?? null : null
  const multiSelect = state.selectedFolderIds.length > 1

  useEffect(() => {
    if (!open) return
    dispatch({ type: 'SET_ACTIVE_MENU', menu: null })
  }, [open, frontFolderKind, dispatch])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.overlay}
          role="application"
          aria-label="Portfolio desktop mode"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{ background: wallpaper.background }}
        >
          <button
            type="button"
            className={styles.closeOs}
            onClick={onClose}
            aria-label="Close desktop mode"
          >
            <span aria-hidden>✕</span>
          </button>

          <MenuBar
            ref={menuBarRef}
            activeMenu={state.activeMenu}
            dispatch={dispatch}
            selectedFolderId={state.selectedFolderId}
            selectedFolderCount={state.selectedFolderIds.length}
            canUndo={canUndo}
            canRedo={canRedo}
            frontWindowKind={frontFolderKind}
          />

          <div
            ref={desktopRef}
            className={`${styles.desktop} ${minimizedWindows.length > 0 ? styles.desktopWithToolbar : ''}`}
            onContextMenu={onDesktopContextMenu}
            onPointerDown={onDesktopPointerDown}
            onPointerMove={onDesktopPointerMove}
            onPointerUp={onDesktopPointerUp}
            onPointerCancel={onDesktopPointerUp}
          >
            {useStacks
              ? buildStacks(
                  state.folders,
                  stackGroupBy,
                  desktopRef.current?.clientWidth ?? window.innerWidth
                ).map((stack) => (
                  <StackItem
                    key={stack.id}
                    stack={stack}
                    selected={stack.folders.some((f) =>
                      state.selectedFolderIds.includes(f.id)
                    )}
                    dispatch={dispatch}
                  />
                ))
              : state.folders.map((f) => (
                  <DesktopFolder
                    key={f.id}
                    folder={f}
                    selected={state.selectedFolderIds.includes(f.id)}
                    selectedCount={state.selectedFolderIds.length}
                    isRenaming={state.renamingFolderId === f.id}
                    dispatch={dispatch}
                    desktopRef={desktopRef}
                  />
                ))}

            {selectionBox && (
              <div
                className={styles.selectionBox}
                style={{
                  left: selectionBox.x,
                  top: selectionBox.y,
                  width: selectionBox.width,
                  height: selectionBox.height,
                }}
              />
            )}

            {visibleWindows.map((w) => (
              <FinderWindow
                key={w.id}
                win={w}
                folder={folderById(w.folderId)}
                dispatch={dispatch}
                desktopRef={desktopRef}
                notes={state.notes}
                selectedNoteId={state.selectedNoteId}
                folders={state.folders}
                notesFolder={notesFolder}
                applications={state.applications}
                trashedFolders={state.trashedFolders}
              />
            ))}
          </div>

          <MinimizedWindowsBar
            windows={minimizedWindows}
            folderLabel={(folderId) => folderById(folderId)?.label}
            folderKind={(folderId) => folderById(folderId)?.kind}
            dispatch={dispatch}
          />

          <Dock
            notesFolder={notesFolder}
            calendarApp={calendarApp}
            trashFolder={state.trashFolder}
            trashedCount={state.trashedFolders.length}
            windows={state.windows}
            dispatch={dispatch}
          />

          {state.contextMenu && (
            <button
              type="button"
              className={styles.backdrop}
              aria-label="Dismiss desktop menu"
              onClick={dismissContextMenu}
            />
          )}

          {state.contextMenu && (
            <div
              className={styles.contextMenu}
              style={{
                left: Math.max(
                  8,
                  Math.min(
                    state.contextMenu.x,
                    window.innerWidth - (state.contextMenu.folderId ? 200 : 216)
                  )
                ),
                top: Math.max(8, Math.min(state.contextMenu.y, window.innerHeight - 132)),
              }}
              role="menu"
            >
              {multiSelect ? (
                <button
                  type="button"
                  className={styles.menuItem}
                  role="menuitem"
                  onClick={() => {
                    if (state.selectedFolderIds.length === 0) return
                    dispatch({ type: 'REMOVE_FOLDERS', ids: state.selectedFolderIds })
                  }}
                >
                  Delete
                </button>
              ) : state.contextMenu.folderId ? (
                <>
                  <button
                    type="button"
                    className={styles.menuItem}
                    role="menuitem"
                    onClick={() => {
                      const id = state.contextMenu?.folderId
                      if (id) dispatch({ type: 'START_RENAME_FOLDER', id })
                    }}
                  >
                    Rename
                  </button>
                  <div className={styles.menuSep} />
                  <button
                    type="button"
                    className={styles.menuItem}
                    role="menuitem"
                    onClick={() => {
                      const id = state.contextMenu?.folderId
                      if (id) dispatch({ type: 'REMOVE_FOLDER', id })
                    }}
                  >
                    Move to Trash
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.menuItem}
                    role="menuitem"
                    onClick={() => dispatch({ type: 'NEW_FOLDER' })}
                  >
                    New Folder
                  </button>
                  <div className={styles.menuSep} />
                  <button
                    type="button"
                    className={styles.menuItem}
                    role="menuitemcheckbox"
                    aria-checked={useStacks}
                    onClick={() => setUseStacks((v) => !v)}
                  >
                    <span className={styles.menuItemCheck}>
                      {useStacks ? '✓' : ''}
                    </span>
                    <span>Use Stacks</span>
                  </button>
                  <div
                    className={`${styles.menuItemRow} ${!useStacks ? styles.menuItemDisabled : ''}`}
                    onMouseEnter={() => {
                      if (useStacks) setStackSubmenuOpen(true)
                    }}
                    onMouseLeave={() => setStackSubmenuOpen(false)}
                  >
                    <button
                      type="button"
                      className={`${styles.menuItem} ${styles.menuItemWithSubmenu}`}
                      role="menuitem"
                      disabled={!useStacks}
                      aria-haspopup="menu"
                      aria-expanded={stackSubmenuOpen}
                      onClick={() => {
                        if (useStacks) setStackSubmenuOpen((v) => !v)
                      }}
                    >
                      <span className={styles.menuItemCheck} />
                      <span className={styles.menuItemLabel}>Group Stack By</span>
                      <span className={styles.menuItemChevron} aria-hidden>
                        ▸
                      </span>
                    </button>
                    {useStacks && stackSubmenuOpen && (
                      <div className={styles.submenu} role="menu">
                        {(
                          [
                            ['added', 'Date Added'],
                            ['modified', 'Date Modified'],
                            ['created', 'Date Created'],
                            ['opened', 'Date Last Opened'],
                          ] as const
                        ).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            className={styles.menuItem}
                            role="menuitemradio"
                            aria-checked={stackGroupBy === id}
                            onClick={() => {
                              setStackGroupBy(id)
                              setStackSubmenuOpen(false)
                              dispatch({ type: 'CLOSE_CONTEXT_MENU' })
                            }}
                          >
                            <span className={styles.menuItemCheck}>
                              {stackGroupBy === id ? '✓' : ''}
                            </span>
                            <span>{label}</span>
                          </button>
                        ))}
                        <div className={styles.menuSep} />
                        <button
                          type="button"
                          className={styles.menuItem}
                          role="menuitemradio"
                          aria-checked={stackGroupBy === 'kind'}
                          onClick={() => {
                            setStackGroupBy('kind')
                            setStackSubmenuOpen(false)
                            dispatch({ type: 'CLOSE_CONTEXT_MENU' })
                          }}
                        >
                          <span className={styles.menuItemCheck}>
                            {stackGroupBy === 'kind' ? '✓' : ''}
                          </span>
                          <span>Kind</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className={styles.menuSep} />
                  <button
                    type="button"
                    className={styles.menuItem}
                    role="menuitem"
                    onClick={() => dispatch({ type: 'OPEN_WALLPAPER_PICKER' })}
                  >
                    Change Wallpaper…
                  </button>
                </>
              )}
            </div>
          )}

          {state.wallpaperPickerOpen && (
            <>
              <button
                type="button"
                className={styles.modalBackdrop}
                aria-label="Close wallpaper picker"
                onClick={() => dispatch({ type: 'CLOSE_WALLPAPER_PICKER' })}
              />
              <div className={styles.modal} role="dialog" aria-labelledby="wp-title">
                <div id="wp-title" className={styles.modalHeader}>
                  Desktop &amp; Screen Saver
                </div>
                <div className={styles.modalGrid}>
                  {WALLPAPERS.map((w) => (
                    <div key={w.id}>
                      <button
                        type="button"
                        className={`${styles.wallpaperSwatch} ${state.wallpaperId === w.id ? styles.wallpaperSwatchActive : ''}`}
                        style={{ background: w.background }}
                        onClick={() => dispatch({ type: 'SET_WALLPAPER', id: w.id })}
                        aria-label={`Select wallpaper ${w.name}`}
                        aria-pressed={state.wallpaperId === w.id}
                      />
                      <div className={styles.wallpaperName}>{w.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
