import type { Project } from '../data/profile'
import styles from './FeaturedProjects.module.css'

interface FeaturedProjectsProps {
  projects: Project[]
}

export default function FeaturedProjects({ projects }: FeaturedProjectsProps) {
  return (
    <section className={styles.section}>
      <p className={styles.label}>Featured Projects</p>
      <ul className={styles.list}>
        {projects.map((project, i) => (
          <li key={`${project.year}-${project.name}-${i}`} className={styles.row}>
            <span className={styles.year}>{project.year}</span>
            <span className={styles.details}>
              <span className={styles.name}>
                <span className={styles.title}>{project.name}</span>
                {project.status ? (
                  <span className={styles.status}>{project.status}</span>
                ) : null}
              </span>
              <span className={styles.category}>{project.category}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
