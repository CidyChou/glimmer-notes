import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { hashPassword, createSessionToken, verifySessionToken } from '../lib/auth.mjs'
import { JsonSyncStore, mergeStates } from '../lib/store.mjs'
import { createApiServer } from '../server.mjs'

function idea(overrides = {}) {
  return {
    id: 'idea-1',
    text: 'An idea',
    createdAt: 100,
    updatedAt: 100,
    colorSlot: 0,
    projectId: 'project-default',
    tagIds: [],
    pinned: false,
    priority: 'inbox',
    archivedAt: null,
    ...overrides
  }
}

test('newer records win and an equally new tombstone wins over a live idea', () => {
  const merged = mergeStates(
    { ideas: [idea()], projects: [], tags: [], tombstones: [] },
    { ideas: [idea({ text: 'New', updatedAt: 200 })], projects: [], tags: [], tombstones: [{ id: 'idea-1', deletedAt: 200 }] }
  )
  assert.deepEqual(merged.ideas, [])
  assert.deepEqual(merged.tombstones, [{ id: 'idea-1', deletedAt: 200 }])
})

test('re-seeded demo notes with different ids collapse to one idea', () => {
  const demoText = '以后可以让 AI 自动把相关碎片连起来'
  const merged = mergeStates(
    {
      ideas: [
        idea({ id: 'random-a', text: demoText, createdAt: 100, updatedAt: 100 }),
        idea({ id: 'random-b', text: demoText, createdAt: 120, updatedAt: 120 })
      ],
      projects: [],
      tags: [],
      tombstones: []
    },
    {
      ideas: [idea({ id: 'seed-ai-link', text: demoText, createdAt: 90, updatedAt: 90 })],
      projects: [],
      tags: [],
      tombstones: []
    }
  )
  assert.equal(merged.ideas.length, 1)
  assert.equal(merged.ideas[0].id, 'seed-ai-link')
  assert.equal(merged.ideas[0].text, demoText)
  assert.equal(merged.tombstones.length, 2)
  assert.ok(merged.tombstones.every((item) => item.id === 'random-a' || item.id === 'random-b'))
})

test('user notes with the same text are not collapsed', () => {
  const merged = mergeStates(
    { ideas: [idea({ id: 'u1', text: '同一句话我想记两次', createdAt: 1, updatedAt: 1 })], projects: [], tags: [], tombstones: [] },
    { ideas: [idea({ id: 'u2', text: '同一句话我想记两次', createdAt: 2, updatedAt: 2 })], projects: [], tags: [], tombstones: [] }
  )
  assert.equal(merged.ideas.length, 2)
})

test('a newer live record can intentionally restore a deleted idea', () => {
  const merged = mergeStates(
    { ideas: [], projects: [], tags: [], tombstones: [{ id: 'idea-1', deletedAt: 200 }] },
    { ideas: [idea({ updatedAt: 201 })], projects: [], tags: [], tombstones: [] }
  )
  assert.equal(merged.ideas[0].id, 'idea-1')
  assert.deepEqual(merged.tombstones, [])
})

test('legacy single tags migrate to a default project plus multi-tag array', () => {
  const merged = mergeStates(
    { ideas: [], projects: [], tags: [], tombstones: [] },
    {
      ideas: [idea({ projectId: undefined, tagIds: undefined, tagId: 'tag-legacy' })],
      projects: [],
      tags: [],
      tombstones: []
    }
  )
  assert.equal(merged.ideas[0].projectId, 'project-default')
  assert.deepEqual(merged.ideas[0].tagIds, ['tag-legacy'])
})

test('tags sync by id and keep the newest version', () => {
  const merged = mergeStates(
    {
      ideas: [],
      projects: [],
      tags: [{ id: 'tag-focus', name: '专注', colorSlot: 0, createdAt: 10, updatedAt: 10 }],
      tombstones: []
    },
    {
      ideas: [],
      projects: [],
      tags: [
        { id: 'tag-focus', name: '深度工作', colorSlot: 4, createdAt: 10, updatedAt: 20 },
        { id: 'tag-home', name: '生活', colorSlot: 2, createdAt: 20, updatedAt: 20 }
      ],
      tombstones: []
    }
  )

  assert.equal(merged.tags.length, 2)
  assert.deepEqual(merged.tags.find((tag) => tag.id === 'tag-focus'), {
    id: 'tag-focus',
    name: '深度工作',
    colorSlot: 4,
    createdAt: 10,
    updatedAt: 20
  })
})

test('session tokens are signed and expire', () => {
  const token = createSessionToken('secret', 1_000, 10)
  assert.equal(verifySessionToken(token, 'secret', 10_000).expiresAt, 11_000)
  assert.equal(verifySessionToken(token, 'wrong', 10_000), null)
  assert.equal(verifySessionToken(token, 'secret', 11_000), null)
})

test('JSON store persists merged state across restarts', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'glimmer-store-'))
  const file = path.join(directory, 'store.json')
  try {
    const first = new JsonSyncStore(file)
    await first.init()
    await first.merge({ ideas: [idea()], projects: [], tags: [], tombstones: [] })
    const second = new JsonSyncStore(file)
    await second.init()
    assert.equal(second.read().ideas[0].text, 'An idea')
    assert.equal(JSON.parse(await readFile(file, 'utf8')).schemaVersion, 3)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('HTTP API authenticates, enforces CORS, validates and syncs', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'glimmer-api-'))
  const passwordSalt = 'test-salt'
  const server = await createApiServer({
    dataFile: path.join(directory, 'store.json'),
    allowedOrigins: 'http://client.example',
    passwordSalt,
    passwordHash: hashPassword('correct horse', passwordSalt),
    sessionSecret: 'test-session-secret',
    sessionTtlSeconds: 60
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const baseUrl = `http://127.0.0.1:${address.port}`
  try {
    const health = await fetch(`${baseUrl}/health`)
    assert.equal(health.status, 200)

    const rejected = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong' })
    })
    assert.equal(rejected.status, 401)

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://client.example' },
      body: JSON.stringify({ password: 'correct horse' })
    })
    assert.equal(login.status, 200)
    assert.equal(login.headers.get('access-control-allow-origin'), 'http://client.example')
    const { token } = await login.json()

    const invalid = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ideas: [{ nope: true }], tombstones: [] })
    })
    assert.equal(invalid.status, 400)

    const synced = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ideas: [idea()], tombstones: [] })
    })
    assert.equal(synced.status, 200)
    assert.equal((await synced.json()).ideas[0].id, 'idea-1')
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    await rm(directory, { recursive: true, force: true })
  }
})
