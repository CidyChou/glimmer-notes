import { ScrollView, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import type { CSSProperties } from 'react'
import { PRIORITY_META, PRIORITY_ORDER } from '@/constants/priorities'
import { formatDay, formatTime } from '@/utils/date'
import type { Idea } from '@/types/idea'
import './index.css'

interface Props {
  ideas: Idea[]
  query: string
  current: number
  onCurrentChange: (index: number) => void
  onOpenIdea: (id: string) => void
}

function bucketIdeas(ideas: Idea[], query: string, priority: string) {
  const keyword = query.trim().toLowerCase()
  return ideas
    .filter((idea) => idea.priority === priority)
    .filter((idea) => !keyword || idea.text.toLowerCase().includes(keyword))
    .sort((a, b) => b.createdAt - a.createdAt)
}

function Timeline({ ideas, priority, onOpenIdea }: { ideas: Idea[]; priority: typeof PRIORITY_ORDER[number]; onOpenIdea: (id: string) => void }) {
  if (ideas.length === 0) {
    return (
      <View className='empty-state'>
        <View>
          <View className='empty-orb'>○</View>
          <Text className='empty-title'>{PRIORITY_META[priority].name}里还没有内容</Text>
          <Text className='empty-copy'>{PRIORITY_META[priority].hint}{'\n'}从「空间」拖一个想法过来。</Text>
        </View>
      </View>
    )
  }

  let previousDay = ''
  return (
    <View className='timeline-list'>
      {ideas.map((idea) => {
        const day = formatDay(idea.createdAt)
        const showDay = day !== previousDay
        previousDay = day
        return (
          <View key={idea.id}>
            {showDay && <View className='day-label'>{day}</View>}
            <View
              className='idea-row'
              style={{ '--row-color': idea.color } as CSSProperties}
              onClick={() => onOpenIdea(idea.id)}
            >
              <Text className='idea-row-text'>{idea.text}</Text>
              <View className='idea-row-footer'>
                <Text>{formatTime(idea.createdAt)}</Text>
                <Text>{idea.pinned ? '★ 收藏 · ' : ''}{PRIORITY_META[priority].sub}</Text>
              </View>
            </View>
          </View>
        )
      })}
    </View>
  )
}

export default function OrganizeView({ ideas, query, current, onCurrentChange, onOpenIdea }: Props) {
  const key = PRIORITY_ORDER[current]
  const meta = PRIORITY_META[key]
  const currentCount = bucketIdeas(ideas, query, key).length

  return (
    <View className='organize-shell'>
      <View className='organize-head'>
        <View className='bucket-copy'>
          <Text className='bucket-kicker'>按时间排列</Text>
          <View className='bucket-title-line'>
            <View className='bucket-dot' style={{ background: meta.color, boxShadow: `0 0 15px ${meta.color}66` }} />
            <Text className='bucket-title'>{meta.name}</Text>
            <Text className='bucket-count'>{currentCount} 条</Text>
          </View>
        </View>
        <View className='swipe-tip'><Text>‹</Text><Text>左右滑动</Text><Text>›</Text></View>
      </View>

      <View className='bucket-progress'>
        {PRIORITY_ORDER.map((priority, index) => (
          <View
            key={priority}
            className={`progress-item ${index === current ? 'active' : ''}`}
            onClick={() => onCurrentChange(index)}
          >
            <View className='progress-fill' style={{ background: index === current ? PRIORITY_META[priority].color : 'transparent' }} />
          </View>
        ))}
      </View>

      <Swiper
        className='organize-swiper'
        current={current}
        duration={260}
        circular={false}
        onChange={(event) => onCurrentChange(event.detail.current)}
      >
        {PRIORITY_ORDER.map((priority) => {
          const list = bucketIdeas(ideas, query, priority)
          return (
            <SwiperItem key={priority} className='bucket-swiper-item'>
              <ScrollView className='bucket-page' scrollY enhanced showScrollbar={false}>
                <Timeline ideas={list} priority={priority} onOpenIdea={onOpenIdea} />
              </ScrollView>
            </SwiperItem>
          )
        })}
      </Swiper>
    </View>
  )
}
