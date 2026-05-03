import { useEffect, useRef, useState } from 'react'

export interface LastViewed {
  city: string | null
  country: string | null
  countryCode: string | null
  viewedAt: string
}

type Status = 'loading' | 'ready' | 'error'

interface UseLastViewedResult {
  data: LastViewed | null
  status: Status
}

/**
 * On mount, POSTs to /api/last-viewed exactly once to register the current
 * visitor's approximate location, then renders the returned record.
 *
 * StrictMode-safe via a `useRef` guard. The server is also idempotent at
 * the data level (single key, overwrite-only) so an accidental double-fire
 * would just overwrite with the same record.
 *
 * Errors are surfaced via `status` so the UI can fall back to "Recently
 * viewed" without leaking the failure to console-watching users.
 */
export function useLastViewed(): UseLastViewedResult {
  const [data, setData] = useState<LastViewed | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true

    const controller = new AbortController()
    fetch('/api/last-viewed', {
      method: 'POST',
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const json = (await r.json()) as LastViewed | null
        return json
      })
      .then((json) => {
        setData(json)
        setStatus('ready')
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        // Soft-fail — UI shows "Recently viewed".
        console.warn('[last-viewed] request failed', err)
        setStatus('error')
      })

    return () => controller.abort()
  }, [])

  return { data, status }
}
