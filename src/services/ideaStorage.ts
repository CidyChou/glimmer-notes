import Taro from '@tarojs/taro'
import { DEFAULT_THEME, normalizeColorSlot } from '@/theme'
import { createId } from '@/utils/id'
import type { Idea, IdeaTombstone } from '@/types/idea'
import type { IdeaColorSlot } from '@/theme'

const STORAGE_KEY = 'idea-space-v5-data'
const V4_STORAGE_KEY = 'idea-space-v4-data'
const V3_STORAGE_KEY = 'idea-space-v3-data'
const TOMBSTONE_STORAGE_KEY = 'idea-space-v1-tombstones'

type StoredIdea = Omit<Idea, 'colorSlot' | 'updatedAt'> & {
  colorSlot?: unknown
  color?: unknown
  updatedAt?: unknown
}

export interface LocalIdeaState {
  ideas: Idea[]
  tombstones: IdeaTombstone[]
  hasPersistedIdeas: boolean
}

function legacyColorSlot(color: unknown, id: string): IdeaColorSlot {
  if (typeof color === 'string') {
    const normalized = color.toLowerCase()
    const index = DEFAULT_THEME.ideaPalette.findIndex((value) => value.toLowerCase() === normalized)
    if (index >= 0) return index as IdeaColorSlot
  }
  return normalizeColorSlot(undefined, id)
}

function normalizeIdea(idea: StoredIdea): Idea {
  const { color, colorSlot, updatedAt, ...rest } = idea
  return {
    ...rest,
    updatedAt: typeof updatedAt === 'number' ? updatedAt : idea.createdAt,
    colorSlot: typeof colorSlot === 'number'
      ? normalizeColorSlot(colorSlot, idea.id)
      : legacyColorSlot(color, idea.id),
    priority: idea.priority || 'inbox'
  }
}

function seedIdeas(): Idea[] {
  const now = Date.now()
  return [
    { id: createId(), text: '做一个打开微信就能立刻记录灵感的工具', createdAt: now - 22 * 60_000, updatedAt: now - 22 * 60_000, colorSlot: 0, pinned: false, priority: 'inbox' },
    { id: createId(), text: '游戏升级后直接给颜料，杀敌只是升级手段', createdAt: now - 57 * 60_000, updatedAt: now - 57 * 60_000, colorSlot: 1, pinned: false, priority: 'urgent' },
    { id: createId(), text: '首页不要列表，做成会轻微漂浮的 Idea Space', createdAt: now - 91 * 60_000, updatedAt: now - 91 * 60_000, colorSlot: 2, pinned: true, priority: 'important' },
    { id: createId(), text: '以后可以让 AI 自动把相关碎片连起来', createdAt: now - 125 * 60_000, updatedAt: now - 125 * 60_000, colorSlot: 3, pinned: false, priority: 'important' },
    { id: createId(), text: '记录动作一定要在 3 秒内完成', createdAt: now - 162 * 60_000, updatedAt: now - 162 * 60_000, colorSlot: 4, pinned: false, priority: 'quick' },
    { id: createId(), text: 'Web 端更适合整理，微信端只负责 capture', createdAt: now - 196 * 60_000, updatedAt: now - 196 * 60_000, colorSlot: 5, pinned: false, priority: 'inbox' },
    { id: createId(), text: '保存时让文字缩成粒子飞进空间里', createdAt: now - 230 * 60_000, updatedAt: now - 230 * 60_000, colorSlot: 6, pinned: false, priority: 'inbox' }
  ]
}

function loadTombstones(): IdeaTombstone[] {
  const stored = Taro.getStorageSync(TOMBSTONE_STORAGE_KEY) as unknown
  if (!Array.isArray(stored)) return []
  return stored.flatMap((value) => {
    if (
      value && typeof value === 'object' &&
      typeof value.id === 'string' &&
      typeof value.deletedAt === 'number'
    ) return [{ id: value.id, deletedAt: value.deletedAt }]
    return []
  })
}

export function loadIdeaState(): LocalIdeaState {
  try {
    const stored = Taro.getStorageSync(STORAGE_KEY) as StoredIdea[] | undefined
    if (Array.isArray(stored)) {
      return { ideas: stored.map(normalizeIdea), tombstones: loadTombstones(), hasPersistedIdeas: true }
    }

    const v4 = Taro.getStorageSync(V4_STORAGE_KEY) as StoredIdea[] | undefined
    const v3 = Taro.getStorageSync(V3_STORAGE_KEY) as StoredIdea[] | undefined
    const legacy = Array.isArray(v4) ? v4 : v3
    if (legacy) {
      const migrated = legacy.map(normalizeIdea)
      Taro.setStorageSync(STORAGE_KEY, migrated)
      return { ideas: migrated, tombstones: loadTombstones(), hasPersistedIdeas: true }
    }
  } catch (error) {
    console.warn('[IdeaSpace] load storage failed', error)
  }
  return { ideas: seedIdeas(), tombstones: [], hasPersistedIdeas: false }
}

export function loadIdeas(): Idea[] {
  return loadIdeaState().ideas
}

export function saveIdeaState(ideas: Idea[], tombstones: IdeaTombstone[]): void {
  try {
    Taro.setStorageSync(STORAGE_KEY, ideas)
    Taro.setStorageSync(TOMBSTONE_STORAGE_KEY, tombstones)
  } catch (error) {
    console.warn('[IdeaSpace] save storage failed', error)
  }
}

export function saveIdeas(ideas: Idea[]): void {
  try {
    Taro.setStorageSync(STORAGE_KEY, ideas)
  } catch (error) {
    console.warn('[IdeaSpace] save storage failed', error)
  }
}

export function recordIdeaDeletion(id: string, deletedAt: number): void {
  try {
    const tombstones = loadTombstones()
    const existing = tombstones.find((item) => item.id === id)
    const next = existing
      ? tombstones.map((item) => item.id === id && deletedAt > item.deletedAt ? { id, deletedAt } : item)
      : [{ id, deletedAt }, ...tombstones]
    Taro.setStorageSync(TOMBSTONE_STORAGE_KEY, next)
  } catch (error) {
    console.warn('[IdeaSpace] save deletion marker failed', error)
  }
}
