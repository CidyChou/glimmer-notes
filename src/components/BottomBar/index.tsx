import { Button, Text, View } from '@tarojs/components'
import PriorityTargets from '@/components/PriorityTargets'
import { PRIORITY_ORDER } from '@/constants/priorities'
import type { IdeaDropTarget, PriorityKey } from '@/types/idea'
import './index.css'

const SPACE_TARGETS: PriorityKey[] = PRIORITY_ORDER.filter((priority) => priority !== 'inbox')

interface Props {
  mode: 'space' | 'organize'
  todayCount: number
  inboxCount: number
  dragging: boolean
  hover: IdeaDropTarget | null
  onAdd: () => void
  onModeChange: (mode: 'space' | 'organize') => void
}

export default function BottomBar({ mode, todayCount, inboxCount, dragging, hover, onAdd, onModeChange }: Props) {
  return (
    <View className={`bottom-zone ${dragging ? 'dragging' : ''}`}>
      {mode === 'space' && (
        <View className='bottom-context'>
          <View className='daily-card'>
            <View className='daily-content'>
              <View className='daily-dot' />
              <View>
                <Text className='daily-title'>今天记录了 {todayCount} 个想法</Text>
                <Text className='daily-subline'>{inboxCount ? `还有 ${inboxCount} 个未整理碎片` : '今天的碎片都整理好了'}</Text>
              </View>
            </View>
          </View>

          <View className='priority-dock'>
            <Text className='dock-heading'>拖进收纳圈后松手，圈外保持原位</Text>
            <PriorityTargets
              priorities={SPACE_TARGETS}
              hover={hover === 'archive' ? null : hover}
              targetClassName='dock-action'
            />
          </View>
        </View>
      )}

      <View className='nav-dock'>
        <View className='nav-glass-shape' />

        <Button
          className={`nav-action ${mode === 'space' ? 'active' : ''}`}
          onClick={() => onModeChange('space')}
        >
          <View className='nav-icon space-icon'>
            <View className='space-node node-a' />
            <View className='space-node node-b' />
            <View className='space-node node-c' />
          </View>
          <Text className='nav-label'>空间</Text>
        </Button>

        <View className={`add-well ${dragging ? 'archive-mode' : ''}`}>
          <Button
            className={`add-btn ${dragging ? 'archive-drop-target' : ''} ${hover === 'archive' ? 'archive-hover' : ''}`}
            ariaLabel={dragging ? '拖到这里归档任务' : '添加想法'}
            onClick={() => !dragging && onAdd()}
          >
            {dragging ? (
              <View className='archive-button-content'>
                <View className='archive-glyph' />
                <Text className='archive-label'>归档</Text>
              </View>
            ) : <View className='add-glyph' />}
          </Button>
        </View>

        <Button
          className={`nav-action ${mode === 'organize' ? 'active' : ''}`}
          onClick={() => onModeChange('organize')}
        >
          <View className='nav-icon organize-icon'>
            <View className='organize-line line-a' />
            <View className='organize-line line-b' />
            <View className='organize-line line-c' />
          </View>
          <Text className='nav-label'>整理</Text>
        </Button>
      </View>
    </View>
  )
}
