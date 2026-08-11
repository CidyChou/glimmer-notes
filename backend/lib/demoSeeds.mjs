/**
 * Keep in sync with src/constants/demoSeeds.ts
 * Demo notes that were historically re-seeded with random IDs and produced cloud duplicates.
 */
export const DEMO_SEED_TEXTS = new Set([
  '做一个打开微信就能立刻记录灵感的工具',
  '游戏升级后直接给颜料，杀敌只是升级手段',
  '首页不要列表，做成会轻微漂浮的 Idea Space',
  '以后可以让 AI 自动把相关碎片连起来',
  '记录动作一定要在 3 秒内完成',
  'Web 端更适合整理，微信端只负责 capture',
  '保存时让文字缩成粒子飞进空间里'
])

function isStableSeedId(id) {
  return typeof id === 'string' && id.startsWith('seed-')
}

/**
 * After id-based merge, collapse multiple copies of the same demo text.
 */
export function collapseDemoSeedDuplicates(ideas, tombstones, now = Date.now()) {
  const groups = new Map()
  for (const idea of ideas) {
    if (!DEMO_SEED_TEXTS.has(idea.text)) continue
    const list = groups.get(idea.text)
    if (list) list.push(idea)
    else groups.set(idea.text, [idea])
  }

  const removedIds = []
  for (const group of groups.values()) {
    if (group.length <= 1) continue
    const ranked = [...group].sort((left, right) => {
      const leftStable = isStableSeedId(left.id) ? 0 : 1
      const rightStable = isStableSeedId(right.id) ? 0 : 1
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
