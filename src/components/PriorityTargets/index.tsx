import { Text, View } from '@tarojs/components'
import type { CSSProperties } from 'react'
import { PRIORITY_META } from '@/constants/priorities'
import type { PriorityKey } from '@/types/idea'
import { useTheme } from '@/theme'
import './index.css'

interface Props {
  priorities: PriorityKey[]
  hover: PriorityKey | null
  className?: string
  targetClassName?: string
  onSelect?: (priority: PriorityKey) => void
}

export default function PriorityTargets({ priorities, hover, className = '', targetClassName = '', onSelect }: Props) {
  const { theme } = useTheme()
  return (
    <View className={`priority-target-row ${className}`}>
      {priorities.map((priority) => {
        const meta = PRIORITY_META[priority]
        return (
          <View
            key={priority}
            className={`priority-target ${targetClassName} ${hover === priority ? 'hover' : ''}`}
            style={{ '--target-color': theme.priorities[priority] } as CSSProperties}
            data-priority={priority}
            ariaRole={onSelect ? 'button' : undefined}
            ariaLabel={onSelect ? `移到${meta.name}` : undefined}
            onClick={onSelect ? (event) => {
              event.stopPropagation()
              onSelect(priority)
            } : undefined}
          >
            <View className='priority-target-ring'>
              <View className='priority-target-core' />
            </View>
            <Text className='priority-target-name'>{meta.name}</Text>
          </View>
        )
      })}
    </View>
  )
}
