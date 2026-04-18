import { useEffect, useRef } from 'react'
import type { NoteItem } from './osTypes'
import type { HistoryAction } from './osHistoryReducer'
import styles from './OSMode.module.css'

interface NotesAppProps {
  notes: NoteItem[]
  selectedNoteId: string | null
  dispatch: React.Dispatch<HistoryAction>
}

export function getNoteTitle(content: string): string {
  const trimmed = content.trim()
  if (!trimmed) return 'New Note'
  const [firstLine] = trimmed.split('\n')
  return firstLine.slice(0, 52)
}

export function getNotePreview(content: string): string {
  const trimmed = content.trim()
  if (!trimmed) return 'Empty note'
  const lines = trimmed.split('\n')
  const rest = lines.slice(1).join(' ').trim()
  if (rest) return rest.slice(0, 80)
  return lines[0]?.slice(0, 80) ?? ''
}

export default function NotesApp({ notes, selectedNoteId, dispatch }: NotesAppProps) {
  const activeNote = notes.find((note) => note.id === selectedNoteId) ?? null
  const editorRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!activeNote && notes.length > 0) {
      dispatch({ type: 'SELECT_NOTE', id: notes[0].id })
    }
  }, [activeNote, notes, dispatch])

  useEffect(() => {
    if (activeNote) {
      editorRef.current?.focus()
    }
  }, [activeNote?.id])

  const createNote = () => {
    dispatch({ type: 'NEW_NOTE' })
  }

  return (
    <div className={styles.notesLayout}>
      <section className={styles.notesEditor} aria-label="Note editor">
        {activeNote ? (
          <>
            <div className={styles.notesEditorHeader}>
              <span className={styles.notesEditorTitle}>
                {getNoteTitle(activeNote.content)}
              </span>
            </div>
            <textarea
              ref={editorRef}
              className={styles.notesTextarea}
              value={activeNote.content}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_NOTE_CONTENT',
                  id: activeNote.id,
                  content: e.target.value,
                })
              }
              placeholder="Start typing your note..."
              aria-label="Note content"
            />
          </>
        ) : (
          <div className={styles.notesEmpty}>
            <p className={styles.notesEmptyText}>Create your first note to get started.</p>
            <button type="button" className={styles.notesEmptyButton} onClick={createNote}>
              New Note
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
