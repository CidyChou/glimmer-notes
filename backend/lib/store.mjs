import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { validateStoredState, validateSyncPayload } from './schema.mjs'

export const EMPTY_STATE = Object.freeze({ schemaVersion: 3, ideas: [], projects: [], tags: [], tombstones: [] })

function chooseNewest(records, timestampField) {
  const result = new Map()
  for (const record of records) {
    const existing = result.get(record.id)
    if (!existing || record[timestampField] > existing[timestampField]) {
      result.set(record.id, record)
    }
  }
  return result
}

export function mergeStates(serverState, clientState) {
  const server = validateSyncPayload(serverState)
  const client = validateSyncPayload(clientState)
  const ideas = chooseNewest([...server.ideas, ...client.ideas], 'updatedAt')
  const projects = chooseNewest([...(server.projects || []), ...(client.projects || [])], 'updatedAt')
  const tags = chooseNewest([...(server.tags || []), ...(client.tags || [])], 'updatedAt')
  const tombstones = chooseNewest([...server.tombstones, ...client.tombstones], 'deletedAt')
  const ids = new Set([...ideas.keys(), ...tombstones.keys()])
  const mergedIdeas = []
  const mergedTombstones = []

  for (const id of ids) {
    const idea = ideas.get(id)
    const tombstone = tombstones.get(id)
    if (tombstone && (!idea || tombstone.deletedAt >= idea.updatedAt)) {
      mergedTombstones.push(tombstone)
    } else if (idea) {
      mergedIdeas.push(idea)
    }
  }

  mergedIdeas.sort((left, right) => right.createdAt - left.createdAt || left.id.localeCompare(right.id))
  mergedTombstones.sort((left, right) => right.deletedAt - left.deletedAt || left.id.localeCompare(right.id))
  return { schemaVersion: 3, ideas: mergedIdeas, projects: [...projects.values()], tags: [...tags.values()], tombstones: mergedTombstones }
}

export class JsonSyncStore {
  constructor(filePath) {
    this.filePath = filePath
    this.state = { ...EMPTY_STATE, ideas: [], projects: [], tags: [], tombstones: [] }
    this.writeQueue = Promise.resolve()
  }

  async init() {
    await mkdir(path.dirname(this.filePath), { recursive: true })
    try {
      const raw = await readFile(this.filePath, 'utf8')
      this.state = validateStoredState(JSON.parse(raw))
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      await this.persist()
    }
    return this.read()
  }

  read() {
    return structuredClone(this.state)
  }

  async merge(clientState) {
    this.state = mergeStates(this.state, clientState)
    await this.persist()
    return this.read()
  }

  async persist() {
    const snapshot = JSON.stringify(this.state, null, 2) + '\n'
    const tempFile = `${this.filePath}.tmp-${process.pid}`
    this.writeQueue = this.writeQueue.then(async () => {
      await writeFile(tempFile, snapshot, { mode: 0o600 })
      await rename(tempFile, this.filePath)
    })
    await this.writeQueue
  }
}
