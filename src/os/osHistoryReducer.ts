import { initialOSState, osReducer, type OSAction, type OSReducerState } from './osReducer'

export type HistoryAction = OSAction | { type: 'UNDO' } | { type: 'REDO' }

export interface OSHistoryState {
  present: OSReducerState
  past: OSReducerState[]
  future: OSReducerState[]
}

export const initialHistoryState: OSHistoryState = {
  present: initialOSState,
  past: [],
  future: [],
}

const MAX_HISTORY = 50

function clonePresent(s: OSReducerState): OSReducerState {
  return structuredClone(s)
}

function isUndoable(action: OSAction): boolean {
  switch (action.type) {
    case 'MOVE_FOLDER':
    case 'MOVE_WINDOW':
    case 'RESIZE_WINDOW':
    case 'SET_WALLPAPER':
    case 'NEW_FOLDER':
    case 'REMOVE_FOLDER':
    case 'RENAME_FOLDER':
    case 'OPEN_FINDER':
    case 'CLOSE_WINDOW':
    case 'CLOSE_FRONT_WINDOW':
    case 'MINIMIZE_WINDOW':
    case 'RESTORE_WINDOW':
      return true
    default:
      return false
  }
}

export function osHistoryReducer(
  state: OSHistoryState,
  action: HistoryAction
): OSHistoryState {
  if (action.type === 'UNDO') {
    if (state.past.length === 0) return state
    const previous = state.past[state.past.length - 1]
    return {
      past: state.past.slice(0, -1),
      present: previous,
      future: [clonePresent(state.present), ...state.future].slice(0, MAX_HISTORY),
    }
  }

  if (action.type === 'REDO') {
    if (state.future.length === 0) return state
    const [next, ...restFuture] = state.future
    return {
      past: [...state.past, clonePresent(state.present)].slice(-MAX_HISTORY),
      present: next,
      future: restFuture,
    }
  }

  const osAction = action as OSAction
  if (!isUndoable(osAction)) {
    return {
      ...state,
      present: osReducer(state.present, osAction),
    }
  }

  return {
    past: [...state.past, clonePresent(state.present)].slice(-MAX_HISTORY),
    present: osReducer(state.present, osAction),
    future: [],
  }
}
