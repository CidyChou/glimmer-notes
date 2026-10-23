export const MAX_SAVED_SPACES = 10

export interface SavedSpace {
  key: string
  token: string
  initialized: boolean
  lastUsedAt: number
}

export function normalizeSpaceKey(value: string): string {
  return value.normalize('NFC').trim()
}

export function upsertSavedSpace(
  list: SavedSpace[],
  space: SavedSpace
): { spaces: SavedSpace[]; error: string | null } {
  const key = normalizeSpaceKey(space.key)
  if (!key || key.length > 64) return { spaces: list, error: '密钥需要 1 到 64 个字符' }
  const existing = list.some((item) => item.key === key)
  if (!existing && list.length >= MAX_SAVED_SPACES) {
    return { spaces: list, error: '最多保存 10 个仓库，请先移除一个' }
  }
  const next = [
    { key, token: space.token, initialized: space.initialized, lastUsedAt: space.lastUsedAt || Date.now() },
    ...list.filter((item) => item.key !== key)
  ].sort((left, right) => right.lastUsedAt - left.lastUsedAt || left.key.localeCompare(right.key))
  return { spaces: next, error: null }
}

export function removeSavedSpace(list: SavedSpace[], key: string): SavedSpace[] {
  const normalized = normalizeSpaceKey(key)
  return list.filter((item) => item.key !== normalized)
}
