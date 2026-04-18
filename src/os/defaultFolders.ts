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
    { id: 'f-notes', label: 'Notes', x: 120, y: 24, kind: 'notes' },
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
