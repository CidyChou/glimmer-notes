import { createHmac, timingSafeEqual } from 'node:crypto'
import { isSpaceId } from './spaces.mjs'

const TOKEN_VERSION = 2

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function createSessionToken(secret, now = Date.now(), ttlSeconds = 30 * 24 * 60 * 60, spaceId) {
  if (!isSpaceId(spaceId)) throw new Error('spaceId is required')
  const payload = Buffer.from(JSON.stringify({
    version: TOKEN_VERSION,
    issuedAt: now,
    expiresAt: now + ttlSeconds * 1000,
    spaceId
  })).toString('base64url')
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function verifySessionToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string') return null
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra) return null

  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  if (!safeEqual(signature, expected)) return null

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (
      parsed.version !== TOKEN_VERSION ||
      !Number.isFinite(parsed.issuedAt) ||
      !Number.isFinite(parsed.expiresAt) ||
      parsed.expiresAt <= now ||
      !isSpaceId(parsed.spaceId)
    ) return null
    return parsed
  } catch {
    return null
  }
}
