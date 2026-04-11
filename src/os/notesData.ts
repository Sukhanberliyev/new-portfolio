import type { NoteItem } from './osTypes'

let noteId = 0

export function nextNoteId(): string {
  noteId += 1
  return `note-${noteId}`
}

export function createDefaultNotes(): NoteItem[] {
  return []
}
