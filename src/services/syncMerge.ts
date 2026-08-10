import type { Idea, IdeaTombstone } from '@/types/idea'

export interface SyncState {
  ideas: Idea[]
  tombstones: IdeaTombstone[]
}

function newestById<T extends { id: string }>(records: T[], timestamp: (record: T) => number): Map<string, T> {
  const result = new Map<string, T>()
  records.forEach((record) => {
    const current = result.get(record.id)
    if (!current || timestamp(record) > timestamp(current)) result.set(record.id, record)
  })
  return result
}

export function mergeSyncStates(local: SyncState, remote: SyncState): SyncState {
  const ideas = newestById([...remote.ideas, ...local.ideas], (idea) => idea.updatedAt)
  const tombstones = newestById([...remote.tombstones, ...local.tombstones], (item) => item.deletedAt)
  const ids = new Set([...ideas.keys(), ...tombstones.keys()])
  const mergedIdeas: Idea[] = []
  const mergedTombstones: IdeaTombstone[] = []

  ids.forEach((id) => {
    const idea = ideas.get(id)
    const tombstone = tombstones.get(id)
    if (tombstone && (!idea || tombstone.deletedAt >= idea.updatedAt)) mergedTombstones.push(tombstone)
    else if (idea) mergedIdeas.push(idea)
  })

  mergedIdeas.sort((left, right) => right.createdAt - left.createdAt || left.id.localeCompare(right.id))
  mergedTombstones.sort((left, right) => right.deletedAt - left.deletedAt || left.id.localeCompare(right.id))
  return { ideas: mergedIdeas, tombstones: mergedTombstones }
}
