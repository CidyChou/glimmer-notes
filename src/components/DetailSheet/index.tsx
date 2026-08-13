import { Button, Input, ScrollView, Text, View } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import LineMarkdownEditor from '@/components/LineMarkdownEditor'
import type { LineMarkdownCommitReason } from '@/components/LineMarkdownEditor'
import { PRIORITY_META, PRIORITY_ORDER } from '@/constants/priorities'
import { formatDetailTime } from '@/utils/date'
import { splitIdeaText } from '@/utils/ideaText'
import type { Idea, IdeaProject, IdeaTag, PriorityKey } from '@/types/idea'
import { useTheme } from '@/theme'
import type { IdeaColorSlot } from '@/theme'
import './index.css'

interface DrawerDragState {
  active: boolean
  startY: number
  lastY: number
  lastTime: number
  offset: number
  velocity: number
}

const DRAWER_CLOSE_RATIO = 0.22
const DRAWER_CLOSE_MIN_DISTANCE = 88
const DRAWER_FLING_MIN_DISTANCE = 36
const DRAWER_FLING_VELOCITY = 0.55
const DRAWER_CLOSE_DURATION = 240

interface Props {
  idea: Idea
  projects: IdeaProject[]
  tags: IdeaTag[]
  open: boolean
  onClose: () => void
  onPriorityChange: (priority: PriorityKey) => void
  onProjectChange: (projectId: string) => void
  onCreateProject: (name: string, colorSlot: IdeaColorSlot) => IdeaProject | null
  onTagToggle: (tagId: string) => void
  onAutoSave: (title: string, details: string, reason: LineMarkdownCommitReason) => void
  onTogglePin: () => void
  onCopy: () => void
  onArchive: () => void
  onDelete: () => void
}

export default function DetailSheet({
  idea,
  projects,
  tags,
  open,
  onClose,
  onPriorityChange,
  onProjectChange,
  onCreateProject,
  onTagToggle,
  onAutoSave,
  onTogglePin,
  onCopy,
  onArchive,
  onDelete
}: Props) {
  const { theme } = useTheme()
  const live = splitIdeaText(idea.text)
  const [title, setTitle] = useState(live.title)
  const [details, setDetails] = useState(live.details)
  const titleRef = useRef(title)
  const detailsRef = useRef(details)
  const onAutoSaveRef = useRef(onAutoSave)
  onAutoSaveRef.current = onAutoSave
  const [projectCreateOpen, setProjectCreateOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectColor, setNewProjectColor] = useState<IdeaColorSlot>(2)
  const [closing, setClosing] = useState(false)
  const sheetRef = useRef<HTMLElement | null>(null)
  const dragHandleRef = useRef<HTMLElement | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeStartedRef = useRef(false)
  const onCloseRef = useRef(onClose)
  const dragRef = useRef<DrawerDragState>({
    active: false,
    startY: 0,
    lastY: 0,
    lastTime: 0,
    offset: 0,
    velocity: 0
  })
  onCloseRef.current = onClose

  const updateTitle = (value: string) => {
    titleRef.current = value
    setTitle(value)
  }

  const updateDetails = (value: string) => {
    detailsRef.current = value
    setDetails(value)
  }

  const persistDraft = (reason: LineMarkdownCommitReason = 'edit') => {
    const nextTitle = titleRef.current
    if (!nextTitle.trim()) {
      titleRef.current = live.title
      setTitle(live.title)
      return
    }
    onAutoSaveRef.current(nextTitle, detailsRef.current, reason)
  }

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    if (titleRef.current.trim()) {
      onAutoSaveRef.current(titleRef.current, detailsRef.current, 'edit')
    }
  }, [])

  const submitProject = () => {
    const name = newProjectName.trim()
    if (!name) return
    const project = onCreateProject(name, newProjectColor)
    if (!project) return
    setNewProjectName('')
    setProjectCreateOpen(false)
    setNewProjectColor(((project.colorSlot + 1) % theme.ideaPalette.length) as IdeaColorSlot)
  }

  const closeSheet = () => {
    if (closeStartedRef.current) return
    closeStartedRef.current = true
    persistDraft()
    setClosing(true)
    const reduceMotion = process.env.TARO_ENV === 'h5' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    closeTimerRef.current = setTimeout(
      () => onCloseRef.current(),
      reduceMotion ? 0 : DRAWER_CLOSE_DURATION
    )
  }

  const setDrawerOffset = (offset: number) => {
    dragRef.current.offset = offset
    sheetRef.current?.style.setProperty('--drawer-y', `${offset}px`)
  }

  const beginDrawerDrag = (clientY: number, timeStamp: number) => {
    if (closing || closeStartedRef.current) return
    dragRef.current = {
      active: true,
      startY: clientY,
      lastY: clientY,
      lastTime: timeStamp || Date.now(),
      offset: 0,
      velocity: 0
    }
    sheetRef.current?.classList.add('dragging')
  }

  const moveDrawerDrag = (clientY: number, timeStamp: number) => {
    const drag = dragRef.current
    if (!drag.active) return
    const nextOffset = Math.max(0, clientY - drag.startY)
    const nextTime = timeStamp || Date.now()
    const elapsed = Math.max(1, nextTime - drag.lastTime)
    drag.velocity = (clientY - drag.lastY) / elapsed
    drag.lastY = clientY
    drag.lastTime = nextTime
    setDrawerOffset(nextOffset)
  }

  const endDrawerDrag = (cancelled = false) => {
    const drag = dragRef.current
    if (!drag.active) return
    drag.active = false
    const sheet = sheetRef.current
    sheet?.classList.remove('dragging')
    const sheetHeight = sheet?.getBoundingClientRect().height || 400
    const closeDistance = Math.max(
      DRAWER_CLOSE_MIN_DISTANCE,
      sheetHeight * DRAWER_CLOSE_RATIO
    )
    const shouldClose = !cancelled && (
      drag.offset >= closeDistance ||
      (drag.offset >= DRAWER_FLING_MIN_DISTANCE && drag.velocity >= DRAWER_FLING_VELOCITY)
    )
    if (shouldClose) {
      closeSheet()
      return
    }
    setDrawerOffset(0)
  }

  useEffect(() => {
    if (process.env.TARO_ENV !== 'h5') return
    const handle = dragHandleRef.current
    if (!handle) return

    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      event.preventDefault()
      handle.setPointerCapture?.(event.pointerId)
      beginDrawerDrag(event.clientY, event.timeStamp)
    }
    const pointerMove = (event: PointerEvent) => {
      if (!dragRef.current.active) return
      event.preventDefault()
      moveDrawerDrag(event.clientY, event.timeStamp)
    }
    const pointerUp = (event: PointerEvent) => {
      if (!dragRef.current.active) return
      handle.releasePointerCapture?.(event.pointerId)
      endDrawerDrag()
    }
    const pointerCancel = () => endDrawerDrag(true)

    handle.addEventListener('pointerdown', pointerDown)
    handle.addEventListener('pointermove', pointerMove)
    handle.addEventListener('pointerup', pointerUp)
    handle.addEventListener('pointercancel', pointerCancel)
    return () => {
      handle.removeEventListener('pointerdown', pointerDown)
      handle.removeEventListener('pointermove', pointerMove)
      handle.removeEventListener('pointerup', pointerUp)
      handle.removeEventListener('pointercancel', pointerCancel)
    }
  })

  return (
    <View
      ref={sheetRef}
      className={`detail-sheet ${open ? 'show' : ''} ${closing ? 'closing' : ''}`}
    >
      <View
        ref={dragHandleRef}
        className='detail-drag-handle'
        ariaRole='button'
        ariaLabel='向下拖动关闭任务详情'
        onTouchStart={(event: any) => {
          if (process.env.TARO_ENV === 'h5') return
          const touch = event.touches[0]
          if (touch) beginDrawerDrag(touch.clientY, event.timeStamp)
        }}
        onTouchMove={(event: any) => {
          if (process.env.TARO_ENV === 'h5') return
          const touch = event.touches[0]
          if (!touch) return
          event.preventDefault()
          moveDrawerDrag(touch.clientY, event.timeStamp)
        }}
        onTouchEnd={() => {
          if (process.env.TARO_ENV !== 'h5') endDrawerDrag()
        }}
        onTouchCancel={() => {
          if (process.env.TARO_ENV !== 'h5') endDrawerDrag(true)
        }}
      >
        <View className='detail-grabber' />
      </View>
      <View className='detail-top'>
        <View>
          <Text className='detail-kicker'>任务详情</Text>
          <Text className='detail-time'>{formatDetailTime(idea.createdAt)}</Text>
        </View>
        <Button className='close-btn' ariaLabel='关闭详情面板' onClick={closeSheet}>×</Button>
      </View>

      <View className='detail-editor detail-editor-live'>
        <View className='detail-label-row'>
          <Text className='detail-field-label'>标题</Text>
          <Text className='detail-optional'>失焦自动保存</Text>
        </View>
        <Input
          className='detail-title-input'
          value={title}
          maxlength={80}
          confirmType='done'
          ariaLabel='任务标题'
          placeholder='输入任务标题'
          onInput={(event) => updateTitle(event.detail.value)}
          onBlur={() => persistDraft()}
          onConfirm={() => persistDraft()}
        />
        <View className='detail-field-divider' />
        <View className='detail-label-row'>
          <Text className='detail-field-label'>详情</Text>
          <Text className='detail-optional'>连续编辑 · Markdown · 自动保存</Text>
        </View>
        <LineMarkdownEditor
          className='detail-line-editor'
          value={details}
          onChange={updateDetails}
          onCommit={(value, reason) => {
            updateDetails(value)
            persistDraft(reason)
          }}
        />
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
      <View className='detail-taxonomy-title'>
        <Text className='priority-picker-title tag-picker-title'>所属项目</Text>
        <Text className='detail-taxonomy-hint'>单选</Text>
      </View>
      <ScrollView className='detail-tag-scroll' scrollX enhanced showScrollbar={false}>
        <View className='detail-tag-list'>
          {projects.map((project) => (
            <View
              key={project.id}
              className={`detail-tag project ${idea.projectId === project.id ? 'active' : ''}`}
              ariaRole='button'
              ariaLabel={`选择所属项目${project.name}`}
              style={{ '--tag-color': theme.ideaPalette[project.colorSlot] } as CSSProperties}
              onClick={() => onProjectChange(project.id)}
            >
              <View className='detail-tag-radio'><View /></View>
              <Text>{project.name}</Text>
            </View>
          ))}
          <View
            className={`detail-tag project-add ${projectCreateOpen ? 'active' : ''}`}
            ariaRole='button'
            ariaLabel='新增项目'
            onClick={() => setProjectCreateOpen((value) => !value)}
          >
            <View className='project-add-glyph'>+</View>
            <Text>新增项目</Text>
          </View>
        </View>
      </ScrollView>
      {projectCreateOpen && (
        <View className='detail-project-create'>
          <View className='detail-project-create-row'>
            <Input
              className='detail-project-name-input'
              value={newProjectName}
              maxlength={16}
              ariaLabel='新项目名称'
              placeholder='输入项目名称'
              placeholderClass='detail-project-name-placeholder'
              confirmType='done'
              onInput={(event) => setNewProjectName(event.detail.value)}
              onConfirm={submitProject}
            />
            <Button
              className='detail-project-save-btn'
              disabled={newProjectName.trim() ? undefined : true}
              onClick={submitProject}
            >保存</Button>
          </View>
          <View className='detail-project-create-footer'>
            <View className='detail-project-colors'>
              {theme.ideaPalette.map((_, index) => (
                <View
                  key={index}
                  className={`detail-project-color ${newProjectColor === index ? 'active' : ''}`}
                  style={{ '--tag-color': theme.ideaPalette[index] } as CSSProperties}
                  ariaRole='button'
                  ariaLabel={`选择项目颜色 ${index + 1}`}
                  onClick={() => setNewProjectColor(index as IdeaColorSlot)}
                />
              ))}
            </View>
            <Text className='detail-project-cancel' onClick={() => setProjectCreateOpen(false)}>取消</Text>
          </View>
        </View>
      )}
      <View className='detail-taxonomy-title'>
        <Text className='priority-picker-title tag-picker-title'>任务标签</Text>
        <Text className='detail-taxonomy-hint'>可多选</Text>
      </View>
      <ScrollView className='detail-tag-scroll' scrollX enhanced showScrollbar={false}>
        <View className='detail-tag-list'>
          {tags.map((tag) => (
            <View
              key={tag.id}
              className={`detail-tag ${idea.tagIds.includes(tag.id) ? 'active' : ''}`}
              ariaRole='button'
              ariaLabel={`${idea.tagIds.includes(tag.id) ? '移除' : '添加'}${tag.name}标签`}
              style={{ '--tag-color': theme.ideaPalette[tag.colorSlot] } as CSSProperties}
              onClick={() => onTagToggle(tag.id)}
            >
              <View className='detail-tag-dot' />
              <Text>{tag.name}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View className='detail-actions'>
        <Button onClick={onTogglePin}>{idea.pinned ? '★ 取消收藏' : '☆ 收藏'}</Button>
        <Button className='copy-action' onClick={onCopy}>复制</Button>
        <Button className='archive-action' onClick={onArchive}>归档</Button>
        <Button className='danger' onClick={onDelete}>删除</Button>
      </View>
    </View>
  )
}
