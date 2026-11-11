import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_SAVED_SPACES, removeSavedSpace, upsertSavedSpace } from './savedSpaces'
import type { SavedSpace } from './savedSpaces'

function space(key: string, lastUsedAt: number): SavedSpace {
  return { key, token: `token-${key}`, initialized: true, lastUsedAt }
}

test('saved spaces keep an existing key and reject an 11th new key', () => {
  let spaces: SavedSpace[] = []
  for (let index = 0; index < MAX_SAVED_SPACES; index += 1) {
    const result = upsertSavedSpace(spaces, space(`space-${index}`, index + 1))
    assert.equal(result.error, null)
    spaces = result.spaces
  }
  assert.equal(spaces.length, 10)
  assert.equal(spaces[0].key, 'space-9')

  const rejected = upsertSavedSpace(spaces, space('another-space', 100))
  assert.equal(rejected.error, '最多保存 10 个仓库，请先移除一个')
  assert.equal(rejected.spaces.length, 10)

  const updated = upsertSavedSpace(spaces, { ...space('space-0', 200), token: 'fresh' })
  assert.equal(updated.error, null)
  assert.equal(updated.spaces.length, 10)
  assert.equal(updated.spaces[0].key, 'space-0')
  assert.equal(updated.spaces[0].token, 'fresh')
})

test('removing a space does not affect the others', () => {
  const spaces = [space('sample-space', 2), space('another-space', 1)]
  assert.deepEqual(removeSavedSpace(spaces, ' sample-space ').map((item) => item.key), ['another-space'])
})
