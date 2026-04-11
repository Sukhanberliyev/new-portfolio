import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import MenuBar from './MenuBar'
import DesktopFolder from './DesktopFolder'
import FinderWindow from './FinderWindow'
import MinimizedWindowsBar from './MinimizedWindowsBar'
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
      !state.selectedFolderId ||
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
      dispatch({ type: 'REMOVE_FOLDER', id: state.selectedFolderId! })
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [
    open,
    state.selectedFolderId,
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
      if (!state.selectedFolderId) return
      e.preventDefault()
      dispatch({ type: 'START_RENAME_FOLDER', id: state.selectedFolderId })
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [
    open,
    state.selectedFolderId,
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

  const folderById = (id: string) => state.folders.find((f) => f.id === id)
  const minimizedWindows = state.windows.filter((w) => w.minimized)
  const visibleWindows = state.windows.filter((w) => !w.minimized)

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
            canUndo={canUndo}
            canRedo={canRedo}
          />

          <div
            ref={desktopRef}
            className={`${styles.desktop} ${minimizedWindows.length > 0 ? styles.desktopWithToolbar : ''}`}
            onContextMenu={onDesktopContextMenu}
          >
            {state.folders.map((f) => (
              <DesktopFolder
                key={f.id}
                folder={f}
                selected={state.selectedFolderId === f.id}
                isRenaming={state.renamingFolderId === f.id}
                dispatch={dispatch}
                desktopRef={desktopRef}
              />
            ))}

            {visibleWindows.map((w) => (
              <FinderWindow
                key={w.id}
                win={w}
                folder={folderById(w.folderId)}
                dispatch={dispatch}
                desktopRef={desktopRef}
              />
            ))}
          </div>

          <MinimizedWindowsBar
            windows={minimizedWindows}
            folderLabel={(folderId) => folderById(folderId)?.label}
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
              {state.contextMenu.folderId ? (
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
