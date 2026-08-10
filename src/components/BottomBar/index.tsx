import { Button, Text, View } from '@tarojs/components'
import type { PriorityKey } from '@/types/idea'
import './index.css'

interface Props {
  todayCount: number
  inboxCount: number
  dragging: boolean
  hover: PriorityKey | null
  onAdd: () => void
}

export default function BottomBar({ todayCount, inboxCount, dragging, hover, onAdd }: Props) {
  return (
    <>
      <View className={`bottom-bar ${dragging ? 'dragging' : ''}`}>
        <View className='daily-card'>
          <View className='daily-content'>
            <View className='daily-dot' />
            <View>
              <Text className='daily-title'>今天记录了 {todayCount} 个想法</Text>
              <Text className='daily-subline'>{inboxCount ? `还有 ${inboxCount} 个未整理碎片` : '今天的碎片都整理好了'}</Text>
            </View>
          </View>

          <View className='priority-dock'>
            <View className={`dock-action red ${hover === 'urgent' ? 'hover' : ''}`} data-priority='urgent'>
              <Text className='dock-title'>现在做</Text><Text className='dock-sub'>重要且紧急</Text>
            </View>
            <View className={`dock-action orange ${hover === 'important' ? 'hover' : ''}`} data-priority='important'>
              <Text className='dock-title'>计划做</Text><Text className='dock-sub'>重要非紧急</Text>
            </View>
            <View className={`dock-action blue ${hover === 'quick' ? 'hover' : ''}`} data-priority='quick'>
              <Text className='dock-title'>快处理</Text><Text className='dock-sub'>非重要但紧急</Text>
            </View>
          </View>
        </View>
        <Button className='add-btn' onClick={onAdd}>＋</Button>
      </View>
      <View className={`drag-caption ${dragging ? 'show' : ''}`}>拖到一个颜色上松手 · 不放则继续留在碎片池</View>
    </>
  )
}
