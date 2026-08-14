import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Image, Input, Text, View } from '@tarojs/components'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PRIORITY_META } from '@/constants/priorities'
import BottomBar from '@/components/BottomBar'
import ComposerSheet from '@/components/ComposerSheet'
import DetailSheet from '@/components/DetailSheet'
import IdeaSpaceCanvas from '@/components/IdeaSpaceCanvas'
import OrganizeView from '@/components/OrganizeView'
import { loadIdeaState, recordIdeaDeletion, saveIdeas, saveProjects } from '@/services/ideaStorage'
import {
  getIdeaHistoryState,
  recordIdeaChange,
  redoIdeaChange,
  subscribeIdeaHistory,
  undoIdeaChange
} from '@/services/ideaHistory'
import type { IdeaHistoryState } from '@/services/ideaHistory'
import { getSyncStatus, scheduleSync, subscribeSyncData, subscribeSyncStatus } from '@/services/sync'
import { createId } from '@/utils/id'
import { copyText } from '@/utils/clipboard'
import { isToday } from '@/utils/date'
import { composeIdeaText } from '@/utils/ideaText'
import { DEFAULT_PROJECT_ID } from '@/types/idea'
import type { Idea, IdeaDropTarget, IdeaProject, IdeaTag, PriorityKey } from '@/types/idea'
import { findIdeaProject, findIdeaTags, findProjectById, toggleTagId } from '@/utils/tags'
import { useTheme } from '@/theme'
import type { IdeaColorSlot } from '@/theme'
import searchIcon from '@/assets/icons/search.png'
import settingsIcon from '@/assets/icons/settings.png'
import historyArrowIcon from '@/assets/icons/history-arrow.png'
import './index.css'

type Mode = 'space' | 'organize'

export default function IndexPage() {
  const { themeStyle } = useTheme()
  const [initialState] = useState(loadIdeaState)
  const [ideas, setIdeas] = useState<Idea[]>(initialState.ideas)
  const ideasRef = useRef(ideas)
  ideasRef.current = ideas
  const [projects, setProjects] = useState<IdeaProject[]>(initialState.projects)
  const [tags, setTags] = useState<IdeaTag[]>(initialState.tags)
  const [mode, setMode] = useState<Mode>('space')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftDetails, setDraftDetails] = useState('')
  const [draftProjectId, setDraftProjectId] = useState(DEFAULT_PROJECT_ID)
  const [draftTagIds, setDraftTagIds] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [bucketIndex, setBucketIndex] = useState(0)
  const [dragUi, setDragUi] = useState<{ active: boolean; hover: IdeaDropTarget | null }>({ active: false, hover: null })
  const [toast, setToast] = useState('')
  const [historyState, setHistoryState] = useState<IdeaHistoryState>(getIdeaHistoryState)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => subscribeSyncData((nextIdeas, nextTags, nextProjects) => {
    setIdeas(nextIdeas)
    setTags(nextTags)
    setProjects(nextProjects)
  }), [])

  useEffect(() => subscribeIdeaHistory(setHistoryState), [])

  useEffect(() => {
    const refreshTaxonomy = () => {
      const nextState = loadIdeaState()
      setIdeas(nextState.ideas)
      setTags(nextState.tags)
      setProjects(nextState.projects)
    }
    Taro.eventCenter.on('idea-taxonomy-updated', refreshTaxonomy)
    return () => {
      Taro.eventCenter.off('idea-taxonomy-updated', refreshTaxonomy)
    }
  }, [])

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  }, [])

  useDidShow(() => {
    const nextState = loadIdeaState()
    setIdeas(nextState.ideas)
    setTags(nextState.tags)
    setProjects(nextState.projects)
  })

  useEffect(() => {
    let previous = getSyncStatus().phase
    return subscribeSyncStatus((next) => {
      if ((next.phase === 'error' || next.phase === 'offline') && next.phase !== previous) {
        setToast('云端暂时不可用，本地已保存')
        setTimeout(() => setToast(''), 1800)
      }
      previous = next.phase
    })
  }, [])

  useEffect(() => {
    const handleSyncFeedback = (message: unknown) => {
      if (typeof message === 'string' && message) flash(message)
    }
    Taro.eventCenter.on('idea-sync-feedback', handleSyncFeedback)
    return () => {
      Taro.eventCenter.off('idea-sync-feedback', handleSyncFeedback)
    }
  }, [])

  const activeIdeas = useMemo(() => ideas.filter((idea) => idea.archivedAt === null), [ideas])
  const selectedIdea = useMemo(() => activeIdeas.find((idea) => idea.id === selectedId) || null, [activeIdeas, selectedId])
  const todayCount = useMemo(() => activeIdeas.filter((idea) => isToday(idea.createdAt)).length, [activeIdeas])
  const inboxCount = useMemo(() => activeIdeas.filter((idea) => idea.priority === 'inbox').length, [activeIdeas])
  const filteredIdeas = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return activeIdeas
    return activeIdeas.filter((idea) => {
      const project = findIdeaProject(idea, projects)
      const ideaTags = findIdeaTags(idea, tags)
      return idea.text.toLowerCase().includes(keyword) ||
        project.name.toLowerCase().includes(keyword) ||
        ideaTags.some((tag) => tag.name.toLowerCase().includes(keyword))
    })
  }, [activeIdeas, projects, query, tags])

  const commitIdeas = (next: Idea[]) => {
    ideasRef.current = next
    setIdeas(next)
    saveIdeas(next)
    scheduleSync()
  }

  const flash = (message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(message)
    toastTimerRef.current = setTimeout(() => {
      setToast('')
      toastTimerRef.current = null
    }, 1350)
  }

  const assignPriority = (id: string, priority: PriorityKey) => {
    const current = ideas.find((idea) => idea.id === id)
    if (!current || current.priority === priority) return
    const updatedAt = Date.now()
    const after = { ...current, priority, updatedAt }
    commitIdeas(ideas.map((idea) => idea.id === id ? after : idea))
    recordIdeaChange({ ideaId: id, before: current, after, label: `移动到「${PRIORITY_META[priority].name}」` })
    flash(`已放入「${PRIORITY_META[priority].name}」`)
  }

  const archiveIdea = (id: string) => {
    const current = ideas.find((idea) => idea.id === id)
    if (!current || current.archivedAt !== null) return
    const updatedAt = Date.now()
    const after = { ...current, archivedAt: updatedAt, updatedAt }
    commitIdeas(ideas.map((idea) => idea.id === id ? after : idea))
    recordIdeaChange({ ideaId: id, before: current, after, label: '归档任务' })
    setSelectedId(null)
    flash('已归档，可在设置中查看')
  }

  const assignProject = (id: string, projectId: string) => {
    const current = ideas.find((idea) => idea.id === id)
    const project = findProjectById(projectId, projects)
    if (!current || current.projectId === project.id) return
    const updatedAt = Date.now()
    const after = {
      ...current,
      projectId: project.id,
      colorSlot: project.colorSlot,
      updatedAt
    }
    commitIdeas(ideas.map((idea) => idea.id === id ? after : idea))
    recordIdeaChange({ ideaId: id, before: current, after, label: `移动到「${project.name}」` })
    flash(`已归入「${project.name}」`)
  }

  const toggleIdeaTag = (id: string, tagId: string) => {
    const tag = tags.find((item) => item.id === tagId)
    if (!tag) return
    const updatedAt = Date.now()
    const current = ideas.find((idea) => idea.id === id)
    if (!current) return
    const removing = current?.tagIds.includes(tagId)
    const after = {
      ...current,
      tagIds: toggleTagId(current.tagIds, tagId),
      updatedAt
    }
    commitIdeas(ideas.map((idea) => idea.id === id ? after : idea))
    recordIdeaChange({ ideaId: id, before: current, after, label: removing ? `移除标签「${tag.name}」` : `添加标签「${tag.name}」` })
    flash(removing ? `已移除「${tag.name}」` : `已添加「${tag.name}」`)
  }

  const copyIdea = async (idea: Idea) => {
    try {
      await copyText(idea.text)
      flash('已复制到剪贴板')
    } catch {
      flash('复制失败，请重试')
    }
  }

  const saveDraft = () => {
    const text = composeIdeaText(draftTitle, draftDetails)
    if (!draftTitle.trim()) return
    const now = Date.now()
    const project = findProjectById(draftProjectId, projects)
    const idea: Idea = {
      id: createId(),
      text,
      createdAt: now,
      updatedAt: now,
      colorSlot: project.colorSlot,
      projectId: project.id,
      tagIds: draftTagIds,
      pinned: false,
      priority: 'inbox',
      archivedAt: null
    }
    commitIdeas([idea, ...ideas])
    recordIdeaChange({ ideaId: idea.id, before: null, after: idea, label: `新建「${draftTitle.trim()}」` })
    setDraftTitle('')
    setDraftDetails('')
    setDraftProjectId(DEFAULT_PROJECT_ID)
    setDraftTagIds([])
    setComposerOpen(false)
    setBucketIndex(0)
    flash('已收进碎片池')
  }

  const createProject = (name: string, colorSlot: IdeaColorSlot): IdeaProject | null => {
    const normalizedName = name.trim().slice(0, 16)
    if (!normalizedName) return null
    if (projects.some((project) => project.name.toLowerCase() === normalizedName.toLowerCase())) {
      flash('已经有同名项目了')
      return null
    }

    const now = Date.now()
    const project: IdeaProject = {
      id: createId(),
      name: normalizedName,
      colorSlot,
      createdAt: now,
      updatedAt: now,
      isDefault: false
    }
    const nextProjects = [...projects, project]
    setProjects(nextProjects)
    saveProjects(nextProjects)
    Taro.eventCenter.trigger('idea-taxonomy-updated')

    if (selectedId) {
      const current = ideas.find((idea) => idea.id === selectedId)
      const after = current ? {
        ...current,
        projectId: project.id,
        colorSlot: project.colorSlot,
        updatedAt: now
      } : null
      if (current && after) {
        commitIdeas(ideas.map((idea) => idea.id === selectedId ? after : idea))
        recordIdeaChange({ ideaId: selectedId, before: current, after, label: `移动到「${project.name}」` })
      }
    } else {
      scheduleSync()
    }
    flash(`已添加项目「${project.name}」`)
    return project
  }

  const autoSaveSelected = (title: string, details: string, reason: 'edit' | 'task') => {
    if (!selectedId || !title.trim()) return
    const current = ideasRef.current.find((idea) => idea.id === selectedId)
    if (!current) return
    const text = composeIdeaText(title, details)
    if (text === current.text) return
    const updatedAt = Date.now()
    const after = { ...current, text, updatedAt }
    commitIdeas(ideasRef.current.map((idea) => idea.id === selectedId ? after : idea))
    recordIdeaChange({
      ideaId: selectedId,
      before: current,
      after,
      label: reason === 'task' ? '更新清单' : '编辑详情'
    })
  }

  const togglePin = () => {
    if (!selectedId) return
    const current = ideas.find((idea) => idea.id === selectedId)
    if (!current) return
    const updatedAt = Date.now()
    const after = { ...current, pinned: !current.pinned, updatedAt }
    commitIdeas(ideas.map((idea) => idea.id === selectedId ? after : idea))
    recordIdeaChange({ ideaId: selectedId, before: current, after, label: after.pinned ? '收藏任务' : '取消收藏' })
    flash(after.pinned ? '已收藏' : '已取消收藏')
  }

  const deleteSelected = () => {
    if (!selectedId) return
    const deletedIdea = ideas.find((idea) => idea.id === selectedId)
    if (!deletedIdea) return
    recordIdeaDeletion(selectedId, Date.now())
    commitIdeas(ideas.filter((idea) => idea.id !== selectedId))
    recordIdeaChange({ ideaId: selectedId, before: deletedIdea, after: null, label: `删除「${deletedIdea.text.split('\n')[0] || '任务'}」` })
    setSelectedId(null)
    flash('已删除')
  }

  const applyHistory = (direction: 'undo' | 'redo') => {
    const result = direction === 'undo'
      ? undoIdeaChange({ ideas, projects, tags })
      : redoIdeaChange({ ideas, projects, tags })
    if (!result) return
    setIdeas(result.ideas)
    scheduleSync()
    flash(`${direction === 'undo' ? '已撤回' : '已重做'}：${result.label}`)
  }

  const closeSearch = () => {
    setQuery('')
    setSearchOpen(false)
  }

  const hasSheetOpen = composerOpen || !!selectedId

  return (
    <View className={`stage theme-root ${process.env.TARO_ENV === 'h5' ? 'platform-h5' : 'platform-mini'}`} style={themeStyle}>
      <View className={`phone-shell mode-${mode}`}>
        <View className='ambient ambient-a' />
        <View className='ambient ambient-b' />

        <View className='topbar'>
          <View className='brand'>
            <Text className='eyebrow'>IDEA INBOX</Text>
            <Text className='title'>光屿札记</Text>
          </View>
          <View className='topbar-actions'>
            <View className='history-controls' ariaLabel='任务历史'>
              <Button
                className={`history-btn history-undo ${historyState.canUndo ? 'enabled' : 'disabled'}`}
                disabled={!historyState.canUndo || dragUi.active || searchOpen || hasSheetOpen}
                ariaLabel={historyState.undoLabel ? `撤回：${historyState.undoLabel}` : '撤回上一步操作'}
                onClick={() => applyHistory('undo')}
              >
                <Image className='history-icon' src={historyArrowIcon} mode='scaleToFill' />
              </Button>
              <View className='history-divider' />
              <Button
                className={`history-btn history-redo ${historyState.canRedo ? 'enabled' : 'disabled'}`}
                disabled={!historyState.canRedo || dragUi.active || searchOpen || hasSheetOpen}
                ariaLabel={historyState.redoLabel ? `重做：${historyState.redoLabel}` : '重做下一步操作'}
                onClick={() => applyHistory('redo')}
              >
                <Image className='history-icon history-redo-icon' src={historyArrowIcon} mode='scaleToFill' />
              </Button>
            </View>
            <Button
              className='icon-btn search-btn'
              ariaLabel='搜索想法'
              onClick={() => searchOpen ? closeSearch() : setSearchOpen(true)}
            >
              <View className='search-icon-shell'>
                <Image className='search-icon' src={searchIcon} mode='scaleToFill' />
              </View>
            </Button>
            <Button
              className='icon-btn settings-btn'
              ariaLabel='打开设置'
              onClick={() => Taro.navigateTo({ url: '/pages/settings/index' })}
            >
              <View className='settings-icon-shell'>
                <Image className='settings-icon' src={settingsIcon} mode='scaleToFill' />
              </View>
            </Button>
          </View>
        </View>

        <View className={`space-view ${mode !== 'space' ? 'hidden' : ''}`}>
          <IdeaSpaceCanvas
            ideas={filteredIdeas}
            active={mode === 'space'}
            onOpenIdea={setSelectedId}
            onAssignPriority={assignPriority}
            onArchiveIdea={archiveIdea}
            onDragUiChange={(active, hover) => setDragUi({ active, hover })}
          />
          <View className='space-fade' />
          <View className='space-hint'>按住想法后拖动，可整理或归档</View>
        </View>

        <View className={`organize-view ${mode === 'organize' ? 'active' : ''}`}>
          <OrganizeView
            ideas={filteredIdeas}
            projects={projects}
            tags={tags}
            current={bucketIndex}
            onCurrentChange={setBucketIndex}
            onOpenIdea={setSelectedId}
            onAssignPriority={assignPriority}
            onArchiveIdea={archiveIdea}
            onCopyIdea={(idea) => void copyIdea(idea)}
            onDragUiChange={(active, hover) => setDragUi({ active, hover })}
          />
        </View>

        <BottomBar
          mode={mode}
          todayCount={todayCount}
          inboxCount={inboxCount}
          dragging={dragUi.active}
          hover={dragUi.hover}
          onAdd={() => setComposerOpen(true)}
          onModeChange={setMode}
        />

        <View
          className={`search-dismiss ${searchOpen ? 'show' : ''}`}
          ariaRole='button'
          ariaLabel='关闭搜索'
          onClick={closeSearch}
        />
        <View className={`search-wrap ${searchOpen ? 'show' : ''}`}>
          <View className='search-glyph search-field-glyph' />
          <Input
            className='search-input'
            value={query}
            focus={searchOpen}
            placeholder='搜索任务、项目或标签…'
            onInput={(event) => setQuery(event.detail.value)}
            onBlur={closeSearch}
          />
          <Text className='search-close' onClick={closeSearch}>取消</Text>
        </View>

        <View
          className={`scrim ${hasSheetOpen ? 'show' : ''}`}
          onClick={() => { setComposerOpen(false); setSelectedId(null) }}
        />

        <ComposerSheet
          open={composerOpen}
          title={draftTitle}
            details={draftDetails}
            projects={projects}
            tags={tags}
            selectedProjectId={draftProjectId}
            selectedTagIds={draftTagIds}
            onTitleChange={setDraftTitle}
            onDetailsChange={setDraftDetails}
            onProjectChange={setDraftProjectId}
            onCreateProject={createProject}
            onTagToggle={(tagId) => setDraftTagIds((ids) => toggleTagId(ids, tagId))}
          onSave={saveDraft}
        />
        {selectedIdea && (
          <DetailSheet
            key={selectedIdea.id}
            idea={selectedIdea}
            projects={projects}
            tags={tags}
            open
            onClose={() => setSelectedId(null)}
            onPriorityChange={(priority) => selectedId && assignPriority(selectedId, priority)}
            onProjectChange={(projectId) => selectedId && assignProject(selectedId, projectId)}
            onCreateProject={createProject}
            onTagToggle={(tagId) => selectedId && toggleIdeaTag(selectedId, tagId)}
            onCopy={() => void copyIdea(selectedIdea)}
            onArchive={() => archiveIdea(selectedIdea.id)}
            onAutoSave={autoSaveSelected}
            onTogglePin={togglePin}
            onDelete={deleteSelected}
          />
        )}

        <View className={`toast ${toast ? 'show' : ''}`}><Text>{toast}</Text></View>
      </View>
    </View>
  )
}
