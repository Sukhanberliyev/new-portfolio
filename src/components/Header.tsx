import { useEffect, useState } from 'react'
import styles from './Header.module.css'

interface HeaderProps {
  name: string
  role: string
  location: string
  timeZone: string
}

function formatTime(timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  }).format(new Date())
}

export default function Header({ name, role, location, timeZone }: HeaderProps) {
  const [time, setTime] = useState(() => formatTime(timeZone))

  useEffect(() => {
    const tick = () => setTime(formatTime(timeZone))
    tick()
    const now = new Date()
    const msToNextMinute =
      (60 - now.getSeconds()) * 1000 - now.getMilliseconds()
    let interval: ReturnType<typeof setInterval> | undefined
    const timeout = setTimeout(() => {
      tick()
      interval = setInterval(tick, 60_000)
    }, msToNextMinute)
    return () => {
      clearTimeout(timeout)
      if (interval) clearInterval(interval)
    }
  }, [timeZone])

  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <p className={styles.name}>{name}</p>
        <p className={styles.role}>{role}</p>
      </div>
      <div className={styles.meta}>
        <span className={styles.location}>{location}</span>
        <span className={styles.time}>{time}</span>
      </div>
    </header>
  )
}
