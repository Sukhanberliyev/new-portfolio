import Header from '../components/Header'
import Bio from '../components/Bio'
import ContactLine from '../components/ContactLine'
import { profile } from '../data/profile'
import styles from './HomePage.module.css'

export default function HomePage() {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <Header name={profile.name} role={profile.role} />
        <Bio text={profile.bio} />
        <ContactLine
          x={profile.contact.x}
          telegram={profile.contact.telegram}
          email={profile.contact.email}
        />
      </div>
    </main>
  )
}
