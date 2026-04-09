import styles from './Header.module.css'

interface HeaderProps {
  name: string
  role: string
}

export default function Header({ name, role }: HeaderProps) {
  return (
    <header className={styles.header}>
      <p className={styles.name}>{name}</p>
      <p className={styles.role}>{role}</p>
    </header>
  )
}
