import Taro from '@tarojs/taro'
import { collapseDemoSeedDuplicates, materializeDemoSeeds } from '@/constants/demoSeeds'
import { DEFAULT_THEME, normalizeColorSlot } from '@/theme'
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
const ACTIVE_SPACE_KEY = 'idea-space-sync-space-key-v1'
const LEGACY_MIGRATED_KEY = 'idea-space-legacy-scope-migrated-v1'

let storageScope = ''

function scoped(base: string): string {
  return storageScope ? `${base}::${storageScope}` : base
}

function ideaKey(): string { return scoped(STORAGE_KEY) }
function tombstoneKey(): string { return scoped(TOMBSTONE_STORAGE_KEY) }
function tagKey(): string { return scoped(TAG_STORAGE_KEY) }
function projectKey(): string { return scoped(PROJECT_STORAGE_KEY) }

function readStoredSpaceKey(): string {
  try {
    const value = Taro.getStorageSync(ACTIVE_SPACE_KEY) as unknown
    return typeof value === 'string' ? value.normalize('NFC').trim() : ''
  } catch {
    return ''
  }
}

function copyIfPresent(from: string, to: string) {
  const value = Taro.getStorageSync(from) as unknown
  if (value == null || value === '') return
  Taro.setStorageSync(to, value)
}

function migrateUnscopedData(target: string) {
  try {
    if (Taro.getStorageSync(LEGACY_MIGRATED_KEY)) return
    const scopedIdeas = `${STORAGE_KEY}::${target}`
    const scopedExisting = Taro.getStorageSync(scopedIdeas) as unknown
    const legacy = readUnscopedIdeas()
    if (!Array.isArray(scopedExisting) && Array.isArray(legacy)) {
      Taro.setStorageSync(scopedIdeas, legacy)
      copyIfPresent(TOMBSTONE_STORAGE_KEY, `${TOMBSTONE_STORAGE_KEY}::${target}`)
      copyIfPresent(TAG_STORAGE_KEY, `${TAG_STORAGE_KEY}::${target}`)
      copyIfPresent(PROJECT_STORAGE_KEY, `${PROJECT_STORAGE_KEY}::${target}`)
    }
    Taro.setStorageSync(LEGACY_MIGRATED_KEY, target)
  } catch (error) {
    console.warn('[IdeaSpace] migrate space storage failed', error)
  }
}

function readUnscopedIdeas(): unknown {
  const current = Taro.getStorageSync(STORAGE_KEY) as unknown
  if (Array.isArray(current)) return current
  for (const key of [V6_STORAGE_KEY, V5_STORAGE_KEY, V4_STORAGE_KEY, V3_STORAGE_KEY]) {
    const value = Taro.getStorageSync(key) as unknown
    if (Array.isArray(value)) return value
  }
  return undefined
}

export function activateIdeaStorageScope(next: string) {
  const normalized = next.normalize('NFC').trim()
  if (normalized === storageScope) return
  storageScope = normalized
  if (normalized) migrateUnscopedData(normalized)
}

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
  // Stable IDs — re-seeding must not invent new records that sync would keep forever.
  return materializeDemoSeeds()
}

function repairDemoSeedDuplicates(
  ideas: Idea[],
  tombstones: IdeaTombstone[],
  tags: IdeaTag[],
  projects: IdeaProject[]
): { ideas: Idea[]; tombstones: IdeaTombstone[] } {
  const collapsed = collapseDemoSeedDuplicates(ideas, tombstones)
  if (collapsed.removedIds.length === 0) return { ideas, tombstones }
  try {
    Taro.setStorageSync(ideaKey(), collapsed.ideas)
    Taro.setStorageSync(tombstoneKey(), collapsed.tombstones)
    Taro.setStorageSync(tagKey(), normalizeTags(tags))
    Taro.setStorageSync(projectKey(), normalizeProjects(projects))
  } catch (error) {
    console.warn('[IdeaSpace] repair demo seed duplicates failed', error)
  }
  return { ideas: collapsed.ideas, tombstones: collapsed.tombstones }
}

export function loadTags(): IdeaTag[] {
  try {
    return normalizeTags(Taro.getStorageSync(tagKey()) as unknown)
  } catch (error) {
    console.warn('[IdeaSpace] load tags failed', error)
    return []
  }
}

export function loadProjects(): IdeaProject[] {
  try {
    return normalizeProjects(Taro.getStorageSync(projectKey()) as unknown)
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
  const stored = Taro.getStorageSync(tombstoneKey()) as unknown
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
    const stored = Taro.getStorageSync(ideaKey()) as StoredIdea[] | undefined
    if (Array.isArray(stored)) {
      const ideas = alignIdeasToProjects(stored.map(normalizeIdea), projects)
      const tombstones = loadTombstones()
      const repaired = repairDemoSeedDuplicates(ideas, tombstones, tags, projects)
      return { ideas: repaired.ideas, projects, tags, tombstones: repaired.tombstones, hasPersistedIdeas: true }
    }

    if (storageScope) {
      return { ideas: seedIdeas(), projects, tags, tombstones: [], hasPersistedIdeas: false }
    }

    const v6 = Taro.getStorageSync(V6_STORAGE_KEY) as StoredIdea[] | undefined
    const v5 = Taro.getStorageSync(V5_STORAGE_KEY) as StoredIdea[] | undefined
    const v4 = Taro.getStorageSync(V4_STORAGE_KEY) as StoredIdea[] | undefined
    const v3 = Taro.getStorageSync(V3_STORAGE_KEY) as StoredIdea[] | undefined
    const legacy = Array.isArray(v6) ? v6 : Array.isArray(v5) ? v5 : Array.isArray(v4) ? v4 : v3
    if (legacy) {
      const migrated = alignIdeasToProjects(legacy.map(normalizeIdea), projects)
      const tombstones = loadTombstones()
      const repaired = repairDemoSeedDuplicates(migrated, tombstones, tags, projects)
      Taro.setStorageSync(ideaKey(), repaired.ideas)
      Taro.setStorageSync(tombstoneKey(), repaired.tombstones)
      Taro.setStorageSync(tagKey(), tags)
      Taro.setStorageSync(projectKey(), projects)
      return { ideas: repaired.ideas, projects, tags, tombstones: repaired.tombstones, hasPersistedIdeas: true }
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
    Taro.setStorageSync(ideaKey(), ideas)
    Taro.setStorageSync(tombstoneKey(), tombstones)
    Taro.setStorageSync(tagKey(), normalizeTags(tags))
    Taro.setStorageSync(projectKey(), normalizeProjects(projects))
  } catch (error) {
    console.warn('[IdeaSpace] save storage failed', error)
  }
}

export function saveTags(tags: IdeaTag[]): void {
  try {
    Taro.setStorageSync(tagKey(), normalizeTags(tags))
  } catch (error) {
    console.warn('[IdeaSpace] save tags failed', error)
  }
}

export function saveProjects(projects: IdeaProject[]): void {
  try {
    Taro.setStorageSync(projectKey(), normalizeProjects(projects))
  } catch (error) {
    console.warn('[IdeaSpace] save projects failed', error)
  }
}

export function saveIdeas(ideas: Idea[]): void {
  try {
    Taro.setStorageSync(ideaKey(), ideas)
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
    Taro.setStorageSync(tombstoneKey(), next)
  } catch (error) {
    console.warn('[IdeaSpace] save deletion marker failed', error)
  }
}

export function removeIdeaDeletion(id: string): void {
  try {
    Taro.setStorageSync(
      tombstoneKey(),
      loadTombstones().filter((item) => item.id !== id)
    )
  } catch (error) {
    console.warn('[IdeaSpace] remove deletion marker failed', error)
  }
}

activateIdeaStorageScope(readStoredSpaceKey())
