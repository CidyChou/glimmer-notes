export type PriorityKey = 'inbox' | 'urgent' | 'important' | 'quick'

export interface Idea {
  id: string
  text: string
  createdAt: number
  color: string
  pinned: boolean
  priority: PriorityKey
}
