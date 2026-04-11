import {
  createDefaultFolders,
  nextCustomFolderId,
  nextUntitledName,
} from './defaultFolders'
import type {
  ContextMenuState,
  DesktopFolderItem,
  MenuBarId,
  OpenFinderWindow,
} from './osTypes'
import {
  FINDER_DEFAULT_HEIGHT,
  FINDER_DEFAULT_WIDTH,
} from './finderLayout'
import { DEFAULT_WALLPAPER_ID } from './wallpapers'

export interface OSReducerState {
  wallpaperId: string
  folders: DesktopFolderItem[]
  selectedFolderId: string | null
  renamingFolderId: string | null
  contextMenu: ContextMenuState | null
  activeMenu: MenuBarId | null
  wallpaperPickerOpen: boolean
  windows: OpenFinderWindow[]
  nextWindowZ: number
}

export const initialOSState: OSReducerState = {
  wallpaperId: DEFAULT_WALLPAPER_ID,
  folders: createDefaultFolders(),
  selectedFolderId: null,
  renamingFolderId: null,
  contextMenu: null,
  activeMenu: null,
  wallpaperPickerOpen: false,
  windows: [],
  nextWindowZ: 10,
}

export type OSAction =
  | { type: 'RESET_SESSION' }
  | { type: 'SET_WALLPAPER'; id: string }
  | { type: 'MOVE_FOLDER'; id: string; x: number; y: number }
  | { type: 'SELECT_FOLDER'; id: string | null }
  | { type: 'OPEN_CONTEXT_MENU'; x: number; y: number; folderId?: string }
  | { type: 'REMOVE_FOLDER'; id: string }
  | { type: 'CLOSE_CONTEXT_MENU' }
  | { type: 'SET_ACTIVE_MENU'; menu: MenuBarId | null }
  | { type: 'OPEN_WALLPAPER_PICKER' }
  | { type: 'CLOSE_WALLPAPER_PICKER' }
  | { type: 'NEW_FOLDER' }
  | { type: 'OPEN_FINDER'; folderId: string }
  | { type: 'CLOSE_WINDOW'; windowId: string }
  | { type: 'CLOSE_FRONT_WINDOW' }
  | { type: 'MOVE_WINDOW'; windowId: string; x: number; y: number }
  | {
      type: 'RESIZE_WINDOW'
      windowId: string
      x: number
      y: number
      width: number
      height: number
    }
  | { type: 'FOCUS_WINDOW'; windowId: string }
  | { type: 'MINIMIZE_WINDOW'; windowId: string }
  | { type: 'RESTORE_WINDOW'; windowId: string }
  | { type: 'START_RENAME_FOLDER'; id: string }
  | { type: 'CANCEL_RENAME_FOLDER' }
  | { type: 'RENAME_FOLDER'; id: string; label: string }

function defaultPositionForNewFolder(folders: DesktopFolderItem[]): { x: number; y: number } {
  const baseX = 24
  const baseY = 488
  const step = 28
  const idx = folders.filter((f) => f.kind === 'custom').length
  return { x: baseX + (idx % 4) * step, y: baseY + Math.floor(idx / 4) * step }
}

export function osReducer(state: OSReducerState, action: OSAction): OSReducerState {
  switch (action.type) {
    case 'RESET_SESSION':
      return { ...initialOSState, folders: createDefaultFolders() }
    case 'SET_WALLPAPER':
      return { ...state, wallpaperId: action.id, wallpaperPickerOpen: false }
    case 'MOVE_FOLDER':
      return {
        ...state,
        folders: state.folders.map((f) =>
          f.id === action.id ? { ...f, x: action.x, y: action.y } : f
        ),
      }
    case 'SELECT_FOLDER': {
      const rid = state.renamingFolderId
      const cancelRename =
        rid !== null && action.id !== rid
      return {
        ...state,
        selectedFolderId: action.id,
        renamingFolderId: cancelRename ? null : rid,
      }
    }
    case 'OPEN_CONTEXT_MENU':
      return {
        ...state,
        contextMenu: {
          x: action.x,
          y: action.y,
          ...(action.folderId !== undefined ? { folderId: action.folderId } : {}),
        },
        activeMenu: null,
      }
    case 'CLOSE_CONTEXT_MENU':
      return { ...state, contextMenu: null }
    case 'SET_ACTIVE_MENU':
      return { ...state, activeMenu: action.menu, contextMenu: null }
    case 'OPEN_WALLPAPER_PICKER':
      return {
        ...state,
        wallpaperPickerOpen: true,
        renamingFolderId: null,
        contextMenu: null,
        activeMenu: null,
      }
    case 'CLOSE_WALLPAPER_PICKER':
      return { ...state, wallpaperPickerOpen: false }
    case 'REMOVE_FOLDER': {
      const id = action.id
      if (!state.folders.some((f) => f.id === id)) return state
      return {
        ...state,
        folders: state.folders.filter((f) => f.id !== id),
        windows: state.windows.filter((w) => w.folderId !== id),
        selectedFolderId: state.selectedFolderId === id ? null : state.selectedFolderId,
        renamingFolderId: state.renamingFolderId === id ? null : state.renamingFolderId,
        contextMenu: null,
        activeMenu: null,
      }
    }
    case 'NEW_FOLDER': {
      const labels = state.folders.map((f) => f.label)
      const pos = defaultPositionForNewFolder(state.folders)
      const folder: DesktopFolderItem = {
        id: nextCustomFolderId(),
        label: nextUntitledName(labels),
        x: pos.x,
        y: pos.y,
        kind: 'custom',
      }
      return {
        ...state,
        folders: [...state.folders, folder],
        selectedFolderId: folder.id,
        renamingFolderId: null,
        contextMenu: null,
        activeMenu: null,
      }
    }
    case 'OPEN_FINDER': {
      const existing = state.windows.find((w) => w.folderId === action.folderId)
      if (existing) {
        return {
          ...state,
          renamingFolderId: null,
          windows: state.windows.map((w) =>
            w.folderId === action.folderId
              ? {
                  ...w,
                  minimized: false,
                  z: state.nextWindowZ,
                }
              : w
          ),
          nextWindowZ: state.nextWindowZ + 1,
          selectedFolderId: action.folderId,
        }
      }
      const w: OpenFinderWindow = {
        id: `win-${action.folderId}-${state.nextWindowZ}`,
        folderId: action.folderId,
        x: Math.min(120 + state.windows.length * 24, typeof window !== 'undefined' ? window.innerWidth - 400 : 480),
        y: 80 + state.windows.length * 28,
        z: state.nextWindowZ,
        minimized: false,
        width: FINDER_DEFAULT_WIDTH,
        height: FINDER_DEFAULT_HEIGHT,
      }
      return {
        ...state,
        renamingFolderId: null,
        windows: [...state.windows, w],
        nextWindowZ: state.nextWindowZ + 1,
        selectedFolderId: action.folderId,
      }
    }
    case 'CLOSE_WINDOW':
      return {
        ...state,
        windows: state.windows.filter((w) => w.id !== action.windowId),
      }
    case 'CLOSE_FRONT_WINDOW': {
      const visible = state.windows.filter((w) => !w.minimized)
      if (visible.length === 0) return { ...state, activeMenu: null }
      const top = visible.reduce((a, b) => (b.z > a.z ? b : a))
      return {
        ...state,
        windows: state.windows.filter((w) => w.id !== top.id),
        activeMenu: null,
      }
    }
    case 'MOVE_WINDOW':
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.windowId ? { ...w, x: action.x, y: action.y } : w
        ),
      }
    case 'RESIZE_WINDOW':
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.windowId
            ? {
                ...w,
                x: action.x,
                y: action.y,
                width: action.width,
                height: action.height,
              }
            : w
        ),
      }
    case 'FOCUS_WINDOW':
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.windowId ? { ...w, z: state.nextWindowZ } : w
        ),
        nextWindowZ: state.nextWindowZ + 1,
      }
    case 'MINIMIZE_WINDOW':
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.windowId ? { ...w, minimized: true } : w
        ),
      }
    case 'RESTORE_WINDOW': {
      const win = state.windows.find((w) => w.id === action.windowId)
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.windowId
            ? { ...w, minimized: false, z: state.nextWindowZ }
            : w
        ),
        nextWindowZ: state.nextWindowZ + 1,
        selectedFolderId: win?.folderId ?? state.selectedFolderId,
      }
    }
    case 'START_RENAME_FOLDER':
      return {
        ...state,
        renamingFolderId: action.id,
        selectedFolderId: action.id,
        contextMenu: null,
        activeMenu: null,
      }
    case 'CANCEL_RENAME_FOLDER':
      return { ...state, renamingFolderId: null }
    case 'RENAME_FOLDER': {
      const trimmed = action.label.trim().slice(0, 120)
      if (!trimmed) {
        return { ...state, renamingFolderId: null }
      }
      const current = state.folders.find((f) => f.id === action.id)
      if (!current) {
        return { ...state, renamingFolderId: null }
      }
      if (current.label === trimmed) {
        return { ...state, renamingFolderId: null }
      }
      return {
        ...state,
        renamingFolderId: null,
        folders: state.folders.map((f) =>
          f.id === action.id ? { ...f, label: trimmed } : f
        ),
      }
    }
    default:
      return state
  }
}
