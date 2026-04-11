import type { DesktopFolderItem } from './osTypes'

let customId = 0
export function nextCustomFolderId(): string {
  customId += 1
  return `custom-${customId}`
}

export function createDefaultFolders(): DesktopFolderItem[] {
  return [
    { id: 'f-about', label: 'About Me', x: 24, y: 24, kind: 'about' },
    { id: 'f-projects', label: 'Projects', x: 24, y: 140, kind: 'projects' },
    { id: 'f-playground', label: 'Playground', x: 24, y: 256, kind: 'playground' },
    { id: 'f-contact', label: 'Contact', x: 24, y: 372, kind: 'contact' },
  ]
}

export function nextUntitledName(existingLabels: string[]): string {
  const base = 'Untitled Folder'
  if (!existingLabels.includes(base)) return base
  let n = 2
  while (existingLabels.includes(`${base} ${n}`)) n += 1
  return `${base} ${n}`
}
