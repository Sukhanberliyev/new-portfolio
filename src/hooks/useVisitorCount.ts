import { useEffect, useRef, useState } from 'react'

interface VisitorCountResponse {
  totalVisitors: number
  counted: boolean
}

/**
 * Calls POST /api/visitor-count exactly once per page load and returns the
 * total visitor count for display.
 *
 * StrictMode runs effects twice in dev; the `firedRef` guard ensures the API
 * is only hit once. The endpoint is idempotent on the server side too (cookie
 * + SET NX), so the guard is belt-and-suspenders rather than load-bearing.
 */
export function useVisitorCount(initial?: number) {
  const [total, setTotal] = useState<number | undefined>(initial)
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
      .then((r) => (r.ok ? (r.json() as Promise<VisitorCountResponse>) : null))
      .then((data) => {
        if (data) setTotal(data.totalVisitors)
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          // Soft-fail: the UI just keeps the placeholder/initial value.
          console.warn('[visitor-count] request failed', err)
        }
      })

    return () => controller.abort()
  }, [])

  return total
}
