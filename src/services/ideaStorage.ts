import Taro from '@tarojs/taro'
import { createId } from '@/utils/id'
import type { Idea } from '@/types/idea'

const STORAGE_KEY = 'idea-space-v3-data'

function seedIdeas(): Idea[] {
  const now = Date.now()
  return [
    { id: createId(), text: '做一个打开微信就能立刻记录灵感的工具', createdAt: now - 22 * 60_000, color: '#9da9ff', pinned: false, priority: 'inbox' },
    { id: createId(), text: '游戏升级后直接给颜料，杀敌只是升级手段', createdAt: now - 57 * 60_000, color: '#d5ff6d', pinned: false, priority: 'urgent' },
    { id: createId(), text: '首页不要列表，做成会轻微漂浮的 Idea Space', createdAt: now - 91 * 60_000, color: '#7bd9d4', pinned: true, priority: 'important' },
    { id: createId(), text: '以后可以让 AI 自动把相关碎片连起来', createdAt: now - 125 * 60_000, color: '#ffba78', pinned: false, priority: 'important' },
    { id: createId(), text: '记录动作一定要在 3 秒内完成', createdAt: now - 162 * 60_000, color: '#c8a3ff', pinned: false, priority: 'quick' },
    { id: createId(), text: 'Web 端更适合整理，微信端只负责 capture', createdAt: now - 196 * 60_000, color: '#7ec8ff', pinned: false, priority: 'inbox' },
    { id: createId(), text: '保存时让文字缩成粒子飞进空间里', createdAt: now - 230 * 60_000, color: '#ff91ad', pinned: false, priority: 'inbox' }
  ]
}

export function loadIdeas(): Idea[] {
  try {
    const stored = Taro.getStorageSync(STORAGE_KEY) as Idea[] | undefined
    if (Array.isArray(stored) && stored.length > 0) {
      return stored.map((idea) => ({ ...idea, priority: idea.priority || 'inbox' }))
    }
  } catch (error) {
    console.warn('[IdeaSpace] load storage failed', error)
  }
  return seedIdeas()
}

export function saveIdeas(ideas: Idea[]): void {
  try {
    Taro.setStorageSync(STORAGE_KEY, ideas)
  } catch (error) {
    console.warn('[IdeaSpace] save storage failed', error)
  }
}
