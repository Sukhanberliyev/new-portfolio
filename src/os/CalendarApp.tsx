import { useMemo, useState } from 'react'
import styles from './OSMode.module.css'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface DayCell {
  date: Date
  inMonth: boolean
  isToday: boolean
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function buildMonthGrid(viewDate: Date, today: Date): DayCell[] {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startWeekday = firstOfMonth.getDay()
  const gridStart = new Date(year, month, 1 - startWeekday)
  const cells: DayCell[] = []
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    cells.push({
      date: d,
      inMonth: d.getMonth() === month,
      isToday: isSameDay(d, today),
    })
  }
  return cells
}

export default function CalendarApp() {
  const today = useMemo(() => new Date(), [])
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState<Date>(today)

  const cells = useMemo(() => buildMonthGrid(viewDate, today), [viewDate, today])
  const monthLabel = `${MONTH_NAMES[viewDate.getMonth()]} ${viewDate.getFullYear()}`

  const goPrevMonth = () =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const goNextMonth = () =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  const goToday = () => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(today)
  }

  return (
    <div className={styles.calApp}>
      <header className={styles.calHeader}>
        <div className={styles.calHeaderLeft}>
          <button type="button" className={styles.calTodayBtn} onClick={goToday}>
            Today
          </button>
          <div className={styles.calNavGroup}>
            <button
              type="button"
              className={styles.calNavBtn}
              onClick={goPrevMonth}
              aria-label="Previous month"
            >
              <svg viewBox="0 0 16 16" aria-hidden>
                <path
                  d="M10 3.5 5.5 8 10 12.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className={styles.calNavBtn}
              onClick={goNextMonth}
              aria-label="Next month"
            >
              <svg viewBox="0 0 16 16" aria-hidden>
                <path
                  d="M6 3.5 10.5 8 6 12.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
        <h2 className={styles.calTitle}>{monthLabel}</h2>
        <div className={styles.calHeaderRight}>
          <div className={styles.calSegment} role="tablist" aria-label="Calendar view">
            <button type="button" className={styles.calSegmentBtn} role="tab">
              Day
            </button>
            <button type="button" className={styles.calSegmentBtn} role="tab">
              Week
            </button>
            <button
              type="button"
              className={`${styles.calSegmentBtn} ${styles.calSegmentBtnActive}`}
              role="tab"
              aria-selected
            >
              Month
            </button>
            <button type="button" className={styles.calSegmentBtn} role="tab">
              Year
            </button>
          </div>
        </div>
      </header>

      <div className={styles.calWeekdays}>
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className={styles.calWeekday}>
            {label}
          </div>
        ))}
      </div>

      <div className={styles.calGrid}>
        {cells.map((cell) => {
          const isSelected = isSameDay(cell.date, selectedDate)
          const classes = [styles.calCell]
          if (!cell.inMonth) classes.push(styles.calCellMuted)
          if (cell.isToday) classes.push(styles.calCellToday)
          if (isSelected) classes.push(styles.calCellSelected)
          return (
            <button
              key={cell.date.toISOString()}
              type="button"
              className={classes.join(' ')}
              onClick={() => setSelectedDate(cell.date)}
            >
              <span className={styles.calCellNumber}>{cell.date.getDate()}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
