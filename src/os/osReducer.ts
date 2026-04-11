import {
  createDefaultFolders,
  nextCustomFolderId,
  nextUntitledName,
} from './defaultFolders'
import { createDefaultNotes, nextNoteId } from './notesData'
import { createTrashFolder } from './trashData'
import type {
  ContextMenuState,
  DesktopFolderItem,
  MenuBarId,
  NoteItem,
  OpenFinderWindow,
} from './osTypes'
import {
  clampFinderRect,
  FINDER_DEFAULT_HEIGHT,
  FINDER_DEFAULT_WIDTH,
  resolveFinderSize,
} from './finderLayout'
import { DEFAULT_WALLPAPER_ID } from './wallpapers'

export interface OSReducerState {
  wallpaperId: string
  folders: DesktopFolderItem[]
  trashFolder: DesktopFolderItem
  trashedFolders: DesktopFolderItem[]
  selectedFolderId: string | null
  selectedFolderIds: string[]
  renamingFolderId: string | null
  contextMenu: ContextMenuState | null
  activeMenu: MenuBarId | null
  wallpaperPickerOpen: boolean
  windows: OpenFinderWindow[]
  nextWindowZ: number
  notes: NoteItem[]
  selectedNoteId: string | null
}

const defaultNotes = createDefaultNotes()
const defaultTrashFolder = createTrashFolder()

export const initialOSState: OSReducerState = {
  wallpaperId: DEFAULT_WALLPAPER_ID,
  folders: createDefaultFolders(),
  trashFolder: defaultTrashFolder,
  trashedFolders: [],
  selectedFolderId: null,
  selectedFolderIds: [],
  renamingFolderId: null,
  contextMenu: null,
  activeMenu: null,
  wallpaperPickerOpen: false,
  windows: [],
  nextWindowZ: 10,
  notes: defaultNotes,
  selectedNoteId: defaultNotes[0]?.id ?? null,
}

export type OSAction =
  | { type: 'RESET_SESSION' }
  | { type: 'SET_WALLPAPER'; id: string }
  | { type: 'MOVE_FOLDER'; id: string; x: number; y: number }
  | { type: 'SELECT_FOLDER'; id: string | null }
  | { type: 'SET_SELECTED_FOLDERS'; ids: string[] }
  | { type: 'OPEN_CONTEXT_MENU'; x: number; y: number; folderId?: string }
  | { type: 'REMOVE_FOLDER'; id: string }
  | { type: 'REMOVE_FOLDERS'; ids: string[] }
  | { type: 'REMOVE_TRASH_ITEMS'; ids: string[] }
  | { type: 'EMPTY_TRASH' }
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
  | {
      type: 'TOGGLE_WINDOW_ZOOM'
      windowId: string
      desktopWidth: number
      desktopHeight: number
    }
  | { type: 'FOCUS_WINDOW'; windowId: string }
  | { type: 'MINIMIZE_WINDOW'; windowId: string }
  | { type: 'RESTORE_WINDOW'; windowId: string }
  | { type: 'START_RENAME_FOLDER'; id: string }
  | { type: 'CANCEL_RENAME_FOLDER' }
  | { type: 'RENAME_FOLDER'; id: string; label: string }
  | { type: 'NEW_NOTE' }
  | { type: 'DELETE_NOTE'; id: string }
  | { type: 'SELECT_NOTE'; id: string | null }
  | { type: 'UPDATE_NOTE_CONTENT'; id: string; content: string }

function defaultPositionForNewFolder(folders: DesktopFolderItem[]): { x: number; y: number } {
  const baseX = 24
  const baseY = 488
  const step = 28
  const idx = folders.filter((f) => f.kind === 'custom').length
  return { x: baseX + (idx % 4) * step, y: baseY + Math.floor(idx / 4) * step }
}

export function osReducer(state: OSReducerState, action: OSAction): OSReducerState {
  switch (action.type) {
    case 'RESET_SESSION': {
      const notes = createDefaultNotes()
      return {
        ...initialOSState,
        folders: createDefaultFolders(),
        trashFolder: createTrashFolder(),
        trashedFolders: [],
        selectedFolderIds: [],
        notes,
        selectedNoteId: notes[0]?.id ?? null,
      }
    }
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
        selectedFolderIds: action.id ? [action.id] : [],
        renamingFolderId: cancelRename ? null : rid,
      }
    }
    case 'SET_SELECTED_FOLDERS': {
      const unique = Array.from(new Set(action.ids))
      return {
        ...state,
        selectedFolderIds: unique,
        selectedFolderId: unique.length === 1 ? unique[0] : null,
        renamingFolderId: unique.length === 1 ? state.renamingFolderId : null,
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
      const removing = state.folders.find((f) => f.id === id)
      if (!removing) return state
      return {
        ...state,
        folders: state.folders.filter((f) => f.id !== id),
        windows: state.windows.filter((w) => w.folderId !== id),
        trashedFolders: [removing, ...state.trashedFolders],
        selectedFolderId: state.selectedFolderId === id ? null : state.selectedFolderId,
        selectedFolderIds: state.selectedFolderIds.filter((fid) => fid !== id),
        renamingFolderId: state.renamingFolderId === id ? null : state.renamingFolderId,
        contextMenu: null,
        activeMenu: null,
      }
    }
    case 'REMOVE_FOLDERS': {
      const ids = new Set(action.ids)
      if (ids.size === 0) return state
      const removed = state.folders.filter((f) => ids.has(f.id))
      return {
        ...state,
        folders: state.folders.filter((f) => !ids.has(f.id)),
        windows: state.windows.filter((w) => !ids.has(w.folderId)),
        trashedFolders: removed.length > 0 ? [...removed, ...state.trashedFolders] : state.trashedFolders,
        selectedFolderId: ids.has(state.selectedFolderId ?? '') ? null : state.selectedFolderId,
        selectedFolderIds: state.selectedFolderIds.filter((fid) => !ids.has(fid)),
        renamingFolderId: ids.has(state.renamingFolderId ?? '') ? null : state.renamingFolderId,
        contextMenu: null,
        activeMenu: null,
      }
    }
    case 'REMOVE_TRASH_ITEMS': {
      const ids = new Set(action.ids)
      if (ids.size === 0) return state
      return {
        ...state,
        trashedFolders: state.trashedFolders.filter((f) => !ids.has(f.id)),
      }
    }
    case 'EMPTY_TRASH':
      return {
        ...state,
        trashedFolders: [],
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
        selectedFolderIds: [folder.id],
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
          selectedFolderIds: [action.folderId],
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
        selectedFolderIds: [action.folderId],
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
          w.id === action.windowId
            ? {
                ...w,
                x: action.x,
                y: action.y,
                ...(w.maximized ? { maximized: false, restoreBounds: undefined } : {}),
              }
            : w
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
                maximized: false,
                restoreBounds: undefined,
              }
            : w
        ),
      }
    case 'TOGGLE_WINDOW_ZOOM': {
      const w = state.windows.find((win) => win.id === action.windowId)
      if (!w) return state
      const margin = 8
      if (w.maximized && w.restoreBounds) {
        const rb = w.restoreBounds
        return {
          ...state,
          windows: state.windows.map((win) =>
            win.id === action.windowId
              ? {
                  ...win,
                  x: rb.x,
                  y: rb.y,
                  width: rb.width,
                  height: rb.height,
                  maximized: false,
                  restoreBounds: undefined,
                  z: state.nextWindowZ,
                }
              : win
          ),
          nextWindowZ: state.nextWindowZ + 1,
        }
      }
      const size = resolveFinderSize(w)
      const full = clampFinderRect(
        action.desktopWidth,
        action.desktopHeight,
        margin,
        margin,
        action.desktopWidth - margin * 2,
        action.desktopHeight - margin * 2
      )
      return {
        ...state,
        windows: state.windows.map((win) =>
          win.id === action.windowId
            ? {
                ...win,
                restoreBounds: { x: w.x, y: w.y, width: size.width, height: size.height },
                x: full.x,
                y: full.y,
                width: full.width,
                height: full.height,
                maximized: true,
                z: state.nextWindowZ,
              }
            : win
        ),
        nextWindowZ: state.nextWindowZ + 1,
      }
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
        selectedFolderIds: win?.folderId ? [win.folderId] : state.selectedFolderIds,
      }
    }
    case 'START_RENAME_FOLDER':
      return {
        ...state,
        renamingFolderId: action.id,
        selectedFolderId: action.id,
        selectedFolderIds: [action.id],
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
    case 'NEW_NOTE': {
      const note: NoteItem = {
        id: nextNoteId(),
        content: '',
        createdAt: Date.now(),
      }
      return {
        ...state,
        notes: [note, ...state.notes],
        selectedNoteId: note.id,
      }
    }
    case 'DELETE_NOTE': {
      const idx = state.notes.findIndex((n) => n.id === action.id)
      if (idx === -1) return state
      const nextNotes = state.notes.filter((n) => n.id !== action.id)
      let nextSelected = state.selectedNoteId
      if (action.id === state.selectedNoteId) {
        const candidate = nextNotes[idx] ?? nextNotes[idx - 1] ?? null
        nextSelected = candidate?.id ?? null
      }
      return {
        ...state,
        notes: nextNotes,
        selectedNoteId: nextSelected,
      }
    }
    case 'SELECT_NOTE':
      return { ...state, selectedNoteId: action.id }
    case 'UPDATE_NOTE_CONTENT':
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.id ? { ...n, content: action.content } : n
        ),
      }
    default:
      return state
  }
}
