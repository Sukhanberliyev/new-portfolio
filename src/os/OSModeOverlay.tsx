import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import MenuBar from './MenuBar'
import DesktopFolder from './DesktopFolder'
import FinderWindow from './FinderWindow'
import MinimizedWindowsBar from './MinimizedWindowsBar'
import Dock from './Dock'
import type { OSReducerState } from './osReducer'
import type { HistoryAction } from './osHistoryReducer'
import { WALLPAPERS } from './wallpapers'
import styles from './OSMode.module.css'

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
    (state.trashFolder.id === id ? state.trashFolder : undefined)
  const notesFolder = state.folders.find((f) => f.kind === 'notes')
  const minimizedWindows = state.windows.filter((w) => w.minimized)
  const visibleWindows = state.windows.filter((w) => !w.minimized)
  const frontWindow =
    visibleWindows.length > 0
      ? visibleWindows.reduce((a, b) => (b.z > a.z ? b : a))
      : null
  const frontFolderKind = frontWindow ? folderById(frontWindow.folderId)?.kind ?? null : null
  const multiSelect = state.selectedFolderIds.length > 1

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
            {state.folders.map((f) => (
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
