import { forwardRef, useEffect, useState } from 'react'
import type { FolderKind, MenuBarId } from './osTypes'
import type { HistoryAction } from './osHistoryReducer'
import styles from './OSMode.module.css'

interface MenuBarProps {
  activeMenu: MenuBarId | null
  dispatch: React.Dispatch<HistoryAction>
  selectedFolderId: string | null
  selectedFolderCount: number
  canUndo: boolean
  canRedo: boolean
  frontWindowKind: FolderKind | null
}

function formatMenuClock(now: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(now)
}

const MenuBar = forwardRef<HTMLElement, MenuBarProps>(function MenuBar(
  {
    activeMenu,
    dispatch,
    selectedFolderId,
    selectedFolderCount,
    canUndo,
    canRedo,
    frontWindowKind,
  },
  ref
) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const toggle = (id: MenuBarId) => {
    dispatch({ type: 'SET_ACTIVE_MENU', menu: activeMenu === id ? null : id })
  }

  const notesMenuActive = frontWindowKind === 'notes'

  return (
    <header ref={ref} className={styles.menuBar}>
      <div className={styles.menuLeft}>
        <div className={styles.menuWrap}>
          <button
            type="button"
            className={`${styles.menuTrigger} ${styles.menuTriggerBold} ${activeMenu === 'finder' ? styles.menuTriggerActive : ''}`}
            onClick={() => toggle('finder')}
          >
            Finder
          </button>
          {activeMenu === 'finder' && (
            <div className={styles.dropdown}>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => dispatch({ type: 'SET_ACTIVE_MENU', menu: null })}
              >
                About Portfolio OS
              </button>
              <div className={styles.menuSep} />
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => dispatch({ type: 'SET_ACTIVE_MENU', menu: null })}
              >
                Preferences…
              </button>
            </div>
          )}
        </div>

        <div className={styles.menuWrap}>
          <button
            type="button"
            className={`${styles.menuTrigger} ${activeMenu === 'file' ? styles.menuTriggerActive : ''}`}
            onClick={() => toggle('file')}
          >
            File
          </button>
          {activeMenu === 'file' && (
            <div className={styles.dropdown}>
              {notesMenuActive && (
                <>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => {
                      dispatch({ type: 'NEW_NOTE' })
                      dispatch({ type: 'SET_ACTIVE_MENU', menu: null })
                    }}
                  >
                    New Note
                  </button>
                  <div className={styles.menuSep} />
                </>
              )}
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  dispatch({ type: 'NEW_FOLDER' })
                  dispatch({ type: 'SET_ACTIVE_MENU', menu: null })
                }}
              >
                New Folder
              </button>
              <button
                type="button"
                className={styles.menuItem}
                disabled={!selectedFolderId || selectedFolderCount > 1}
                onClick={() => {
                  if (!selectedFolderId || selectedFolderCount > 1) return
                  dispatch({ type: 'START_RENAME_FOLDER', id: selectedFolderId })
                  dispatch({ type: 'SET_ACTIVE_MENU', menu: null })
                }}
              >
                Rename…
              </button>
              <button
                type="button"
                className={styles.menuItem}
                disabled={!selectedFolderId || selectedFolderCount > 1}
                onClick={() => {
                  if (!selectedFolderId || selectedFolderCount > 1) return
                  dispatch({ type: 'REMOVE_FOLDER', id: selectedFolderId })
                  dispatch({ type: 'SET_ACTIVE_MENU', menu: null })
                }}
              >
                Move to Trash
              </button>
              <div className={styles.menuSep} />
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => dispatch({ type: 'CLOSE_FRONT_WINDOW' })}
              >
                Close Window
              </button>
            </div>
          )}
        </div>

        <div className={styles.menuWrap}>
          <button
            type="button"
            className={`${styles.menuTrigger} ${activeMenu === 'edit' ? styles.menuTriggerActive : ''}`}
            onClick={() => toggle('edit')}
          >
            Edit
          </button>
          {activeMenu === 'edit' && (
            <div className={styles.dropdown}>
              <button
                type="button"
                className={styles.menuItem}
                disabled={!canUndo}
                onClick={() => {
                  dispatch({ type: 'UNDO' })
                  dispatch({ type: 'SET_ACTIVE_MENU', menu: null })
                }}
              >
                Undo
              </button>
              <button
                type="button"
                className={styles.menuItem}
                disabled={!canRedo}
                onClick={() => {
                  dispatch({ type: 'REDO' })
                  dispatch({ type: 'SET_ACTIVE_MENU', menu: null })
                }}
              >
                Redo
              </button>
            </div>
          )}
        </div>

        <div className={styles.menuWrap}>
          <button
            type="button"
            className={`${styles.menuTrigger} ${activeMenu === 'view' ? styles.menuTriggerActive : ''}`}
            onClick={() => toggle('view')}
          >
            View
          </button>
          {activeMenu === 'view' && (
            <div className={styles.dropdown}>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => dispatch({ type: 'SET_ACTIVE_MENU', menu: null })}
              >
                Show Desktop
              </button>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => dispatch({ type: 'SET_ACTIVE_MENU', menu: null })}
              >
                Enter Full Screen
              </button>
            </div>
          )}
        </div>

        <div className={styles.menuWrap}>
          <button
            type="button"
            className={`${styles.menuTrigger} ${activeMenu === 'go' ? styles.menuTriggerActive : ''}`}
            onClick={() => toggle('go')}
          >
            Go
          </button>
          {activeMenu === 'go' && (
            <div className={styles.dropdown}>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => dispatch({ type: 'SET_ACTIVE_MENU', menu: null })}
              >
                Recent Folders
              </button>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => dispatch({ type: 'SET_ACTIVE_MENU', menu: null })}
              >
                Desktop
              </button>
            </div>
          )}
        </div>

        <div className={styles.menuWrap}>
          <button
            type="button"
            className={`${styles.menuTrigger} ${activeMenu === 'help' ? styles.menuTriggerActive : ''}`}
            onClick={() => toggle('help')}
          >
            Help
          </button>
          {activeMenu === 'help' && (
            <div className={styles.dropdown}>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => dispatch({ type: 'SET_ACTIVE_MENU', menu: null })}
              >
                Portfolio OS Help
              </button>
            </div>
          )}
        </div>
      </div>

      <span className={styles.clock}>{formatMenuClock(now)}</span>
    </header>
  )
})

export default MenuBar
