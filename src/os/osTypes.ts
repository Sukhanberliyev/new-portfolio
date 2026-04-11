export type FolderKind = 'about' | 'projects' | 'playground' | 'contact' | 'custom'

export interface DesktopFolderItem {
  id: string
  label: string
  x: number
  y: number
  kind: FolderKind
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
