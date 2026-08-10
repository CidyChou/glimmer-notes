import { randomBytes } from 'node:crypto'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { hashPassword } from '../lib/auth.mjs'

const configPath = process.argv[2]
if (!configPath) throw new Error('Usage: node init-auth.mjs <config-file>')

const values = {}
try {
  const current = await readFile(configPath, 'utf8')
  for (const line of current.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (match) values[match[1]] = match[2]
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}

let initialPassword = ''
if (!values.AUTH_PASSWORD_HASH || !values.AUTH_PASSWORD_SALT) {
  initialPassword = randomBytes(18).toString('base64url')
  values.AUTH_PASSWORD_SALT = randomBytes(16).toString('hex')
  values.AUTH_PASSWORD_HASH = hashPassword(initialPassword, values.AUTH_PASSWORD_SALT)
}
if (!values.AUTH_SESSION_SECRET) values.AUTH_SESSION_SECRET = randomBytes(32).toString('hex')

values.HOST = process.env.HOST || values.HOST || '0.0.0.0'
values.PORT = process.env.PORT || values.PORT || '8769'
values.DATA_FILE = process.env.DATA_FILE || values.DATA_FILE || './data/store.json'
values.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || values.ALLOWED_ORIGINS || 'http://127.0.0.1:8770'
values.SESSION_TTL_SECONDS = process.env.SESSION_TTL_SECONDS || values.SESSION_TTL_SECONDS || '2592000'

await mkdir(path.dirname(configPath), { recursive: true })
await writeFile(configPath, Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 })
await chmod(configPath, 0o600)

if (initialPassword) {
  console.log(`GLIMMER_INITIAL_PASSWORD=${initialPassword}`)
  console.log('Save this password now. It will not be printed by later deployments.')
}
