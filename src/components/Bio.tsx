import styles from './Bio.module.css'

interface BioProps {
  text: string
}

export default function Bio({ text }: BioProps) {
  return <p className={styles.bio}>{text}</p>
}
