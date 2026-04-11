export type FolderKind =
  | 'about'
  | 'projects'
  | 'playground'
  | 'contact'
  | 'custom'
  | 'notes'

export interface DesktopFolderItem {
  id: string
  label: string
  x: number
  y: number
  kind: FolderKind
}

export interface NoteItem {
  id: string
  content: string
  createdAt: number
}

export interface WindowRestoreBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface OpenFinderWindow {
  id: string
  folderId: string
  x: number
  y: number
  z: number
  /** When true, window is hidden and shown in the bottom toolbar. */
  minimized: boolean
  /** Pixel size; omit in older snapshots — defaults applied in UI. */
  width?: number
  height?: number
  /** Fills the desktop; double-click title bar again restores `restoreBounds`. */
  maximized?: boolean
  restoreBounds?: WindowRestoreBounds
}

export interface WallpaperOption {
  id: string
  name: string
  background: string
}

export interface ContextMenuState {
  x: number
  y: number
  /** When set, menu is for this folder (e.g. Move to Trash). */
  folderId?: string
}

export type MenuBarId = 'finder' | 'file' | 'edit' | 'view' | 'go' | 'help'
