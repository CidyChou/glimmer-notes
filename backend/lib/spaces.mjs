import { createHash } from 'node:crypto'
import { access, chmod, copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { JsonSyncStore } from './store.mjs'

export const DEFAULT_SPACE_KEY = 'zdy'
export const MAX_SPACE_KEY_LENGTH = 64

export function normalizeSpaceKey(value) {
  if (typeof value !== 'string') return ''
  return value.normalize('NFC').trim()
}

export function isValidSpaceKey(key) {
  return Boolean(key) && key.length <= MAX_SPACE_KEY_LENGTH && !/[\u0000-\u001f\u007f]/.test(key)
}

export function spaceIdForKey(key) {
  return createHash('sha256').update(normalizeSpaceKey(key), 'utf8').digest('hex')
}

export function isSpaceId(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

export async function migrateLegacyStore(dataDir, defaultKey = DEFAULT_SPACE_KEY) {
  const legacyFile = path.join(dataDir, 'store.json')
  const spacesDir = path.join(dataDir, 'spaces')
  const dest = path.join(spacesDir, `${spaceIdForKey(defaultKey)}.json`)
  try {
    await access(legacyFile)
  } catch {
    return { migrated: false, dest }
  }
  try {
    await access(dest)
    return { migrated: false, dest }
  } catch {
    await mkdir(spacesDir, { recursive: true })
    await copyFile(legacyFile, dest)
    await chmod(dest, 0o600)
    return { migrated: true, dest }
  }
}

export class SpaceRegistry {
  constructor(dataDir) {
    this.dataDir = dataDir
    this.spacesDir = path.join(dataDir, 'spaces')
    this.stores = new Map()
  }

  async init() {
    await mkdir(this.spacesDir, { recursive: true })
    await migrateLegacyStore(this.dataDir)
  }

  fileForSpace(spaceId) {
    if (!isSpaceId(spaceId)) throw new Error('invalid space id')
    return path.join(this.spacesDir, `${spaceId}.json`)
  }

  async getStore(spaceId) {
    const existing = this.stores.get(spaceId)
    if (existing) return existing
    const store = new JsonSyncStore(this.fileForSpace(spaceId))
    await store.init()
    this.stores.set(spaceId, store)
    return store
  }
}
