import { useMemo, useState } from 'react'
import styles from './OSMode.module.css'

type Operator = '+' | '−' | '×' | '÷'

interface CalcState {
  display: string
  previous: number | null
  operator: Operator | null
  /** True right after an operator or equals — next digit starts fresh. */
  replace: boolean
}

const INITIAL: CalcState = {
  display: '0',
  previous: null,
  operator: null,
  replace: true,
}

function formatNumber(n: number): string {
  if (!isFinite(n)) return 'Error'
  const abs = Math.abs(n)
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-6)) {
    return n.toExponential(6).replace(/\.?0+e/, 'e')
  }
  const s = Number.parseFloat(n.toPrecision(12)).toString()
  return s
}

function compute(a: number, b: number, op: Operator): number {
  switch (op) {
    case '+':
      return a + b
    case '−':
      return a - b
    case '×':
      return a * b
    case '÷':
      return b === 0 ? Number.POSITIVE_INFINITY : a / b
  }
}

export default function CalculatorApp() {
  const [state, setState] = useState<CalcState>(INITIAL)

  const inputDigit = (digit: string) => {
    setState((s) => {
      if (s.replace) return { ...s, display: digit, replace: false }
      if (s.display === '0') return { ...s, display: digit }
      if (s.display.replace('-', '').replace('.', '').length >= 9) return s
      return { ...s, display: s.display + digit }
    })
  }

  const inputDot = () => {
    setState((s) => {
      if (s.replace) return { ...s, display: '0.', replace: false }
      if (s.display.includes('.')) return s
      return { ...s, display: s.display + '.' }
    })
  }

  const clear = () => setState(INITIAL)

  const toggleSign = () => {
    setState((s) => {
      if (s.display === '0') return s
      const next = s.display.startsWith('-') ? s.display.slice(1) : '-' + s.display
      return { ...s, display: next }
    })
  }

  const percent = () => {
    setState((s) => {
      const v = parseFloat(s.display)
      if (isNaN(v)) return s
      return { ...s, display: formatNumber(v / 100), replace: true }
    })
  }

  const applyOperator = (op: Operator) => {
    setState((s) => {
      const current = parseFloat(s.display)
      if (isNaN(current)) return s
      if (s.previous === null || s.operator === null) {
        return { ...s, previous: current, operator: op, replace: true }
      }
      if (s.replace) {
        return { ...s, operator: op }
      }
      const result = compute(s.previous, current, s.operator)
      return {
        display: formatNumber(result),
        previous: result,
        operator: op,
        replace: true,
      }
    })
  }

  const equals = () => {
    setState((s) => {
      if (s.previous === null || s.operator === null) return s
      const current = parseFloat(s.display)
      if (isNaN(current)) return s
      const result = compute(s.previous, current, s.operator)
      return {
        display: formatNumber(result),
        previous: null,
        operator: null,
        replace: true,
      }
    })
  }

  const displayValue = useMemo(() => {
    const d = state.display
    if (d === 'Error' || d === 'Infinity') return 'Error'
    return d
  }, [state.display])

  const clearLabel = state.display !== '0' || !state.replace || state.operator ? 'C' : 'AC'

  const isActive = (op: Operator) => state.operator === op && state.replace

  return (
    <div className={styles.calcApp}>
      <div className={styles.calcDisplay}>
        <span className={styles.calcDisplayValue}>{displayValue}</span>
      </div>
      <div className={styles.calcKeys}>
        <button
          type="button"
          className={`${styles.calcKey} ${styles.calcKeyFn}`}
          onClick={clear}
        >
          {clearLabel}
        </button>
        <button
          type="button"
          className={`${styles.calcKey} ${styles.calcKeyFn}`}
          onClick={toggleSign}
          aria-label="Toggle sign"
        >
          +/−
        </button>
        <button
          type="button"
          className={`${styles.calcKey} ${styles.calcKeyFn}`}
          onClick={percent}
        >
          %
        </button>
        <button
          type="button"
          className={`${styles.calcKey} ${styles.calcKeyOp} ${isActive('÷') ? styles.calcKeyOpActive : ''}`}
          onClick={() => applyOperator('÷')}
          aria-label="Divide"
        >
          ÷
        </button>

        <button type="button" className={styles.calcKey} onClick={() => inputDigit('7')}>7</button>
        <button type="button" className={styles.calcKey} onClick={() => inputDigit('8')}>8</button>
        <button type="button" className={styles.calcKey} onClick={() => inputDigit('9')}>9</button>
        <button
          type="button"
          className={`${styles.calcKey} ${styles.calcKeyOp} ${isActive('×') ? styles.calcKeyOpActive : ''}`}
          onClick={() => applyOperator('×')}
          aria-label="Multiply"
        >
          ×
        </button>

        <button type="button" className={styles.calcKey} onClick={() => inputDigit('4')}>4</button>
        <button type="button" className={styles.calcKey} onClick={() => inputDigit('5')}>5</button>
        <button type="button" className={styles.calcKey} onClick={() => inputDigit('6')}>6</button>
        <button
          type="button"
          className={`${styles.calcKey} ${styles.calcKeyOp} ${isActive('−') ? styles.calcKeyOpActive : ''}`}
          onClick={() => applyOperator('−')}
          aria-label="Subtract"
        >
          −
        </button>

        <button type="button" className={styles.calcKey} onClick={() => inputDigit('1')}>1</button>
        <button type="button" className={styles.calcKey} onClick={() => inputDigit('2')}>2</button>
        <button type="button" className={styles.calcKey} onClick={() => inputDigit('3')}>3</button>
        <button
          type="button"
          className={`${styles.calcKey} ${styles.calcKeyOp} ${isActive('+') ? styles.calcKeyOpActive : ''}`}
          onClick={() => applyOperator('+')}
          aria-label="Add"
        >
          +
        </button>

        <button
          type="button"
          className={`${styles.calcKey} ${styles.calcKeyZero}`}
          onClick={() => inputDigit('0')}
        >
          0
        </button>
        <button type="button" className={styles.calcKey} onClick={inputDot}>
          .
        </button>
        <button
          type="button"
          className={`${styles.calcKey} ${styles.calcKeyOp}`}
          onClick={equals}
          aria-label="Equals"
        >
          =
        </button>
      </div>
    </div>
  )
}
