import { useVisitorCount } from '../hooks/useVisitorCount'
import { useLastViewed, type LastViewed } from '../hooks/useLastViewed'
import styles from './SiteFooter.module.css'

const numberFormatter = new Intl.NumberFormat('en-US')

function formatLocation(data: LastViewed | null): string | null {
  if (!data) return null
  if (data.city && data.country) return `${data.city}, ${data.country}`
  if (data.country) return data.country
  if (data.city) return data.city
  return null
}

export default function SiteFooter() {
  const { total: liveTotal, status: visitorStatus } = useVisitorCount()
  const { data: location, status: locationStatus } = useLastViewed()

  const visitorsDisplay =
    liveTotal !== undefined
      ? numberFormatter.format(liveTotal)
      : visitorStatus === 'error'
        ? 'Unavailable'
        : 'Loading'

  const locationValue =
    locationStatus === 'ready' ? formatLocation(location) : null

  return (
    <footer className={styles.footer}>
      <div className={styles.row}>
        <span className={styles.pair}>
          <span className={styles.label}>Visitors:</span>
          <span className={styles.value}>{visitorsDisplay}</span>
        </span>
        {locationValue ? (
          <span className={styles.pair}>
            <span className={styles.label}>Last viewed:</span>
            <span className={styles.value}>{locationValue}</span>
          </span>
        ) : (
          <span className={styles.pair}>
            <span className={styles.label}>Recently viewed</span>
          </span>
        )}
      </div>
    </footer>
  )
}
