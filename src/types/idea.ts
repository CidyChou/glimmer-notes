import type { IdeaColorSlot } from '@/theme/themes'

export type PriorityKey = 'inbox' | 'urgent' | 'important' | 'quick'

export type IdeaDropTarget = PriorityKey | 'archive'

export const LEGACY_PROJECT_TAG_ID = 'tag-project'
export const DEFAULT_PROJECT_ID = 'project-default'
export const DEFAULT_PROJECT_COLOR_SLOT: IdeaColorSlot = 1

export interface IdeaProject {
  id: string
  name: string
  colorSlot: IdeaColorSlot
  createdAt: number
  updatedAt: number
  isDefault: boolean
}

export interface IdeaTag {
  id: string
  name: string
  colorSlot: IdeaColorSlot
  createdAt: number
  updatedAt: number
}

export interface Idea {
  id: string
  text: string
  createdAt: number
  updatedAt: number
  colorSlot: IdeaColorSlot
  projectId: string
  tagIds: string[]
  pinned: boolean
  priority: PriorityKey
  archivedAt: number | null
}

export interface IdeaTombstone {
  id: string
  deletedAt: number
}
