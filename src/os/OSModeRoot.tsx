import { useReducer, useState } from 'react'
import { motion } from 'framer-motion'
import OSModeOverlay from './OSModeOverlay'
import { initialHistoryState, osHistoryReducer } from './osHistoryReducer'
import styles from './OSMode.module.css'

export default function OSModeRoot({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [state, dispatch] = useReducer(osHistoryReducer, initialHistoryState)

  const closeOs = () => {
    dispatch({ type: 'CANCEL_RENAME_FOLDER' })
    setOpen(false)
  }

  return (
    <>
      {children}
      {!open && (
        <motion.button
          type="button"
          className={styles.entryButton}
          onClick={() => setOpen(true)}
          aria-label="Open desktop mode"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className={styles.entryIcon} aria-hidden>
            🖥
          </span>
          Desktop
        </motion.button>
      )}
      <OSModeOverlay
        open={open}
        onClose={closeOs}
        state={state.present}
        dispatch={dispatch}
        canUndo={state.past.length > 0}
        canRedo={state.future.length > 0}
      />
    </>
  )
}
