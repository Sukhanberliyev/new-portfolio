import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Redis } from '@upstash/redis'
import { createHash, randomUUID } from 'node:crypto'
import { isOriginAllowed, rateLimit } from './_lib/guards.js'

// Garbage-collect cookieless fingerprint records after 48h. The fingerprint
// hash already rotates daily (UTC-date salt), so older keys are unreachable
// — this just frees memory. Cookie-id keys are NOT TTL'd because the cookie
// itself lives for 1y and we want lookups to stay deduped that long.
const FP_TTL_SECONDS = 60 * 60 * 48

/**
 * POST /api/visitor-count
 *
 * Counts unique visitors. Identity is established via an HttpOnly cookie
 * (`visitor_id`); when the cookie is absent we fall back to a salted hash of
 * IP + User-Agent so privacy/security-conscious clients still dedupe within a
 * day. Raw IPs are never stored.
 *
 * Storage (Upstash Redis, auto-provisioned by the Vercel marketplace
 * integration as KV_REST_API_URL / KV_REST_API_TOKEN):
 *   - visitors:total            INCR-only counter
 *   - visitor:<id>              JSON { firstSeenAt, lastSeenAt }
 *   - visitor:fp:<hashed-fp>    JSON { firstSeenAt, lastSeenAt, cookieId? }
 *
 * Returns: { totalVisitors, counted }
 */

const COOKIE_NAME = 'visitor_id'
// 1 year — long enough that cookie-cleared sessions are the only realistic
// way for a returning visitor to be re-counted.
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

const redis = Redis.fromEnv()

interface VisitorRecord {
  firstSeenAt: string
  lastSeenAt: string
  cookieId?: string
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function readCookie(req: VercelRequest, name: string): string | undefined {
  const header = req.headers.cookie
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

function setVisitorCookie(res: VercelResponse, id: string) {
  // HttpOnly so JS can't touch it; SameSite=Lax is enough for a same-site POST
  // and avoids breaking when the page is opened from a link.
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${id}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
  )
}

/**
 * Cookieless fallback identity. We hash IP + UA + a daily salt so the
 * fingerprint cannot be linked across days and the raw IP never lands in
 * storage. Salt rotates daily on UTC date boundary.
 */
function fingerprint(req: VercelRequest): string {
  const xff = (req.headers['x-forwarded-for'] as string | undefined) ?? ''
  const ip = xff.split(',')[0]?.trim() || (req.socket?.remoteAddress ?? 'unknown')
  const ua = (req.headers['user-agent'] as string | undefined) ?? 'unknown'
  const dailySalt = new Date().toISOString().slice(0, 10)
  return createHash('sha256').update(`${ip}|${ua}|${dailySalt}`).digest('hex')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  // Defense-in-depth on top of CORS: reject non-browser cross-origin writes.
  if (!isOriginAllowed(req)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  // Throttle to 30 writes/min per hashed-IP. Real users hit this once per
  // page load; ceiling is high enough to absorb StrictMode + dev tooling
  // and low enough to neutralize a script that's trying to inflate the
  // counter.
  const decision = await rateLimit(req, res, {
    name: 'visitor-count',
    max: 30,
    windowSec: 60,
  })
  if (!decision.allowed) {
    return res.status(429).json({ error: 'Too Many Requests' })
  }

  try {
    const cookieId = readCookie(req, COOKIE_NAME)
    const hasValidCookie = !!cookieId && isUuid(cookieId)

    const nowIso = new Date().toISOString()
    let counted = false

    if (hasValidCookie) {
      const visitorKey = `visitor:${cookieId}`
      // SET ... NX is the atomic "have we seen this visitor?" primitive —
      // only the first writer wins, so concurrent requests from the same
      // visitor can't both increment.
      const created = await redis.set(
        visitorKey,
        JSON.stringify({ firstSeenAt: nowIso, lastSeenAt: nowIso }),
        { nx: true },
      )

      if (created) {
        // First time we've seen this visitor — bump the global counter.
        await redis.incr('visitors:total')
        counted = true
      } else {
        // Returning visitor — refresh last_seen_at, but never touch the
        // counter. Cookie keys remain un-TTL'd, matching the 1y cookie lifetime.
        const existing = await redis.get<VisitorRecord>(visitorKey)
        const firstSeenAt = existing?.firstSeenAt ?? nowIso
        await redis.set(
          visitorKey,
          JSON.stringify({ firstSeenAt, lastSeenAt: nowIso }),
        )
      }
    } else {
      // Cookieless visitors are first deduped by a short-lived fingerprint.
      // Store the cookie id on that fingerprint record so clients that block
      // cookies reuse the same mirrored visitor key instead of minting a new
      // permanent key on every page load.
      const visitorKey = `visitor:fp:${fingerprint(req)}`
      const newCookieId = randomUUID()
      const created = await redis.set(
        visitorKey,
        JSON.stringify({
          firstSeenAt: nowIso,
          lastSeenAt: nowIso,
          cookieId: newCookieId,
        } satisfies VisitorRecord),
        { nx: true, ex: FP_TTL_SECONDS },
      )

      let firstSeenAt = nowIso
      let cookieIdToSet: string = newCookieId

      if (created) {
        await redis.incr('visitors:total')
        counted = true
      } else {
        const existing = await redis.get<VisitorRecord>(visitorKey)
        firstSeenAt = existing?.firstSeenAt ?? nowIso
        cookieIdToSet =
          existing?.cookieId && isUuid(existing.cookieId)
            ? existing.cookieId
            : newCookieId
        await redis.set(
          visitorKey,
          JSON.stringify({
            firstSeenAt,
            lastSeenAt: nowIso,
            cookieId: cookieIdToSet,
          } satisfies VisitorRecord),
          { ex: FP_TTL_SECONDS },
        )
      }

      setVisitorCookie(res, cookieIdToSet)
      // Mirror the fingerprint record under the cookie id so the next visit
      // doesn't double-count when we switch namespaces. This write is stable
      // for repeated cookieless requests because cookieIdToSet is persisted on
      // the fingerprint record.
      await redis.set(
        `visitor:${cookieIdToSet}`,
        JSON.stringify({ firstSeenAt, lastSeenAt: nowIso }),
        { nx: true },
      )
    }

    const totalVisitors = (await redis.get<number>('visitors:total')) ?? 0

    // Don't let CDNs cache a counter response.
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ totalVisitors, counted })
  } catch (err) {
    console.error('[visitor-count] error', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}
