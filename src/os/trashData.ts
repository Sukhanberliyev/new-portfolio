import type { DesktopFolderItem } from './osTypes'

export function createTrashFolder(): DesktopFolderItem {
  return {
    id: 'f-trash',
    label: 'Trash',
    x: 0,
    y: 0,
    kind: 'trash',
  }
}
