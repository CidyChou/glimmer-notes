import Taro from '@tarojs/taro'
import { ScrollView, Text, View } from '@tarojs/components'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { PRIORITY_META, PRIORITY_ORDER } from '@/constants/priorities'
import PriorityTargets from '@/components/PriorityTargets'
import { formatDay, formatTime } from '@/utils/date'
import { getIdeaTitle, splitIdeaText } from '@/utils/ideaText'
import type { Idea, IdeaDropTarget, IdeaProject, IdeaTag, PriorityKey } from '@/types/idea'
import { findIdeaProject, findIdeaTags } from '@/utils/tags'
import { stripMarkdown } from '@/utils/markdown'
import { useTheme } from '@/theme'
import type { IdeaColorSlot } from '@/theme'
import './index.css'

interface Props {
  ideas: Idea[]
  projects: IdeaProject[]
  tags: IdeaTag[]
  current: number
  onCurrentChange: (index: number) => void
  onOpenIdea: (id: string) => void
  onAssignPriority: (id: string, priority: PriorityKey) => void
  onArchiveIdea: (id: string) => void
  onCopyIdea: (idea: Idea) => void
  onDragUiChange: (active: boolean, hover: IdeaDropTarget | null) => void
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
  hover: IdeaDropTarget | null
  phase: 'idle' | 'lifting' | 'flying'
}

interface GestureState {
  idea: Idea
  source: GestureSource
  input: 'touch' | 'mouse'
  startX: number
  startY: number
  activated: boolean
  moved: boolean
  latestX: number
  latestY: number
  aborted: boolean
}

interface DropRect {
  left: number
  right: number
  top: number
  bottom: number
  target: IdeaDropTarget
}

const EMPTY_SORT_UI: SortUi = {
  active: false,
  mode: null,
  ideaId: null,
  ideaColorSlot: 0,
  sourcePriority: null,
  x: 0,
  y: 0,
  hover: null,
  phase: 'idle'
}

/** Movement needed before drag starts — tiny so it feels instant, big enough to ignore jitter. */
const ACTIVATE_DISTANCE = 5
/** On row body, prefer horizontal intent so vertical list scroll still works. */
const ROW_SCROLL_RATIO = 1.35
/** Lift the light-dot above the fingertip so the finger doesn't cover it. Hit-testing still uses the raw touch point. */
const GHOST_Y_OFFSET = 40

function bucketIdeas(ideas: Idea[], priority: PriorityKey) {
  return ideas
    .filter((idea) => idea.priority === priority)
    .sort((a, b) => b.createdAt - a.createdAt)
}

function eventPoint(event: any, changed = false) {
  const nativeEvent = event?.nativeEvent || event
  const directX = nativeEvent?.clientX ?? nativeEvent?.pageX
  const directY = nativeEvent?.clientY ?? nativeEvent?.pageY
  if (typeof directX === 'number' && typeof directY === 'number') {
    return { x: directX, y: directY }
  }
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
  projects: IdeaProject[]
  tags: IdeaTag[]
  priority: PriorityKey
  sortUi: SortUi
  onOpenIdea: (id: string) => void
  onGestureStart: (event: any, idea: Idea, source: GestureSource) => void
  onGestureMove: (event: any) => void
  onGestureEnd: (event: any) => void
  onGestureCancel: () => void
  onSuppressClick: (id: string) => boolean
  onHandleClick: (idea: Idea) => void
  onCopyIdea: (idea: Idea) => void
}

function Timeline({
  ideas,
  projects,
  tags,
  priority,
  sortUi,
  onOpenIdea,
  onGestureStart,
  onGestureMove,
  onGestureEnd,
  onGestureCancel,
  onSuppressClick,
  onHandleClick,
  onCopyIdea
}: TimelineProps) {
  const { theme } = useTheme()
  if (ideas.length === 0) {
    return (
      <View className='empty-state'>
        <View>
          <View className='empty-orb'>○</View>
          <Text className='empty-title'>{PRIORITY_META[priority].name}里还没有内容</Text>
          <Text className='empty-copy'>{PRIORITY_META[priority].hint}{'\n'}拖动其他卡片，放进这里。</Text>
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
        const details = stripMarkdown(content.details)
        const day = formatDay(idea.createdAt)
        const showDay = day !== previousDay
        const isSource = sortUi.ideaId === idea.id
        const project = findIdeaProject(idea, projects)
        const ideaTags = findIdeaTags(idea, tags)
        previousDay = day
        return (
          <View key={idea.id}>
            {showDay && <View className='day-label'>{day}</View>}
            <View
              className={`idea-row ${isSource ? 'sort-source' : ''} ${isSource && sortUi.phase === 'flying' ? 'sort-source-flying' : ''}`}
              id={`organize-row-${idea.id}`}
              style={{ '--row-color': theme.ideaPalette[project.colorSlot] } as CSSProperties}
              ariaRole='button'
              ariaLabel={`编辑任务：${title}`}
              onClick={() => {
                if (onSuppressClick(idea.id) || sortUi.active) return
                onOpenIdea(idea.id)
              }}
              onTouchStart={(event) => {
                event.stopPropagation()
                onGestureStart(event, idea, 'row')
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
              <View className='idea-row-main'>
                <View className='idea-row-copy'>
                  <Text className='idea-row-text'>{title}</Text>
                  {!!details && <Text className='idea-row-details'>{details}</Text>}
                  <View className='idea-row-taxonomy'>
                    <View className='idea-row-project' style={{ '--tag-color': theme.ideaPalette[project.colorSlot] } as CSSProperties}>
                      <View className='idea-row-project-dot' />
                      <Text>{project.name}</Text>
                    </View>
                    {ideaTags.slice(0, 2).map((tag) => (
                      <View key={tag.id} className='idea-row-tag' style={{ '--tag-color': theme.ideaPalette[tag.colorSlot] } as CSSProperties}>
                        <Text>#{tag.name}</Text>
                      </View>
                    ))}
                    {ideaTags.length > 2 && <Text className='idea-row-tag-more'>+{ideaTags.length - 2}</Text>}
                  </View>
                </View>

                <View className='idea-row-meta'>
                  <Text className='idea-row-time'>{formatTime(idea.createdAt)}</Text>
                  <Text className='idea-row-status'>{idea.pinned ? '★ ' : ''}{PRIORITY_META[priority].sub}</Text>
                </View>

                <View
                  className='copy-row-btn'
                  ariaRole='button'
                  ariaLabel={`复制任务：${title}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onCopyIdea(idea)
                  }}
                >
                  <View className='copy-glyph' />
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

export default function OrganizeView({ ideas, projects, tags, current, onCurrentChange, onOpenIdea, onAssignPriority, onArchiveIdea, onCopyIdea, onDragUiChange }: Props) {
  const { theme } = useTheme()
  const key = PRIORITY_ORDER[current]
  const gestureRef = useRef<GestureState | null>(null)
  const targetRectsRef = useRef<DropRect[]>([])
  const suppressClickRef = useRef<string | null>(null)
  const ignoreHandleClickRef = useRef(false)
  const ideasRef = useRef(ideas)
  const ghostRef = useRef<any>(null)
  const lastHoverRef = useRef<IdeaDropTarget | null>(null)
  const rafRef = useRef<number | null>(null)
  const pendingPointRef = useRef<{ x: number; y: number } | null>(null)
  const mouseHandlersRef = useRef<{
    start: (event: any, idea: Idea, source: GestureSource) => void
    move: (event: any) => void
    end: (event: any) => void
    cancel: () => void
  } | null>(null)
  const [sortUi, setSortUi] = useState<SortUi>(EMPTY_SORT_UI)
  ideasRef.current = ideas

  const counts = useMemo(() => PRIORITY_ORDER.reduce((result, priority) => {
    result[priority] = bucketIdeas(ideas, priority).length
    return result
  }, {} as Record<PriorityKey, number>), [ideas])

  const availableTargets = useMemo(
    () => PRIORITY_ORDER.filter((priority) => priority !== sortUi.sourcePriority),
    [sortUi.sourcePriority]
  )

  const list = useMemo(() => bucketIdeas(ideas, key), [ideas, key])

  const resolveGhostEl = (): HTMLElement | null => {
    const node = ghostRef.current
    if (!node) return null
    if (typeof (node as HTMLElement).style !== 'undefined') return node as HTMLElement
    const nested = (node as { $el?: HTMLElement }).$el
    return nested && typeof nested.style !== 'undefined' ? nested : null
  }

  const applyGhostPosition = (x: number, y: number) => {
    // Direct DOM write keeps the light-dot buttery on H5; React state still owns hover/phase.
    const el = resolveGhostEl()
    if (!el) return false
    el.style.left = `${x}px`
    el.style.top = `${y - GHOST_Y_OFFSET}px`
    return true
  }

  const flushGhostFrame = () => {
    rafRef.current = null
    const point = pendingPointRef.current
    if (!point) return
    pendingPointRef.current = null
    const hover = targetAt(point.x, point.y)
    const hoverChanged = hover !== lastHoverRef.current
    lastHoverRef.current = hover
    const wroteDom = applyGhostPosition(point.x, point.y)

    if (hoverChanged) {
      setSortUi((state) => ({ ...state, x: point.x, y: point.y, hover }))
      onDragUiChange(true, hover)
      return
    }

    // Skip React re-render when H5 DOM already tracks the finger.
    if (!wroteDom) {
      setSortUi((state) => (
        state.x === point.x && state.y === point.y
          ? state
          : { ...state, x: point.x, y: point.y }
      ))
    }
  }

  const scheduleGhostMove = (x: number, y: number) => {
    pendingPointRef.current = { x, y }
    if (rafRef.current != null) return
    if (typeof requestAnimationFrame === 'function') {
      rafRef.current = requestAnimationFrame(flushGhostFrame)
    } else {
      flushGhostFrame()
    }
  }

  const closeSortUi = () => {
    if (rafRef.current != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    pendingPointRef.current = null
    lastHoverRef.current = null
    gestureRef.current = null
    targetRectsRef.current = []
    onDragUiChange(false, null)
    setSortUi((state) => ({ ...state, active: false, hover: null, phase: 'idle' }))
  }

  const measureTargets = () => {
    const queryApi = Taro.createSelectorQuery()
    queryApi.selectAll('.organize-drop-target').boundingClientRect()
    queryApi.select('.archive-drop-target').boundingClientRect()
    queryApi.exec((result) => {
      const rects = (result?.[0] || []) as any[]
      targetRectsRef.current = rects.map((rect, index) => ({
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        target: availableTargets[index]
      })).filter((rect) => !!rect.target)
      const archiveRect = result?.[1] as any
      if (archiveRect) targetRectsRef.current.push({
        left: archiveRect.left,
        right: archiveRect.right,
        top: archiveRect.top,
        bottom: archiveRect.bottom,
        target: 'archive'
      })
    })
  }

  useEffect(() => {
    if (!sortUi.active) return undefined
    const fastTimer = setTimeout(measureTargets, 24)
    const settledTimer = setTimeout(measureTargets, 180)
    return () => {
      clearTimeout(fastTimer)
      clearTimeout(settledTimer)
    }
    // availableTargets is derived from sourcePriority and stable for a gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortUi.active, sortUi.sourcePriority])

  useEffect(() => () => {
    if (rafRef.current != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const targetAt = (x: number, y: number) => {
    const target = targetRectsRef.current.find((rect) => (
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    ))
    return target?.target || null
  }

  const activateDrag = (gesture: GestureState, x: number, y: number) => {
    if (gesture.activated || gesture.aborted) return
    gesture.activated = true
    suppressClickRef.current = gesture.idea.id
    lastHoverRef.current = null
    setSortUi({
      active: true,
      mode: 'dragging',
      ideaId: gesture.idea.id,
      ideaColorSlot: gesture.idea.colorSlot,
      sourcePriority: gesture.idea.priority,
      x,
      y,
      hover: null,
      phase: 'lifting'
    })
    onDragUiChange(true, null)
    // Tiny lift → flying light-dot so the shrink feels snappy, not delayed.
    setTimeout(() => {
      setSortUi((state) => (
        state.active && state.mode === 'dragging' && state.phase === 'lifting'
          ? { ...state, phase: 'flying' }
          : state
      ))
    }, 70)
    if (process.env.TARO_ENV !== 'h5') void Taro.vibrateShort({ type: 'light' }).catch(() => undefined)
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
      hover: null,
      phase: 'idle'
    })
  }

  const beginGesture = (event: any, idea: Idea, source: GestureSource) => {
    if (sortUi.active) return
    const point = eventPoint(event)
    if (!point) return
    const input = (event?.type === 'mousedown' || event?.nativeEvent?.type === 'mousedown') ? 'mouse' : 'touch'
    gestureRef.current = {
      idea,
      source,
      input,
      startX: point.x,
      startY: point.y,
      activated: false,
      moved: false,
      latestX: point.x,
      latestY: point.y,
      aborted: false
    }
  }

  const moveGesture = (event: any) => {
    const gesture = gestureRef.current
    const point = eventPoint(event)
    if (!gesture || !point || gesture.aborted) return
    gesture.latestX = point.x
    gesture.latestY = point.y
    const dx = point.x - gesture.startX
    const dy = point.y - gesture.startY
    const distance = Math.hypot(dx, dy)

    if (!gesture.activated) {
      if (distance < ACTIVATE_DISTANCE) return

      // Touch on row body: vertical-dominant move = list scroll, release the gesture.
      // Mouse can drag any direction; scroll isn't a concern.
      if (
        gesture.source === 'row'
        && gesture.input === 'touch'
        && Math.abs(dy) > Math.abs(dx) * ROW_SCROLL_RATIO
      ) {
        gesture.aborted = true
        gestureRef.current = null
        return
      }

      gesture.moved = true
      if (event?.preventDefault) event.preventDefault()
      activateDrag(gesture, point.x, point.y)
      return
    }

    gesture.moved = true
    if (event?.preventDefault) event.preventDefault()
    scheduleGhostMove(point.x, point.y)
  }

  const endGesture = (event: any) => {
    const gesture = gestureRef.current
    if (!gesture) return
    const point = eventPoint(event, true) || { x: gesture.latestX, y: gesture.latestY }

    if (gesture.source === 'handle') {
      ignoreHandleClickRef.current = true
      setTimeout(() => { ignoreHandleClickRef.current = false }, 450)
    }

    if (gesture.activated) {
      // Flush any pending rAF so drop uses the latest finger position.
      if (rafRef.current != null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      const finalPoint = pendingPointRef.current || point
      pendingPointRef.current = null
      const target = targetAt(finalPoint.x, finalPoint.y)
      if (target === 'archive') onArchiveIdea(gesture.idea.id)
      else if (target) onAssignPriority(gesture.idea.id, target)
      closeSortUi()
      return
    }

    if (gesture.source === 'handle' && !gesture.moved && !gesture.aborted) {
      suppressClickRef.current = gesture.idea.id
      openPicker(gesture.idea)
    }
    gestureRef.current = null
  }

  const cancelGesture = () => {
    if (gestureRef.current?.activated) closeSortUi()
    else gestureRef.current = null
  }

  mouseHandlersRef.current = {
    start: beginGesture,
    move: moveGesture,
    end: endGesture,
    cancel: cancelGesture
  }

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleMouseMove = (event: MouseEvent) => {
      if (gestureRef.current?.input !== 'mouse') return
      event.preventDefault()
      mouseHandlersRef.current?.move(event)
    }
    const handleMouseUp = (event: MouseEvent) => {
      if (gestureRef.current?.input !== 'mouse') return
      mouseHandlersRef.current?.end(event)
    }
    const handleWindowBlur = () => {
      if (gestureRef.current?.input !== 'mouse') return
      mouseHandlersRef.current?.cancel()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('.copy-row-btn')) return

      const row = target.closest<HTMLElement>('.idea-row')
      if (!row || !row.closest('.organize-shell')) return
      const prefix = 'organize-row-'
      const ideaId = row.id.startsWith(prefix) ? row.id.slice(prefix.length) : ''
      const idea = ideasRef.current.find((item) => item.id === ideaId)
      if (!idea) return

      event.preventDefault()
      event.stopPropagation()
      mouseHandlersRef.current?.start(event, idea, target.closest('.drag-handle') ? 'handle' : 'row')
    }

    document.addEventListener('mousedown', handleDocumentMouseDown, true)
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown, true)
  }, [])

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
        <Text className='organize-subtitle'>拖动卡片即可归类 · 点右侧六点可快速选择</Text>
        <Text className='organize-total'>{ideas.length}</Text>
      </View>

      <ScrollView className='bucket-page' scrollY={!sortUi.active} enhanced showScrollbar={false}>
        <Timeline
          ideas={list}
          projects={projects}
          tags={tags}
          priority={key}
          sortUi={sortUi}
          onOpenIdea={onOpenIdea}
          onGestureStart={beginGesture}
          onGestureMove={moveGesture}
          onGestureEnd={endGesture}
          onGestureCancel={cancelGesture}
          onSuppressClick={suppressRowClick}
          onHandleClick={handleHandleClick}
          onCopyIdea={onCopyIdea}
        />
      </ScrollView>

      <View className='bucket-tabs'>
        {PRIORITY_ORDER.map((priority, index) => (
          <View
            key={priority}
            className={`bucket-tab ${index === current ? 'active' : ''}`}
            style={{ '--bucket-color': theme.priorities[priority] } as CSSProperties}
            ariaRole='button'
            ariaLabel={`${PRIORITY_META[priority].name}，${counts[priority]} 条`}
            onClick={() => {
              if (sortUi.active) return
              onCurrentChange(index)
            }}
          >
            <View className='bucket-tab-dot' />
            <Text>{PRIORITY_META[priority].name}</Text>
            <Text className='bucket-tab-count'>{counts[priority]}</Text>
          </View>
        ))}
      </View>

      <View className={`sort-overlay ${sortUi.active ? 'show' : ''} ${sortUi.mode || ''}`}>
        <View className='sort-backdrop' onClick={() => sortUi.mode === 'choosing' && closeSortUi()} />
        <View className='sort-targets'>
          <Text className='sort-title'>
            {sortUi.hover
              ? sortUi.hover === 'archive' ? '松手归档任务' : `放入「${PRIORITY_META[sortUi.hover].name}」`
              : sortUi.mode === 'choosing' ? '选择一个收纳圈' : '拖进收纳圈后松手'}
          </Text>
          <PriorityTargets
            priorities={availableTargets}
            hover={sortUi.hover === 'archive' ? null : sortUi.hover}
            targetClassName='organize-drop-target'
            onSelect={moveFromPicker}
          />
          <Text className='sort-cancel' onClick={closeSortUi}>取消</Text>
        </View>
      </View>

      {sortUi.active && sortUi.mode === 'dragging' && (
        <View
          ref={ghostRef}
          className={`drag-ghost ${sortUi.phase} ${sortUi.hover ? 'magnet' : ''}`}
          style={{
            '--ghost-color': theme.ideaPalette[sortUi.ideaColorSlot],
            left: `${sortUi.x}px`,
            top: `${sortUi.y - GHOST_Y_OFFSET}px`
          } as CSSProperties}
        >
          <View className='drag-ghost-aura' />
          <View className='drag-ghost-core' />
        </View>
      )}
    </View>
  )
}
