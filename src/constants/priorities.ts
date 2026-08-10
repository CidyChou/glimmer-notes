import type { PriorityKey } from '@/types/idea'

export interface PriorityMeta {
  name: string
  sub: string
  hint: string
}

export const PRIORITY_ORDER: PriorityKey[] = ['inbox', 'urgent', 'important', 'quick']

export const PRIORITY_META: Record<PriorityKey, PriorityMeta> = {
  inbox: {
    name: '碎片池',
    sub: '还没整理',
    hint: '刚记下来的东西先待在这里'
  },
  urgent: {
    name: '现在做',
    sub: '重要且紧急',
    hint: '需要马上投入注意力'
  },
  important: {
    name: '计划做',
    sub: '重要非紧急',
    hint: '值得安排时间持续推进'
  },
  quick: {
    name: '快处理',
    sub: '非重要但紧急',
    hint: '尽快处理，不必投入太多时间'
  }
}
