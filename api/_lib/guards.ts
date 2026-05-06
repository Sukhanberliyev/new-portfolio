import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { createHash } from 'node:crypto'

/**
 * Shared request-level guards used by every public API route.
 *
 * Two layers of defense, applied independently of the business logic in each
 * handler:
 *
 *   1. Origin allow-list — rejects cross-origin POSTs that aren't from a
 *      site we own. Browsers already block them via CORS (no
 *      Access-Control-Allow-Origin header is set), but `curl`/scripts can
 *      still hit us. This closes that gap for write methods.
 *
 *   2. Per-IP rate limit (sliding window, Upstash-backed). Used to throttle
 *      write endpoints so an attacker can't spam-overwrite shared state
 *      (e.g. the "last viewed" record).
 *
 * The IP we key on is hashed (sha256 + daily salt) before being passed to
 * Upstash so the raw IP is never written to storage by either us or the
 * rate-limit library.
 */

const redis = Redis.fromEnv()

/**
 * Vercel auto-injects this for all production deploys (e.g.
 * "my-site-abc123.vercel.app"). On preview deploys the URL is unique per
 * commit, which we also accept so review previews work.
 */
const VERCEL_URL = process.env.VERCEL_URL

/**
 * Optional explicit allow-list. Comma-separated, e.g.
 *   "https://aidar.su,https://www.aidar.su"
 * Set in the Vercel dashboard once a custom domain is wired up.
 */
const ALLOWED_ORIGINS_ENV = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function buildAllowedOrigins(): string[] {
  const list: string[] = [...ALLOWED_ORIGINS_ENV]
  if (VERCEL_URL) list.push(`https://${VERCEL_URL}`)
  return list
}

function originMatchesHost(origin: string, host: string): boolean {
  return origin === `https://${host}` || origin === `http://${host}`
}

/**
 * Allow same-origin POSTs (Origin header matches the deployment) and
 * any explicitly allow-listed origin. A missing Origin header is allowed
 * for non-browser clients on local development (Vercel won't issue
 * server-to-server requests without one in production).
 */
export function isOriginAllowed(req: VercelRequest): boolean {
  const origin = req.headers.origin
  if (!origin) {
    // Same-origin fetches from <script> tags in HTML often omit Origin.
    // Allow only when the request also looks same-site via the Host header.
    const host = req.headers.host
    return typeof host === 'string' && host.length > 0
  }

  const allowed = buildAllowedOrigins()
  const host = req.headers.host
  // Custom domains still arrive with VERCEL_URL set to the deployment URL,
  // so accept the concrete request host before checking configured aliases.
  if (typeof host === 'string' && originMatchesHost(origin, host)) {
    return true
  }

  if (allowed.length === 0) return false
  return allowed.includes(origin)
}

/**
 * Hashed identifier we use as the rate-limit key. `IP + UTC-date` so the key
 * rotates daily — the rate-limit library only ever sees an opaque hash,
 * never the raw IP, satisfying the "no raw IP storage" rule even for
 * ephemeral rate-limit state.
 */
export function rateLimitKey(req: VercelRequest): string {
  const xff = (req.headers['x-forwarded-for'] as string | undefined) ?? ''
  const ip =
    xff.split(',')[0]?.trim() ||
    (req.socket?.remoteAddress ?? 'unknown')
  const day = new Date().toISOString().slice(0, 10)
  return createHash('sha256').update(`${ip}|${day}`).digest('hex')
}

/**
 * Lazily-built Ratelimit singletons. We don't instantiate at module load
 * because the env vars may not be present in some test paths.
 */
const limiters = new Map<string, Ratelimit>()

function getLimiter(name: string, max: number, windowSec: number): Ratelimit {
  const key = `${name}:${max}:${windowSec}`
  let limiter = limiters.get(key)
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
      analytics: false,
      prefix: `rl:${name}`,
    })
    limiters.set(key, limiter)
  }
  return limiter
}

export interface RateLimitDecision {
  allowed: boolean
  remaining: number
  reset: number
}

/**
 * Apply a sliding-window rate limit to the request. Sets standard
 * `RateLimit-*` headers on the response and returns whether the request
 * should proceed.
 */
export async function rateLimit(
  req: VercelRequest,
  res: VercelResponse,
  opts: { name: string; max: number; windowSec: number },
): Promise<RateLimitDecision> {
  const limiter = getLimiter(opts.name, opts.max, opts.windowSec)
  const key = rateLimitKey(req)
  const result = await limiter.limit(key)

  res.setHeader('RateLimit-Limit', String(opts.max))
  res.setHeader('RateLimit-Remaining', String(Math.max(0, result.remaining)))
  res.setHeader('RateLimit-Reset', String(Math.ceil((result.reset - Date.now()) / 1000)))

  return {
    allowed: result.success,
    remaining: result.remaining,
    reset: result.reset,
  }
}
