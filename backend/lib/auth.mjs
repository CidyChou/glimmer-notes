import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto'

const TOKEN_VERSION = 1

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function hashPassword(password, salt) {
  return scryptSync(password, salt, 32).toString('hex')
}

export function verifyPassword(password, salt, expectedHash) {
  if (typeof password !== 'string' || !password || !salt || !expectedHash) return false
  return safeEqual(hashPassword(password, salt), expectedHash)
}

export function createSessionToken(secret, now = Date.now(), ttlSeconds = 30 * 24 * 60 * 60) {
  const payload = Buffer.from(JSON.stringify({
    version: TOKEN_VERSION,
    issuedAt: now,
    expiresAt: now + ttlSeconds * 1000
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
      parsed.expiresAt <= now
    ) return null
    return parsed
  } catch {
    return null
  }
}
