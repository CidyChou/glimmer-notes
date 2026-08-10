import Taro from '@tarojs/taro'
import { Button, Text, View } from '@tarojs/components'
import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { loadIdeaState, saveIdeas } from '@/services/ideaStorage'
import { scheduleSync } from '@/services/sync'
import { copyText } from '@/utils/clipboard'
import { formatDay, formatTime } from '@/utils/date'
import { getIdeaTitle, splitIdeaText } from '@/utils/ideaText'
import { findIdeaProject, findIdeaTags } from '@/utils/tags'
import type { Idea } from '@/types/idea'
import { useTheme } from '@/theme'
import './index.css'

export default function ArchivePage() {
  const { theme, themeStyle } = useTheme()
  const [initialState] = useState(loadIdeaState)
  const [ideas, setIdeas] = useState(initialState.ideas)
  const [notice, setNotice] = useState('')
  const archived = useMemo(
    () => ideas.filter((idea) => idea.archivedAt !== null).sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0)),
    [ideas]
  )

  const flash = (message: string) => {
    setNotice(message)
    setTimeout(() => setNotice(''), 1400)
  }

  const goBack = () => {
    Taro.navigateBack({ delta: 1, fail: () => Taro.reLaunch({ url: '/pages/settings/index' }) })
  }

  const restore = (id: string) => {
    const updatedAt = Date.now()
    const next = ideas.map((idea) => idea.id === id ? { ...idea, archivedAt: null, updatedAt } : idea)
    setIdeas(next)
    saveIdeas(next)
    scheduleSync()
    flash('任务已恢复')
  }

  const copyIdea = async (idea: Idea) => {
    try {
      await copyText(idea.text)
      flash('已复制到剪贴板')
    } catch {
      flash('复制失败，请重试')
    }
  }

  return (
    <View className='archive-stage theme-root' style={themeStyle}>
      <View className='archive-shell'>
        <View className='archive-ambient archive-ambient-a' />
        <View className='archive-ambient archive-ambient-b' />

        <View className='archive-topbar'>
          <View className='archive-back' ariaRole='button' ariaLabel='返回设置' onClick={goBack}>
            <View className='archive-back-glyph' />
          </View>
          <View className='archive-heading'>
            <Text className='archive-title'>已归档任务</Text>
            <Text className='archive-subtitle'>{archived.length} 条已收纳</Text>
          </View>
          <View className='archive-topbar-spacer' />
        </View>

        <View className='archive-scroll'>
          {archived.length === 0 ? (
            <View className='archive-empty'>
              <View className='archive-empty-icon'><View className='archive-empty-box' /></View>
              <Text className='archive-empty-title'>还没有归档任务</Text>
              <Text className='archive-empty-copy'>拖动任务到中间的归档按钮后，会出现在这里。</Text>
            </View>
          ) : (
            <View className='archive-list'>
              {archived.map((idea) => {
                const content = splitIdeaText(idea.text)
                const project = findIdeaProject(idea, initialState.projects)
                const ideaTags = findIdeaTags(idea, initialState.tags)
                return (
                  <View
                    key={idea.id}
                    className='archive-card'
                    style={{ '--tag-color': theme.ideaPalette[project.colorSlot] } as CSSProperties}
                  >
                    <View className='archive-card-color' />
                    <View className='archive-card-content'>
                      <View className='archive-card-main'>
                        <Text className='archive-card-title'>{getIdeaTitle(idea.text)}</Text>
                        {!!content.details && <Text className='archive-card-details'>{content.details.replace(/\s+/g, ' ')}</Text>}
                        <View className='archive-card-meta'>
                          <View className='archive-card-taxonomy'>
                            <View className='archive-card-tag'><View className='archive-card-tag-dot' /><Text>{project.name}</Text></View>
                            {ideaTags.slice(0, 1).map((tag) => <Text key={tag.id} className='archive-card-label'>#{tag.name}</Text>)}
                            {ideaTags.length > 1 && <Text className='archive-card-label'>+{ideaTags.length - 1}</Text>}
                          </View>
                          <Text>{formatDay(idea.archivedAt || idea.updatedAt)} {formatTime(idea.archivedAt || idea.updatedAt)}</Text>
                        </View>
                      </View>
                      <View className='archive-card-actions'>
                        <Button className='archive-copy-btn' onClick={() => void copyIdea(idea)}>
                          <View className='archive-copy-glyph' />
                          <Text>复制</Text>
                        </Button>
                        <Button className='archive-restore-btn' onClick={() => restore(idea.id)}>恢复</Button>
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          )}
        </View>

        <View className={`archive-toast ${notice ? 'show' : ''}`}>{notice}</View>
      </View>
    </View>
  )
}
