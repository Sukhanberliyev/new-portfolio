import { useEffect, useRef, useState } from 'react'

interface VisitorCountResponse {
  totalVisitors: number
  counted: boolean
}

type Status = 'loading' | 'ready' | 'error'

interface UseVisitorCountResult {
  total: number | undefined
  status: Status
}

/**
 * Calls POST /api/visitor-count exactly once per page load and returns the
 * total visitor count for display.
 *
 * StrictMode runs effects twice in dev; the `firedRef` guard ensures the API
 * is only hit once. The endpoint is idempotent on the server side too (cookie
 * + SET NX), so the guard is belt-and-suspenders rather than load-bearing.
 */
export function useVisitorCount(initial?: number): UseVisitorCountResult {
  const [total, setTotal] = useState<number | undefined>(initial)
  const [status, setStatus] = useState<Status>(
    initial !== undefined ? 'ready' : 'loading',
  )
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true

    const controller = new AbortController()
    fetch('/api/visitor-count', {
      method: 'POST',
      credentials: 'include',
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<VisitorCountResponse>
      })
      .then((data) => {
        setTotal(data.totalVisitors)
        setStatus('ready')
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          // Soft-fail: the UI renders an explicit fallback instead of blanks.
          console.warn('[visitor-count] request failed', err)
          setStatus('error')
        }
      })

    return () => controller.abort()
  }, [])

  return { total, status }
}
