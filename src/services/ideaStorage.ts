import Taro from '@tarojs/taro'
import { DEFAULT_THEME, normalizeColorSlot } from '@/theme'
import { createId } from '@/utils/id'
import {
  DEFAULT_PROJECT_COLOR_SLOT,
  DEFAULT_PROJECT_ID,
  LEGACY_PROJECT_TAG_ID
} from '@/types/idea'
import type { Idea, IdeaProject, IdeaTag, IdeaTombstone } from '@/types/idea'
import type { IdeaColorSlot } from '@/theme'

const STORAGE_KEY = 'idea-space-v7-data'
const V6_STORAGE_KEY = 'idea-space-v6-data'
const V5_STORAGE_KEY = 'idea-space-v5-data'
const V4_STORAGE_KEY = 'idea-space-v4-data'
const V3_STORAGE_KEY = 'idea-space-v3-data'
const TOMBSTONE_STORAGE_KEY = 'idea-space-v1-tombstones'
const TAG_STORAGE_KEY = 'idea-space-v1-tags'
const PROJECT_STORAGE_KEY = 'idea-space-v1-projects'

type StoredIdea = Omit<Idea, 'colorSlot' | 'updatedAt' | 'projectId' | 'tagIds' | 'archivedAt'> & {
  colorSlot?: unknown
  color?: unknown
  updatedAt?: unknown
  projectId?: unknown
  tagIds?: unknown
  tagId?: unknown
  archivedAt?: unknown
}

export interface LocalIdeaState {
  ideas: Idea[]
  projects: IdeaProject[]
  tags: IdeaTag[]
  tombstones: IdeaTombstone[]
  hasPersistedIdeas: boolean
}

export const DEFAULT_PROJECT: IdeaProject = Object.freeze({
  id: DEFAULT_PROJECT_ID,
  name: '默认项目',
  colorSlot: DEFAULT_PROJECT_COLOR_SLOT,
  createdAt: 0,
  updatedAt: 0,
  isDefault: true
})

function legacyColorSlot(color: unknown, id: string): IdeaColorSlot {
  if (typeof color === 'string') {
    const normalized = color.toLowerCase()
    const index = DEFAULT_THEME.ideaPalette.findIndex((value) => value.toLowerCase() === normalized)
    if (index >= 0) return index as IdeaColorSlot
  }
  return normalizeColorSlot(undefined, id)
}

function normalizeIdea(idea: StoredIdea): Idea {
  const { color, colorSlot, updatedAt, projectId, tagIds, tagId, archivedAt, ...rest } = idea
  const normalizedProjectId = typeof projectId === 'string' && projectId ? projectId : DEFAULT_PROJECT_ID
  const legacyTagIds = typeof tagId === 'string' && tagId && tagId !== LEGACY_PROJECT_TAG_ID ? [tagId] : []
  const normalizedTagIds = Array.isArray(tagIds)
    ? [...new Set(tagIds.filter((id): id is string => typeof id === 'string' && !!id && id !== LEGACY_PROJECT_TAG_ID))]
    : legacyTagIds
  return {
    ...rest,
    updatedAt: typeof updatedAt === 'number' ? updatedAt : idea.createdAt,
    colorSlot: typeof colorSlot === 'number'
      ? normalizeColorSlot(colorSlot, idea.id)
      : legacyColorSlot(color, idea.id),
    projectId: normalizedProjectId,
    tagIds: normalizedTagIds,
    priority: idea.priority || 'inbox',
    archivedAt: typeof archivedAt === 'number' ? archivedAt : null
  }
}

function normalizeTag(value: unknown): IdeaTag | null {
  if (!value || typeof value !== 'object') return null
  const tag = value as Partial<IdeaTag>
  if (typeof tag.id !== 'string' || !tag.id || typeof tag.name !== 'string' || !tag.name.trim()) return null
  return {
    id: tag.id,
    name: tag.name.trim().slice(0, 12),
    colorSlot: normalizeColorSlot(tag.colorSlot, tag.id),
    createdAt: typeof tag.createdAt === 'number' ? tag.createdAt : 0,
    updatedAt: typeof tag.updatedAt === 'number' ? tag.updatedAt : 0
  }
}

function normalizeTags(values: unknown): IdeaTag[] {
  const custom = Array.isArray(values)
    ? values.map(normalizeTag).filter((tag): tag is IdeaTag => !!tag && tag.id !== LEGACY_PROJECT_TAG_ID)
    : []
  const unique = new Map(custom.map((tag) => [tag.id, tag]))
  return [...unique.values()]
}

function normalizeProject(value: unknown): IdeaProject | null {
  if (!value || typeof value !== 'object') return null
  const project = value as Partial<IdeaProject>
  if (typeof project.id !== 'string' || !project.id || typeof project.name !== 'string' || !project.name.trim()) return null
  return {
    id: project.id,
    name: project.name.trim().slice(0, 16),
    colorSlot: normalizeColorSlot(project.colorSlot, project.id),
    createdAt: typeof project.createdAt === 'number' ? project.createdAt : 0,
    updatedAt: typeof project.updatedAt === 'number' ? project.updatedAt : 0,
    isDefault: project.id === DEFAULT_PROJECT_ID
  }
}

function normalizeProjects(values: unknown): IdeaProject[] {
  const custom = Array.isArray(values)
    ? values.map(normalizeProject).filter((project): project is IdeaProject => !!project && project.id !== DEFAULT_PROJECT_ID)
    : []
  const unique = new Map(custom.map((project) => [project.id, project]))
  return [DEFAULT_PROJECT, ...unique.values()]
}

function seedIdeas(): Idea[] {
  const now = Date.now()
  return [
    { id: createId(), text: '做一个打开微信就能立刻记录灵感的工具', createdAt: now - 22 * 60_000, updatedAt: now - 22 * 60_000, colorSlot: DEFAULT_PROJECT_COLOR_SLOT, projectId: DEFAULT_PROJECT_ID, tagIds: [], pinned: false, priority: 'inbox', archivedAt: null },
    { id: createId(), text: '游戏升级后直接给颜料，杀敌只是升级手段', createdAt: now - 57 * 60_000, updatedAt: now - 57 * 60_000, colorSlot: DEFAULT_PROJECT_COLOR_SLOT, projectId: DEFAULT_PROJECT_ID, tagIds: [], pinned: false, priority: 'urgent', archivedAt: null },
    { id: createId(), text: '首页不要列表，做成会轻微漂浮的 Idea Space', createdAt: now - 91 * 60_000, updatedAt: now - 91 * 60_000, colorSlot: DEFAULT_PROJECT_COLOR_SLOT, projectId: DEFAULT_PROJECT_ID, tagIds: [], pinned: true, priority: 'important', archivedAt: null },
    { id: createId(), text: '以后可以让 AI 自动把相关碎片连起来', createdAt: now - 125 * 60_000, updatedAt: now - 125 * 60_000, colorSlot: DEFAULT_PROJECT_COLOR_SLOT, projectId: DEFAULT_PROJECT_ID, tagIds: [], pinned: false, priority: 'important', archivedAt: null },
    { id: createId(), text: '记录动作一定要在 3 秒内完成', createdAt: now - 162 * 60_000, updatedAt: now - 162 * 60_000, colorSlot: DEFAULT_PROJECT_COLOR_SLOT, projectId: DEFAULT_PROJECT_ID, tagIds: [], pinned: false, priority: 'quick', archivedAt: null },
    { id: createId(), text: 'Web 端更适合整理，微信端只负责 capture', createdAt: now - 196 * 60_000, updatedAt: now - 196 * 60_000, colorSlot: DEFAULT_PROJECT_COLOR_SLOT, projectId: DEFAULT_PROJECT_ID, tagIds: [], pinned: false, priority: 'inbox', archivedAt: null },
    { id: createId(), text: '保存时让文字缩成粒子飞进空间里', createdAt: now - 230 * 60_000, updatedAt: now - 230 * 60_000, colorSlot: DEFAULT_PROJECT_COLOR_SLOT, projectId: DEFAULT_PROJECT_ID, tagIds: [], pinned: false, priority: 'inbox', archivedAt: null }
  ]
}

export function loadTags(): IdeaTag[] {
  try {
    return normalizeTags(Taro.getStorageSync(TAG_STORAGE_KEY) as unknown)
  } catch (error) {
    console.warn('[IdeaSpace] load tags failed', error)
    return []
  }
}

export function loadProjects(): IdeaProject[] {
  try {
    return normalizeProjects(Taro.getStorageSync(PROJECT_STORAGE_KEY) as unknown)
  } catch (error) {
    console.warn('[IdeaSpace] load projects failed', error)
    return [DEFAULT_PROJECT]
  }
}

function alignIdeasToProjects(ideas: Idea[], projects: IdeaProject[]): Idea[] {
  return ideas.map((idea) => {
    const project = projects.find((item) => item.id === idea.projectId) || DEFAULT_PROJECT
    return { ...idea, projectId: project.id, colorSlot: project.colorSlot }
  })
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
    const tags = loadTags()
    const projects = loadProjects()
    const stored = Taro.getStorageSync(STORAGE_KEY) as StoredIdea[] | undefined
    if (Array.isArray(stored)) {
      return { ideas: alignIdeasToProjects(stored.map(normalizeIdea), projects), projects, tags, tombstones: loadTombstones(), hasPersistedIdeas: true }
    }

    const v6 = Taro.getStorageSync(V6_STORAGE_KEY) as StoredIdea[] | undefined
    const v5 = Taro.getStorageSync(V5_STORAGE_KEY) as StoredIdea[] | undefined
    const v4 = Taro.getStorageSync(V4_STORAGE_KEY) as StoredIdea[] | undefined
    const v3 = Taro.getStorageSync(V3_STORAGE_KEY) as StoredIdea[] | undefined
    const legacy = Array.isArray(v6) ? v6 : Array.isArray(v5) ? v5 : Array.isArray(v4) ? v4 : v3
    if (legacy) {
      const migrated = alignIdeasToProjects(legacy.map(normalizeIdea), projects)
      Taro.setStorageSync(STORAGE_KEY, migrated)
      Taro.setStorageSync(TAG_STORAGE_KEY, tags)
      Taro.setStorageSync(PROJECT_STORAGE_KEY, projects)
      return { ideas: migrated, projects, tags, tombstones: loadTombstones(), hasPersistedIdeas: true }
    }
  } catch (error) {
    console.warn('[IdeaSpace] load storage failed', error)
  }
  return { ideas: seedIdeas(), projects: [DEFAULT_PROJECT], tags: [], tombstones: [], hasPersistedIdeas: false }
}

export function loadIdeas(): Idea[] {
  return loadIdeaState().ideas
}

export function saveIdeaState(
  ideas: Idea[],
  tombstones: IdeaTombstone[],
  tags: IdeaTag[] = loadTags(),
  projects: IdeaProject[] = loadProjects()
): void {
  try {
    Taro.setStorageSync(STORAGE_KEY, ideas)
    Taro.setStorageSync(TOMBSTONE_STORAGE_KEY, tombstones)
    Taro.setStorageSync(TAG_STORAGE_KEY, normalizeTags(tags))
    Taro.setStorageSync(PROJECT_STORAGE_KEY, normalizeProjects(projects))
  } catch (error) {
    console.warn('[IdeaSpace] save storage failed', error)
  }
}

export function saveTags(tags: IdeaTag[]): void {
  try {
    Taro.setStorageSync(TAG_STORAGE_KEY, normalizeTags(tags))
  } catch (error) {
    console.warn('[IdeaSpace] save tags failed', error)
  }
}

export function saveProjects(projects: IdeaProject[]): void {
  try {
    Taro.setStorageSync(PROJECT_STORAGE_KEY, normalizeProjects(projects))
  } catch (error) {
    console.warn('[IdeaSpace] save projects failed', error)
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
