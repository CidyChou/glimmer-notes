import Taro from '@tarojs/taro'
import { ScrollView, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { PRIORITY_META, PRIORITY_ORDER } from '@/constants/priorities'
import PriorityTargets from '@/components/PriorityTargets'
import { formatDay, formatTime } from '@/utils/date'
import { getIdeaTitle, splitIdeaText } from '@/utils/ideaText'
import type { Idea, PriorityKey } from '@/types/idea'
import { useTheme } from '@/theme'
import type { IdeaColorSlot } from '@/theme'
import './index.css'

interface Props {
  ideas: Idea[]
  query: string
  current: number
  onCurrentChange: (index: number) => void
  onOpenIdea: (id: string) => void
  onAssignPriority: (id: string, priority: PriorityKey) => void
}

type GestureSource = 'row' | 'handle'
type SortMode = 'dragging' | 'choosing' | null

interface SortUi {
  active: boolean
  mode: SortMode
  ideaId: string | null
  ideaColorSlot: IdeaColorSlot
  sourcePriority: PriorityKey | null
  x: number
  y: number
  hover: PriorityKey | null
}

interface GestureState {
  idea: Idea
  source: GestureSource
  startX: number
  startY: number
  activated: boolean
  moved: boolean
  timer: ReturnType<typeof setTimeout> | null
}

interface DropRect {
  left: number
  right: number
  top: number
  bottom: number
  priority: PriorityKey
}

const EMPTY_SORT_UI: SortUi = {
  active: false,
  mode: null,
  ideaId: null,
  ideaColorSlot: 0,
  sourcePriority: null,
  x: 0,
  y: 0,
  hover: null
}

function bucketIdeas(ideas: Idea[], query: string, priority: PriorityKey) {
  const keyword = query.trim().toLowerCase()
  return ideas
    .filter((idea) => idea.priority === priority)
    .filter((idea) => !keyword || idea.text.toLowerCase().includes(keyword))
    .sort((a, b) => b.createdAt - a.createdAt)
}

function eventPoint(event: any, changed = false) {
  const touches = changed ? event.changedTouches : event.touches
  const touch = touches?.[0] || event.changedTouches?.[0] || event.touches?.[0]
  if (!touch) return null
  return {
    x: touch.clientX ?? touch.pageX ?? 0,
    y: touch.clientY ?? touch.pageY ?? 0
  }
}

interface TimelineProps {
  ideas: Idea[]
  priority: PriorityKey
  sortUi: SortUi
  onOpenIdea: (id: string) => void
  onGestureStart: (event: any, idea: Idea, source: GestureSource) => void
  onGestureMove: (event: any) => void
  onGestureEnd: (event: any) => void
  onGestureCancel: () => void
  onSuppressClick: (id: string) => boolean
  onHandleClick: (idea: Idea) => void
}

function Timeline({
  ideas,
  priority,
  sortUi,
  onOpenIdea,
  onGestureStart,
  onGestureMove,
  onGestureEnd,
  onGestureCancel,
  onSuppressClick,
  onHandleClick
}: TimelineProps) {
  const { theme } = useTheme()
  if (ideas.length === 0) {
    return (
      <View className='empty-state'>
        <View>
          <View className='empty-orb'>○</View>
          <Text className='empty-title'>{PRIORITY_META[priority].name}里还没有内容</Text>
          <Text className='empty-copy'>{PRIORITY_META[priority].hint}{'\n'}长按其他卡片，拖进这里。</Text>
        </View>
      </View>
    )
  }

  let previousDay = ''
  return (
    <View className='timeline-list'>
      {ideas.map((idea) => {
        const content = splitIdeaText(idea.text)
        const title = getIdeaTitle(idea.text)
        const details = content.details.replace(/\s+/g, ' ')
        const day = formatDay(idea.createdAt)
        const showDay = day !== previousDay
        const isSource = sortUi.ideaId === idea.id
        previousDay = day
        return (
          <View key={idea.id}>
            {showDay && <View className='day-label'>{day}</View>}
            <View
              className={`idea-row ${isSource ? 'sort-source' : ''}`}
              style={{ '--row-color': theme.ideaPalette[idea.colorSlot] } as CSSProperties}
              ariaRole='button'
              ariaLabel={`编辑任务：${title}`}
              onClick={() => {
                if (onSuppressClick(idea.id) || sortUi.active) return
                onOpenIdea(idea.id)
              }}
              onTouchStart={(event) => onGestureStart(event, idea, 'row')}
              onTouchMove={onGestureMove}
              onTouchEnd={onGestureEnd}
              onTouchCancel={onGestureCancel}
            >
              <View className='idea-row-main'>
                <View className='idea-row-copy'>
                  <Text className='idea-row-text'>{title}</Text>
                  {!!details && <Text className='idea-row-details'>{details}</Text>}
                </View>

                <View className='idea-row-meta'>
                  <Text className='idea-row-time'>{formatTime(idea.createdAt)}</Text>
                  <Text className='idea-row-status'>{idea.pinned ? '★ ' : ''}{PRIORITY_META[priority].sub}</Text>
                </View>

                <View
                  className='drag-handle'
                  ariaRole='button'
                  ariaLabel={`移动任务：${title}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onHandleClick(idea)
                  }}
                  onTouchStart={(event) => {
                    event.stopPropagation()
                    onGestureStart(event, idea, 'handle')
                  }}
                  onTouchMove={(event) => {
                    event.stopPropagation()
                    onGestureMove(event)
                  }}
                  onTouchEnd={(event) => {
                    event.stopPropagation()
                    onGestureEnd(event)
                  }}
                  onTouchCancel={(event) => {
                    event.stopPropagation()
                    onGestureCancel()
                  }}
                >
                  <View className='drag-dot-grid'>
                    {Array.from({ length: 6 }).map((_, index) => <View key={index} className='drag-dot' />)}
                  </View>
                </View>
              </View>
            </View>
          </View>
        )
      })}
    </View>
  )
}

export default function OrganizeView({ ideas, query, current, onCurrentChange, onOpenIdea, onAssignPriority }: Props) {
  const { theme } = useTheme()
  const key = PRIORITY_ORDER[current]
  const meta = PRIORITY_META[key]
  const gestureRef = useRef<GestureState | null>(null)
  const targetRectsRef = useRef<DropRect[]>([])
  const suppressClickRef = useRef<string | null>(null)
  const ignoreHandleClickRef = useRef(false)
  const [sortUi, setSortUi] = useState<SortUi>(EMPTY_SORT_UI)

  const counts = useMemo(() => PRIORITY_ORDER.reduce((result, priority) => {
    result[priority] = bucketIdeas(ideas, query, priority).length
    return result
  }, {} as Record<PriorityKey, number>), [ideas, query])

  const availableTargets = useMemo(
    () => PRIORITY_ORDER.filter((priority) => priority !== sortUi.sourcePriority),
    [sortUi.sourcePriority]
  )

  const clearGestureTimer = () => {
    const gesture = gestureRef.current
    if (gesture?.timer) {
      clearTimeout(gesture.timer)
      gesture.timer = null
    }
  }

  const closeSortUi = () => {
    clearGestureTimer()
    gestureRef.current = null
    targetRectsRef.current = []
    setSortUi((state) => ({ ...state, active: false, hover: null }))
  }

  const measureTargets = () => {
    const queryApi = Taro.createSelectorQuery()
    queryApi.selectAll('.organize-drop-target').boundingClientRect()
    queryApi.exec((result) => {
      const rects = (result?.[0] || []) as any[]
      targetRectsRef.current = rects.map((rect, index) => ({
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        priority: availableTargets[index]
      })).filter((rect) => !!rect.priority)
    })
  }

  useEffect(() => {
    if (!sortUi.active) return undefined
    const timer = setTimeout(measureTargets, 32)
    return () => clearTimeout(timer)
    // availableTargets is derived from sourcePriority and stable for a gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortUi.active, sortUi.sourcePriority])

  useEffect(() => () => clearGestureTimer(), [])

  const targetAt = (x: number, y: number) => {
    const target = targetRectsRef.current.find((rect) => (
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    ))
    return target?.priority || null
  }

  const activateDrag = (gesture: GestureState, x: number, y: number) => {
    if (gesture.activated) return
    gesture.activated = true
    suppressClickRef.current = gesture.idea.id
    clearGestureTimer()
    setSortUi({
      active: true,
      mode: 'dragging',
      ideaId: gesture.idea.id,
      ideaColorSlot: gesture.idea.colorSlot,
      sourcePriority: gesture.idea.priority,
      x,
      y,
      hover: null
    })
  }

  const openPicker = (idea: Idea) => {
    setSortUi({
      active: true,
      mode: 'choosing',
      ideaId: idea.id,
      ideaColorSlot: idea.colorSlot,
      sourcePriority: idea.priority,
      x: 0,
      y: 0,
      hover: null
    })
  }

  const beginGesture = (event: any, idea: Idea, source: GestureSource) => {
    if (sortUi.active) return
    const point = eventPoint(event)
    if (!point) return
    clearGestureTimer()
    const gesture: GestureState = {
      idea,
      source,
      startX: point.x,
      startY: point.y,
      activated: false,
      moved: false,
      timer: null
    }
    gestureRef.current = gesture

    if (source === 'row') {
      gesture.timer = setTimeout(() => activateDrag(gesture, point.x, point.y), 340)
    }
  }

  const moveGesture = (event: any) => {
    const gesture = gestureRef.current
    const point = eventPoint(event)
    if (!gesture || !point) return
    const distance = Math.hypot(point.x - gesture.startX, point.y - gesture.startY)

    if (!gesture.activated && gesture.source === 'handle' && distance > 5) {
      gesture.moved = true
      activateDrag(gesture, point.x, point.y)
    } else if (!gesture.activated && gesture.source === 'row' && distance > 9) {
      gesture.moved = true
      clearGestureTimer()
    }

    if (!gesture.activated) return
    gesture.moved = true
    setSortUi((state) => ({
      ...state,
      x: point.x,
      y: point.y,
      hover: targetAt(point.x, point.y)
    }))
  }

  const endGesture = (event: any) => {
    const gesture = gestureRef.current
    if (!gesture) return
    const point = eventPoint(event, true) || { x: gesture.startX, y: gesture.startY }
    clearGestureTimer()

    if (gesture.source === 'handle') {
      ignoreHandleClickRef.current = true
      setTimeout(() => { ignoreHandleClickRef.current = false }, 450)
    }

    if (gesture.activated) {
      const target = targetAt(point.x, point.y)
      if (target) onAssignPriority(gesture.idea.id, target)
      closeSortUi()
      return
    }

    if (gesture.source === 'handle' && !gesture.moved) {
      suppressClickRef.current = gesture.idea.id
      openPicker(gesture.idea)
    }
    gestureRef.current = null
  }

  const cancelGesture = () => {
    clearGestureTimer()
    if (gestureRef.current?.activated) closeSortUi()
    gestureRef.current = null
  }

  const moveFromPicker = (priority: PriorityKey) => {
    if (!sortUi.ideaId) return
    onAssignPriority(sortUi.ideaId, priority)
    closeSortUi()
  }

  const handleHandleClick = (idea: Idea) => {
    if (ignoreHandleClickRef.current) {
      ignoreHandleClickRef.current = false
      return
    }
    if (!sortUi.active) openPicker(idea)
  }

  const suppressRowClick = (id: string) => {
    if (suppressClickRef.current !== id) return false
    suppressClickRef.current = null
    return true
  }

  return (
    <View className={`organize-shell ${sortUi.active ? 'sorting' : ''}`}>
      <View className='organize-head'>
        <Text className='organize-subtitle'>长按卡片或拖动六点标识，快速归类</Text>
        <Text className='organize-total'>{ideas.length}</Text>
      </View>

      <View className='bucket-tabs'>
        {PRIORITY_ORDER.map((priority, index) => (
          <View
            key={priority}
            className={`bucket-tab ${index === current ? 'active' : ''}`}
            style={{ '--bucket-color': theme.priorities[priority] } as CSSProperties}
            ariaRole='button'
            ariaLabel={`${PRIORITY_META[priority].name}，${counts[priority]} 条`}
            onClick={() => onCurrentChange(index)}
          >
            <View className='bucket-tab-dot' />
            <Text>{PRIORITY_META[priority].name}</Text>
            <Text className='bucket-tab-count'>{counts[priority]}</Text>
          </View>
        ))}
      </View>

      <View className='bucket-summary'>
        <View className='bucket-title-line'>
          <View
            className='bucket-dot'
            style={{
              background: theme.priorities[key],
              boxShadow: `0 0 14px ${theme.priorities[key]}55`
            }}
          />
          <Text className='bucket-title'>{meta.hint}</Text>
        </View>
        <Text className='swipe-tip'>左右滑动切换</Text>
      </View>

      <Swiper
        className='organize-swiper'
        current={current}
        duration={260}
        circular={false}
        disableTouch={sortUi.active}
        onChange={(event) => onCurrentChange(event.detail.current)}
      >
        {PRIORITY_ORDER.map((priority) => {
          const list = bucketIdeas(ideas, query, priority)
          return (
            <SwiperItem key={priority} className='bucket-swiper-item'>
              <ScrollView className='bucket-page' scrollY={!sortUi.active} enhanced showScrollbar={false}>
                <Timeline
                  ideas={list}
                  priority={priority}
                  sortUi={sortUi}
                  onOpenIdea={onOpenIdea}
                  onGestureStart={beginGesture}
                  onGestureMove={moveGesture}
                  onGestureEnd={endGesture}
                  onGestureCancel={cancelGesture}
                  onSuppressClick={suppressRowClick}
                  onHandleClick={handleHandleClick}
                />
              </ScrollView>
            </SwiperItem>
          )
        })}
      </Swiper>

      <View className={`sort-overlay ${sortUi.active ? 'show' : ''} ${sortUi.mode || ''}`}>
        <View className='sort-backdrop' onClick={() => sortUi.mode === 'choosing' && closeSortUi()} />
        <View className='sort-targets'>
          <Text className='sort-title'>
            {sortUi.hover
              ? `放入「${PRIORITY_META[sortUi.hover].name}」`
              : sortUi.mode === 'choosing' ? '选择一个收纳圈' : '拖进收纳圈后松手'}
          </Text>
          <PriorityTargets
            priorities={availableTargets}
            hover={sortUi.hover}
            targetClassName='organize-drop-target'
            onSelect={moveFromPicker}
          />
          <Text className='sort-cancel' onClick={closeSortUi}>取消</Text>
        </View>
      </View>

      {sortUi.active && sortUi.mode === 'dragging' && (
        <View
          className='drag-ghost'
          style={{
            '--ghost-color': theme.ideaPalette[sortUi.ideaColorSlot],
            left: `${sortUi.x}px`,
            top: `${sortUi.y}px`
          } as CSSProperties}
        >
          <View className='drag-ghost-core' />
        </View>
      )}
    </View>
  )
}
