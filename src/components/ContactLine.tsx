import styles from './ContactLine.module.css'

interface ContactLink {
  label: string
  href: string
}

interface ContactLineProps {
  x: ContactLink
  telegram: ContactLink
  email: ContactLink
}

export default function ContactLine({ x, telegram, email }: ContactLineProps) {
  return (
    <p className={styles.contact}>
      You can reach me on{' '}
      <a href={x.href} target="_blank" rel="noopener noreferrer">
        {x.label}
      </a>
      , send a quick message on{' '}
      <a href={telegram.href} target="_blank" rel="noopener noreferrer">
        {telegram.label}
      </a>
      , or{' '}
      <a href={email.href}>{email.label}</a>.
    </p>
  )
}
