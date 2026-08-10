import type { PriorityKey } from '@/types/idea'

export interface PriorityMeta {
  name: string
  sub: string
  color: string
  hint: string
}

export const PRIORITY_ORDER: PriorityKey[] = ['inbox', 'urgent', 'important', 'quick']

export const PRIORITY_META: Record<PriorityKey, PriorityMeta> = {
  inbox: {
    name: '碎片池',
    sub: '还没整理',
    color: '#969eae',
    hint: '刚记下来的东西先待在这里'
  },
  urgent: {
    name: '现在做',
    sub: '重要且紧急',
    color: '#ff5b61',
    hint: '需要马上投入注意力'
  },
  important: {
    name: '计划做',
    sub: '重要非紧急',
    color: '#ffab58',
    hint: '值得安排时间持续推进'
  },
  quick: {
    name: '快处理',
    sub: '非重要但紧急',
    color: '#69a8ff',
    hint: '尽快处理，不必投入太多时间'
  }
}

export const IDEA_COLORS = [
  '#9da9ff',
  '#d5ff6d',
  '#7bd9d4',
  '#ffba78',
  '#c8a3ff',
  '#7ec8ff',
  '#ff91ad'
]
