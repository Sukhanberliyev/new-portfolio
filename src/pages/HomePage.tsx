import Header from '../components/Header'
import Bio from '../components/Bio'
import ContactLine from '../components/ContactLine'
import FeaturedProjects from '../components/FeaturedProjects'
import SiteFooter from '../components/SiteFooter'
import { profile } from '../data/profile'
import styles from './HomePage.module.css'

export default function HomePage() {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <section className={styles.intro}>
          <Header
            name={profile.name}
            role={profile.role}
            location={profile.location}
            timeZone={profile.timeZone}
          />
          <div className={styles.about}>
            <Bio text={profile.bio} />
            <ContactLine
              x={profile.contact.x}
              telegram={profile.contact.telegram}
              email={profile.contact.email}
            />
          </div>
        </section>
        <FeaturedProjects projects={profile.projects} />
        <SiteFooter
          visitors={profile.stats.visitors}
          lastViewed={profile.stats.lastViewed}
        />
      </div>
    </main>
  )
}
