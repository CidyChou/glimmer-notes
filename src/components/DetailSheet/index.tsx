import { Button, Text, View } from '@tarojs/components'
import { PRIORITY_META, PRIORITY_ORDER } from '@/constants/priorities'
import { formatDetailTime } from '@/utils/date'
import type { Idea, PriorityKey } from '@/types/idea'
import './index.css'

interface Props {
  idea: Idea | null
  open: boolean
  onClose: () => void
  onPriorityChange: (priority: PriorityKey) => void
  onTogglePin: () => void
  onDelete: () => void
}

export default function DetailSheet({ idea, open, onClose, onPriorityChange, onTogglePin, onDelete }: Props) {
  if (!idea) return null

  return (
    <View className={`detail-sheet ${open ? 'show' : ''}`}>
      <View className='detail-grabber' />
      <View className='detail-top'>
        <Text className='detail-time'>{formatDetailTime(idea.createdAt)}</Text>
        <Button className='close-btn' onClick={onClose}>×</Button>
      </View>
      <Text className='detail-text'>{idea.text}</Text>
      <Text className='priority-picker-title'>放到哪里</Text>
      <View className='priority-picker'>
        {PRIORITY_ORDER.map((priority) => (
          <View
            key={priority}
            className={`priority-pill ${idea.priority === priority ? 'active' : ''}`}
            style={{ borderColor: idea.priority === priority ? PRIORITY_META[priority].color : 'rgba(255,255,255,.07)' }}
            onClick={() => onPriorityChange(priority)}
          >
            <View className='priority-pill-dot' style={{ background: PRIORITY_META[priority].color }} />
            <Text>{PRIORITY_META[priority].name}</Text>
          </View>
        ))}
      </View>
      <View className='detail-actions'>
        <Button onClick={onTogglePin}>{idea.pinned ? '★ 取消收藏' : '☆ 收藏'}</Button>
        <Button className='danger' onClick={onDelete}>删除</Button>
      </View>
    </View>
  )
}
