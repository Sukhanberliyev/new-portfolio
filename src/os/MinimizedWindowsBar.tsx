import type { FolderKind, OpenFinderWindow } from './osTypes'
import type { HistoryAction } from './osHistoryReducer'
import styles from './OSMode.module.css'

interface MinimizedWindowsBarProps {
  windows: OpenFinderWindow[]
  folderLabel: (folderId: string) => string | undefined
  folderKind: (folderId: string) => FolderKind | undefined
  dispatch: React.Dispatch<HistoryAction>
}

export default function MinimizedWindowsBar({
  windows,
  folderLabel,
  folderKind,
  dispatch,
}: MinimizedWindowsBarProps) {
  if (windows.length === 0) return null

  const ordered = [...windows].sort((a, b) => a.z - b.z)

  return (
    <div
      className={styles.minimizedToolbar}
      role="toolbar"
      aria-label="Minimized windows"
    >
      {ordered.map((w) => {
        const label = folderLabel(w.folderId) ?? 'Folder'
        const kind = folderKind(w.folderId)
        const icon = kind === 'notes' ? '🗒️' : kind === 'trash' ? '🗑️' : '📁'
        return (
          <button
            key={w.id}
            type="button"
            className={styles.minimizedTile}
            onClick={() => dispatch({ type: 'RESTORE_WINDOW', windowId: w.id })}
            title={`Open ${label}`}
          >
            <span className={styles.minimizedTileIcon} aria-hidden>
              {icon}
            </span>
            <span className={styles.minimizedTileLabel}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
