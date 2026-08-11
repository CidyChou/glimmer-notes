import type { PriorityKey } from '@/types/idea'
import type { Idea, IdeaTombstone } from '@/types/idea'
import { DEFAULT_PROJECT_COLOR_SLOT, DEFAULT_PROJECT_ID } from '@/types/idea'

/**
 * First-run demo notes. IDs MUST stay stable across devices/sessions.
 * Random IDs previously caused sync to treat every re-seed as a brand-new idea,
 * producing permanent duplicates of the same text (e.g. AI 连碎片).
 */
export interface DemoSeedDef {
  id: string
  text: string
  priority: PriorityKey
  pinned: boolean
  /** Minutes ago relative to "now" when materializing seeds */
  ageMin: number
}

export const DEMO_SEED_DEFS: readonly DemoSeedDef[] = [
  { id: 'seed-wechat-capture', text: '做一个打开微信就能立刻记录灵感的工具', priority: 'inbox', pinned: false, ageMin: 22 },
  { id: 'seed-game-paint', text: '游戏升级后直接给颜料，杀敌只是升级手段', priority: 'urgent', pinned: false, ageMin: 57 },
  { id: 'seed-idea-space', text: '首页不要列表，做成会轻微漂浮的 Idea Space', priority: 'important', pinned: true, ageMin: 91 },
  { id: 'seed-ai-link', text: '以后可以让 AI 自动把相关碎片连起来', priority: 'important', pinned: false, ageMin: 125 },
  { id: 'seed-3s-capture', text: '记录动作一定要在 3 秒内完成', priority: 'quick', pinned: false, ageMin: 162 },
  { id: 'seed-web-organize', text: 'Web 端更适合整理，微信端只负责 capture', priority: 'inbox', pinned: false, ageMin: 196 },
  { id: 'seed-particle-save', text: '保存时让文字缩成粒子飞进空间里', priority: 'inbox', pinned: false, ageMin: 230 }
]

export const DEMO_SEED_TEXTS = new Set(DEMO_SEED_DEFS.map((seed) => seed.text))
export const DEMO_SEED_IDS = new Set(DEMO_SEED_DEFS.map((seed) => seed.id))

export function isDemoSeedId(id: string): boolean {
  return id.startsWith('seed-') || DEMO_SEED_IDS.has(id)
}

export function isDemoSeedText(text: string): boolean {
  return DEMO_SEED_TEXTS.has(text)
}

export function materializeDemoSeeds(now = Date.now()): Idea[] {
  return DEMO_SEED_DEFS.map((seed) => {
    const at = now - seed.ageMin * 60_000
    return {
      id: seed.id,
      text: seed.text,
      createdAt: at,
      updatedAt: at,
      colorSlot: DEFAULT_PROJECT_COLOR_SLOT,
      projectId: DEFAULT_PROJECT_ID,
      tagIds: [],
      pinned: seed.pinned,
      priority: seed.priority,
      archivedAt: null
    }
  })
}

/**
 * Collapse accidental re-seeds of demo notes that used different random IDs.
 * Keeps one survivor per demo text (prefer stable seed-* id, then oldest).
 * Does NOT touch user notes whose text merely happens to match.
 * Wait — we DO collapse by exact demo text only, which is intentional:
 * those strings are product demo copy, not expected as intentional user dups.
 */
export function collapseDemoSeedDuplicates(
  ideas: Idea[],
  tombstones: IdeaTombstone[],
  now = Date.now()
): { ideas: Idea[]; tombstones: IdeaTombstone[]; removedIds: string[] } {
  const groups = new Map<string, Idea[]>()
  for (const idea of ideas) {
    if (!DEMO_SEED_TEXTS.has(idea.text)) continue
    const list = groups.get(idea.text)
    if (list) list.push(idea)
    else groups.set(idea.text, [idea])
  }

  const removedIds: string[] = []
  for (const group of groups.values()) {
    if (group.length <= 1) continue
    const ranked = [...group].sort((left, right) => {
      const leftStable = isDemoSeedId(left.id) ? 0 : 1
      const rightStable = isDemoSeedId(right.id) ? 0 : 1
      if (leftStable !== rightStable) return leftStable - rightStable
      if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt
      return left.id.localeCompare(right.id)
    })
    for (const duplicate of ranked.slice(1)) removedIds.push(duplicate.id)
  }

  if (removedIds.length === 0) {
    return { ideas, tombstones, removedIds }
  }

  const drop = new Set(removedIds)
  const nextIdeas = ideas.filter((idea) => !drop.has(idea.id))
  const tombstoneMap = new Map(tombstones.map((item) => [item.id, item]))
  for (const id of removedIds) {
    const existing = tombstoneMap.get(id)
    if (!existing || existing.deletedAt < now) tombstoneMap.set(id, { id, deletedAt: now })
  }

  return {
    ideas: nextIdeas,
    tombstones: [...tombstoneMap.values()],
    removedIds
  }
}

/** True when every idea is a known demo seed (by id or exact demo text). */
export function isDemoOnlyIdeaSet(ideas: Idea[]): boolean {
  if (ideas.length === 0) return false
  return ideas.every((idea) => isDemoSeedId(idea.id) || isDemoSeedText(idea.text))
}
