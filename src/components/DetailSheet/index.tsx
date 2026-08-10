import { Button, Input, Text, Textarea, View } from '@tarojs/components'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { PRIORITY_META, PRIORITY_ORDER } from '@/constants/priorities'
import { formatDetailTime } from '@/utils/date'
import { composeIdeaText, splitIdeaText } from '@/utils/ideaText'
import type { Idea, PriorityKey } from '@/types/idea'
import { useTheme } from '@/theme'
import './index.css'

interface Props {
  idea: Idea
  open: boolean
  onClose: () => void
  onPriorityChange: (priority: PriorityKey) => void
  onSave: (title: string, details: string) => void
  onTogglePin: () => void
  onDelete: () => void
}

export default function DetailSheet({ idea, open, onClose, onPriorityChange, onSave, onTogglePin, onDelete }: Props) {
  const { theme } = useTheme()
  const originalContent = splitIdeaText(idea.text)
  const [title, setTitle] = useState(originalContent.title)
  const [details, setDetails] = useState(originalContent.details)
  const hasTitle = !!title.trim()
  const hasChanges = composeIdeaText(title, details) !== composeIdeaText(
    originalContent.title,
    originalContent.details
  )

  return (
    <View className={`detail-sheet ${open ? 'show' : ''}`}>
      <View className='detail-grabber' />
      <View className='detail-top'>
        <View>
          <Text className='detail-kicker'>编辑任务</Text>
          <Text className='detail-time'>{formatDetailTime(idea.createdAt)}</Text>
        </View>
        <Button className='close-btn' ariaLabel='关闭编辑面板' onClick={onClose}>×</Button>
      </View>

      <View className='detail-editor'>
        <Text className='detail-field-label'>标题</Text>
        <Input
          className='detail-title-input'
          value={title}
          maxlength={80}
          ariaLabel='任务标题'
          placeholder='输入任务标题'
          onInput={(event) => setTitle(event.detail.value)}
        />
        <View className='detail-field-divider' />
        <View className='detail-label-row'>
          <Text className='detail-field-label'>详情</Text>
          <Text className='detail-optional'>选填</Text>
        </View>
        <Textarea
          className='detail-body-input'
          value={details}
          maxlength={-1}
          ariaLabel='任务详情'
          placeholder='补充步骤、背景或任何小细节...'
          onInput={(event) => setDetails(event.detail.value)}
        />
      </View>

      <View className='detail-save-row'>
        <Text className={hasChanges ? 'unsaved' : ''}>{hasChanges ? '有未保存的修改' : '内容已同步'}</Text>
        <Button
          className='detail-save-btn'
          disabled={!hasTitle || !hasChanges ? true : undefined}
          onClick={() => onSave(title, details)}
        >
          保存修改
        </Button>
      </View>

      <Text className='priority-picker-title'>任务分组</Text>
      <View className='priority-picker'>
        {PRIORITY_ORDER.map((priority) => (
          <View
            key={priority}
            className={`priority-pill ${idea.priority === priority ? 'active' : ''}`}
            ariaRole='button'
            ariaLabel={`放入${PRIORITY_META[priority].name}`}
            style={{ '--priority-color': theme.priorities[priority] } as CSSProperties}
            onClick={() => onPriorityChange(priority)}
          >
            <View className='priority-pill-dot' />
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
