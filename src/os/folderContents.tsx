import type { FolderKind } from './osTypes'
import { profile } from '../data/profile'
import styles from './OSMode.module.css'

export function FolderWindowBody({ kind }: { kind: FolderKind }) {
  switch (kind) {
    case 'about':
      return (
        <div className={styles.textBlock}>
          <p>{profile.bio}</p>
        </div>
      )
    case 'projects':
      return (
        <div className={styles.cardGrid}>
          <a className={styles.fileCard} href="#">
            <span className={styles.fileIcon}>📄</span>
            <span className={styles.fileLabel}>Case study (soon)</span>
          </a>
          <a className={styles.fileCard} href="#">
            <span className={styles.fileIcon}>🎨</span>
            <span className={styles.fileLabel}>Selected work</span>
          </a>
        </div>
      )
    case 'playground':
      return (
        <p className={styles.emptyState}>
          Experiments and side projects will live here.
        </p>
      )
    case 'contact':
      return (
        <ul className={styles.linkList}>
          <li>
            <a href={profile.contact.x.href} target="_blank" rel="noreferrer">
              {profile.contact.x.label}
            </a>
          </li>
          <li>
            <a href={profile.contact.telegram.href} target="_blank" rel="noreferrer">
              {profile.contact.telegram.label}
            </a>
          </li>
          <li>
            <a href={profile.contact.email.href}>{profile.contact.email.label}</a>
          </li>
        </ul>
      )
    case 'custom':
    default:
      return (
        <p className={styles.emptyState}>This folder is empty.</p>
      )
  }
}
