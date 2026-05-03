import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Redis } from '@upstash/redis'
import { isOriginAllowed, rateLimit } from './_lib/guards.js'

/**
 * /api/last-viewed
 *
 *   POST  → looks up the visitor's approximate location, overwrites the
 *           single "latest viewed" record in Redis, returns it.
 *   GET   → returns the current "latest viewed" record (read-only).
 *
 * Privacy contract:
 *   - Raw IP addresses are never written to storage. We only read them
 *     transiently from request headers, derive city/country/countryCode,
 *     and discard them in the same request.
 *   - No coordinates, no street-level precision, no postal code.
 *   - Only one record exists at any time (single key, overwritten).
 *
 * Geo source:
 *   Vercel injects approximate geo headers on every request (`x-vercel-ip-city`,
 *   `x-vercel-ip-country`, `x-vercel-ip-country-region`). This avoids a
 *   third-party geolocation API entirely — zero added latency, zero added
 *   dependency, no token to leak.
 *
 *   When running outside Vercel (e.g. plain `vite`), these headers are absent
 *   and POST will return null fields, which the frontend renders as
 *   "Recently viewed".
 */

const LATEST_KEY = 'last-viewed:latest'

// Country code → human-readable name. Vercel only gives us the ISO 3166-1
// alpha-2 code, so we keep a small lookup for the "country" string we expose.
// Falls back to the code itself if missing — the UI still renders something
// reasonable (e.g. "London, GB") rather than an empty string.
const COUNTRY_NAMES: Record<string, string> = {
  AE: 'UAE',
  AR: 'Argentina',
  AT: 'Austria',
  AU: 'Australia',
  BE: 'Belgium',
  BR: 'Brazil',
  CA: 'Canada',
  CH: 'Switzerland',
  CN: 'China',
  CZ: 'Czechia',
  DE: 'Germany',
  DK: 'Denmark',
  EG: 'Egypt',
  ES: 'Spain',
  FI: 'Finland',
  FR: 'France',
  GB: 'UK',
  GR: 'Greece',
  HK: 'Hong Kong',
  ID: 'Indonesia',
  IE: 'Ireland',
  IL: 'Israel',
  IN: 'India',
  IT: 'Italy',
  JP: 'Japan',
  KR: 'South Korea',
  KZ: 'Kazakhstan',
  MX: 'Mexico',
  MY: 'Malaysia',
  NG: 'Nigeria',
  NL: 'Netherlands',
  NO: 'Norway',
  NZ: 'New Zealand',
  PH: 'Philippines',
  PK: 'Pakistan',
  PL: 'Poland',
  PT: 'Portugal',
  RO: 'Romania',
  RU: 'Russia',
  SA: 'Saudi Arabia',
  SE: 'Sweden',
  SG: 'Singapore',
  TH: 'Thailand',
  TR: 'Türkiye',
  TW: 'Taiwan',
  UA: 'Ukraine',
  US: 'United States',
  VN: 'Vietnam',
  ZA: 'South Africa',
}

const redis = Redis.fromEnv()

export interface LastViewed {
  city: string | null
  country: string | null
  countryCode: string | null
  viewedAt: string
}

function header(req: VercelRequest, name: string): string | undefined {
  const v = req.headers[name]
  if (Array.isArray(v)) return v[0]
  return v
}

/**
 * Pull approximate location from Vercel's edge geo headers. We never look at
 * the raw IP; Vercel resolves it server-side and only hands us the derived
 * fields. City names come URL-encoded (e.g. "São%20Paulo"), so decode here.
 */
function readGeo(req: VercelRequest): {
  city: string | null
  countryCode: string | null
} {
  const rawCity = header(req, 'x-vercel-ip-city')
  const rawCountry = header(req, 'x-vercel-ip-country')

  let city: string | null = null
  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity).trim() || null
    } catch {
      city = rawCity.trim() || null
    }
  }

  const countryCode = rawCountry?.trim().toUpperCase() || null
  return { city, countryCode }
}

function resolveCountryName(code: string | null): string | null {
  if (!code) return null
  return COUNTRY_NAMES[code] ?? code
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  try {
    if (req.method === 'GET') {
      const latest = await redis.get<LastViewed>(LATEST_KEY)
      if (!latest) return res.status(200).json(null)
      return res.status(200).json(latest)
    }

    if (req.method === 'POST') {
      // Defense-in-depth: reject cross-origin write attempts that aren't
      // browser-blocked (curl, scripts). Same-origin browser traffic passes.
      if (!isOriginAllowed(req)) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      // Throttle writes: 10 per minute per hashed-IP. An attacker can't
      // spam-overwrite the latest record, and legitimate refreshes are
      // nowhere near this ceiling.
      const decision = await rateLimit(req, res, {
        name: 'last-viewed',
        max: 10,
        windowSec: 60,
      })
      if (!decision.allowed) {
        return res.status(429).json({ error: 'Too Many Requests' })
      }

      const { city, countryCode } = readGeo(req)
      const country = resolveCountryName(countryCode)

      const record: LastViewed = {
        city,
        country,
        countryCode,
        viewedAt: new Date().toISOString(),
      }

      // Single key, unconditional overwrite — we only ever keep the latest
      // visitor's location. Previous record is discarded; no history retained.
      await redis.set(LATEST_KEY, JSON.stringify(record))

      return res.status(200).json(record)
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (err) {
    console.error('[last-viewed] error', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}
