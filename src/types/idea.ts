import type { IdeaColorSlot } from '@/theme/themes'

export type PriorityKey = 'inbox' | 'urgent' | 'important' | 'quick'

export interface Idea {
  id: string
  text: string
  createdAt: number
  updatedAt: number
  colorSlot: IdeaColorSlot
  pinned: boolean
  priority: PriorityKey
}

export interface IdeaTombstone {
  id: string
  deletedAt: number
}
