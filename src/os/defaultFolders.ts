import type { DesktopFolderItem } from './osTypes'

let customId = 0
export function nextCustomFolderId(): string {
  customId += 1
  return `custom-${customId}`
}

export function createDefaultFolders(): DesktopFolderItem[] {
  const now = Date.now()
  const day = 86_400_000
  const FOLDER_W = 88
  const GUTTER = 8
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1280
  const rightX = Math.max(GUTTER, viewportW - FOLDER_W - GUTTER)
  const secondColX = Math.max(GUTTER, rightX - FOLDER_W - GUTTER)
  return [
    { id: 'f-about', label: 'About Me', x: rightX, y: 24, kind: 'about', createdAt: now - day * 4 },
    { id: 'f-projects', label: 'Projects', x: rightX, y: 140, kind: 'projects', createdAt: now - day * 3 },
    { id: 'f-playground', label: 'Playground', x: rightX, y: 256, kind: 'playground', createdAt: now - day * 2 },
    { id: 'f-contact', label: 'Contact', x: rightX, y: 372, kind: 'contact', createdAt: now - day },
    { id: 'f-notes', label: 'Notes', x: secondColX, y: 24, kind: 'notes', createdAt: now },
  ]
}

export function createDefaultApplications(): DesktopFolderItem[] {
  return [
    { id: 'app-calculator', label: 'Calculator', x: 0, y: 0, kind: 'calculator' },
    { id: 'app-calendar', label: 'Calendar', x: 0, y: 0, kind: 'calendar' },
  ]
}

export function nextUntitledName(existingLabels: string[]): string {
  const base = 'Untitled Folder'
  if (!existingLabels.includes(base)) return base
  let n = 2
  while (existingLabels.includes(`${base} ${n}`)) n += 1
  return `${base} ${n}`
}
