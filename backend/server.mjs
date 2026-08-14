import http from 'node:http'
import { createSessionToken, verifyPassword, verifySessionToken } from './lib/auth.mjs'
import { ValidationError } from './lib/schema.mjs'
import { JsonSyncStore } from './lib/store.mjs'

const JSON_LIMIT = 1024 * 1024
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_ATTEMPTS = 5

function json(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders
  })
  response.end(JSON.stringify(body))
}

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > JSON_LIMIT) {
      const error = new Error('request body is too large')
      error.statusCode = 413
      throw error
    }
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  } catch {
    const error = new Error('request body must be valid JSON')
    error.statusCode = 400
    throw error
  }
}

function bearerToken(request) {
  const authorization = request.headers.authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(authorization)
  return match?.[1] || ''
}

export async function createApiServer(config) {
  const store = config.store || new JsonSyncStore(config.dataFile)
  await store.init()
  const failures = new Map()

  return http.createServer(async (request, response) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    }

    if (request.method === 'OPTIONS') {
      response.writeHead(204, corsHeaders)
      return response.end()
    }

    const url = new URL(request.url || '/', 'http://localhost')
    try {
      if (request.method === 'GET' && url.pathname === '/health') {
        return json(response, 200, { status: 'ok' }, corsHeaders)
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/login') {
        const ip = request.socket.remoteAddress || 'unknown'
        const now = Date.now()
        const current = failures.get(ip)
        if (current && current.resetAt > now && current.count >= LOGIN_ATTEMPTS) {
          return json(response, 429, { error: 'too_many_attempts' }, {
            ...corsHeaders,
            'Retry-After': String(Math.ceil((current.resetAt - now) / 1000))
          })
        }

        const body = await readJson(request)
        if (!verifyPassword(body.password, config.passwordSalt, config.passwordHash)) {
          const next = current && current.resetAt > now
            ? { ...current, count: current.count + 1 }
            : { count: 1, resetAt: now + LOGIN_WINDOW_MS }
          failures.set(ip, next)
          return json(response, 401, { error: 'invalid_password' }, corsHeaders)
        }

        failures.delete(ip)
        const token = createSessionToken(config.sessionSecret, now, config.sessionTtlSeconds)
        return json(response, 200, {
          token,
          expiresAt: now + config.sessionTtlSeconds * 1000
        }, corsHeaders)
      }

      const session = verifySessionToken(bearerToken(request), config.sessionSecret)
      if (!session) return json(response, 401, { error: 'unauthorized' }, corsHeaders)

      if (request.method === 'GET' && url.pathname === '/api/auth/session') {
        return json(response, 200, { authenticated: true, expiresAt: session.expiresAt }, corsHeaders)
      }

      if (request.method === 'GET' && url.pathname === '/api/sync') {
        return json(response, 200, { ...store.read(), serverTime: Date.now() }, corsHeaders)
      }

      if (request.method === 'POST' && url.pathname === '/api/sync') {
        const merged = await store.merge(await readJson(request))
        return json(response, 200, { ...merged, serverTime: Date.now() }, corsHeaders)
      }

      return json(response, 404, { error: 'not_found' }, corsHeaders)
    } catch (error) {
      if (error instanceof ValidationError) {
        return json(response, 400, { error: 'invalid_payload', message: error.message }, corsHeaders)
      }
      if (error?.statusCode) {
        return json(response, error.statusCode, { error: error.message }, corsHeaders)
      }
      console.error('[glimmer-notes] request failed', error)
      return json(response, 500, { error: 'internal_error' }, corsHeaders)
    }
  })
}

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable ${name}`)
  return value
}

export async function startApiFromEnvironment() {
  const port = Number(process.env.PORT || 8769)
  const host = process.env.HOST || '0.0.0.0'
  const server = await createApiServer({
    dataFile: process.env.DATA_FILE || './data/store.json',
    passwordSalt: required('AUTH_PASSWORD_SALT'),
    passwordHash: required('AUTH_PASSWORD_HASH'),
    sessionSecret: required('AUTH_SESSION_SECRET'),
    sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS || 2_592_000)
  })
  server.listen(port, host, () => {
    console.log(`[glimmer-notes] backend listening on ${host}:${port}`)
  })
  return server
}
