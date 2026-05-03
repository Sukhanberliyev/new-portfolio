import { useVisitorCount } from '../hooks/useVisitorCount'
import { useLastViewed, type LastViewed } from '../hooks/useLastViewed'
import styles from './SiteFooter.module.css'

interface SiteFooterProps {
  visitors: string
  lastViewed: string
}

const numberFormatter = new Intl.NumberFormat('en-US')

/**
 * Render rules for the location pair (per spec):
 *   - city + country     → "Last viewed" / "{city}, {country}"
 *   - country only       → "Last viewed" / "{country}"
 *   - lookup failed/null → single muted "Recently viewed"
 *
 * Returns `null` for the value when we should render the fallback as a
 * single span instead of a label/value pair.
 */
function formatLocation(data: LastViewed | null): string | null {
  if (!data) return null
  if (data.city && data.country) return `${data.city}, ${data.country}`
  if (data.country) return data.country
  if (data.city) return data.city
  return null
}

export default function SiteFooter({ visitors, lastViewed }: SiteFooterProps) {
  const liveTotal = useVisitorCount()
  const { data: location, status } = useLastViewed()

  // Show the live API value once it arrives; until then, render the static
  // placeholder so the layout is never empty on first paint.
  const visitorsDisplay =
    liveTotal !== undefined ? numberFormatter.format(liveTotal) : visitors

  // Until the request resolves, keep the static placeholder so the line
  // doesn't flicker to "Recently viewed" on a slow network.
  let locationValue: string | null
  if (status === 'loading') {
    locationValue = lastViewed
  } else if (status === 'error') {
    locationValue = null
  } else {
    locationValue = formatLocation(location)
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.row}>
        <span className={styles.pair}>
          <span className={styles.label}>Visitors</span>
          <span className={styles.value}>{visitorsDisplay}</span>
        </span>
        {locationValue ? (
          <span className={styles.pair}>
            <span className={styles.label}>Last viewed</span>
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
