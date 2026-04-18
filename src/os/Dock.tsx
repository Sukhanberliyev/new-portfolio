import type { DesktopFolderItem, OpenFinderWindow } from './osTypes'
import type { HistoryAction } from './osHistoryReducer'
import styles from './OSMode.module.css'

interface DockProps {
  notesFolder: DesktopFolderItem | undefined
  calendarApp: DesktopFolderItem | undefined
  trashFolder: DesktopFolderItem
  trashedCount: number
  windows: OpenFinderWindow[]
  dispatch: React.Dispatch<HistoryAction>
}

export default function Dock({
  notesFolder,
  calendarApp,
  trashFolder,
  trashedCount,
  windows,
  dispatch,
}: DockProps) {
  const notesOpen = Boolean(
    notesFolder && windows.some((win) => win.folderId === notesFolder.id && !win.minimized)
  )
  const notesRunning = Boolean(
    notesFolder && windows.some((win) => win.folderId === notesFolder.id)
  )
  const calendarOpen = Boolean(
    calendarApp && windows.some((win) => win.folderId === calendarApp.id && !win.minimized)
  )
  const calendarRunning = Boolean(
    calendarApp && windows.some((win) => win.folderId === calendarApp.id)
  )
  const trashOpen = windows.some(
    (win) => win.folderId === trashFolder.id && !win.minimized
  )
  const trashHasItems = trashedCount > 0

  return (
    <div className={styles.dock} role="toolbar" aria-label="App Dock">
      <button
        type="button"
        className={`${styles.dockIcon} ${notesOpen ? styles.dockIconActive : ''}`}
        onClick={() => {
          if (!notesFolder) return
          dispatch({ type: 'OPEN_FINDER', folderId: notesFolder.id })
        }}
        title="Notes"
        disabled={!notesFolder}
      >
        <span className={styles.dockEmoji} aria-hidden>
          🗒️
        </span>
        <span className={styles.dockLabel}>Notes</span>
        {notesRunning && <span className={styles.dockIndicator} aria-hidden />}
      </button>

      {calendarApp && calendarRunning && (
        <button
          type="button"
          className={`${styles.dockIcon} ${calendarOpen ? styles.dockIconActive : ''}`}
          onClick={() => dispatch({ type: 'OPEN_FINDER', folderId: calendarApp.id })}
          title="Calendar"
        >
          <span className={styles.dockEmoji} aria-hidden>
            📅
          </span>
          <span className={styles.dockLabel}>Calendar</span>
          <span className={styles.dockIndicator} aria-hidden />
        </button>
      )}

      <button
        type="button"
        className={`${styles.dockIcon} ${trashOpen ? styles.dockIconActive : ''}`}
        onClick={() => dispatch({ type: 'OPEN_FINDER', folderId: trashFolder.id })}
        title="Trash"
      >
        <span className={styles.dockEmoji} aria-hidden>
          🗑️
        </span>
        <span className={styles.dockLabel}>Trash</span>
        {trashHasItems && <span className={styles.dockIndicator} aria-hidden />}
      </button>
    </div>
  )
}
