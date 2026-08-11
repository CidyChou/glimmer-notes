import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Image, Input, Text, View } from '@tarojs/components'
import { useEffect, useMemo, useState } from 'react'
import { PRIORITY_META } from '@/constants/priorities'
import BottomBar from '@/components/BottomBar'
import ComposerSheet from '@/components/ComposerSheet'
import DetailSheet from '@/components/DetailSheet'
import IdeaSpaceCanvas from '@/components/IdeaSpaceCanvas'
import OrganizeView from '@/components/OrganizeView'
import { loadIdeaState, recordIdeaDeletion, saveIdeas, saveProjects } from '@/services/ideaStorage'
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
import searchIcon from '@/assets/icons/search.svg'
import settingsIcon from '@/assets/icons/settings.png'
import './index.css'

type Mode = 'space' | 'organize'

export default function IndexPage() {
  const { themeStyle } = useTheme()
  const [initialState] = useState(loadIdeaState)
  const [ideas, setIdeas] = useState<Idea[]>(initialState.ideas)
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

  useEffect(() => subscribeSyncData((nextIdeas, nextTags, nextProjects) => {
    setIdeas(nextIdeas)
    setTags(nextTags)
    setProjects(nextProjects)
  }), [])

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
    setIdeas(next)
    saveIdeas(next)
    scheduleSync()
  }

  const flash = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(''), 1350)
  }

  const assignPriority = (id: string, priority: PriorityKey) => {
    const updatedAt = Date.now()
    commitIdeas(ideas.map((idea) => idea.id === id ? { ...idea, priority, updatedAt } : idea))
    flash(`已放入「${PRIORITY_META[priority].name}」`)
  }

  const archiveIdea = (id: string) => {
    const updatedAt = Date.now()
    commitIdeas(ideas.map((idea) => idea.id === id ? { ...idea, archivedAt: updatedAt, updatedAt } : idea))
    setSelectedId(null)
    flash('已归档，可在设置中查看')
  }

  const assignProject = (id: string, projectId: string) => {
    const project = findProjectById(projectId, projects)
    const updatedAt = Date.now()
    commitIdeas(ideas.map((idea) => idea.id === id ? {
      ...idea,
      projectId: project.id,
      colorSlot: project.colorSlot,
      updatedAt
    } : idea))
    flash(`已归入「${project.name}」`)
  }

  const toggleIdeaTag = (id: string, tagId: string) => {
    const tag = tags.find((item) => item.id === tagId)
    if (!tag) return
    const updatedAt = Date.now()
    const current = ideas.find((idea) => idea.id === id)
    const removing = current?.tagIds.includes(tagId)
    commitIdeas(ideas.map((idea) => idea.id === id ? {
      ...idea,
      tagIds: toggleTagId(idea.tagIds, tagId),
      updatedAt
    } : idea))
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
      commitIdeas(ideas.map((idea) => idea.id === selectedId ? {
        ...idea,
        projectId: project.id,
        colorSlot: project.colorSlot,
        updatedAt: now
      } : idea))
    } else {
      scheduleSync()
    }
    flash(`已添加项目「${project.name}」`)
    return project
  }

  const saveSelected = (title: string, details: string) => {
    if (!selectedId || !title.trim()) return
    const text = composeIdeaText(title, details)
    const updatedAt = Date.now()
    commitIdeas(ideas.map((idea) => idea.id === selectedId ? { ...idea, text, updatedAt } : idea))
    setSelectedId(null)
    flash('修改已保存')
  }

  const togglePin = () => {
    if (!selectedId) return
    const updatedAt = Date.now()
    commitIdeas(ideas.map((idea) => idea.id === selectedId ? { ...idea, pinned: !idea.pinned, updatedAt } : idea))
  }

  const deleteSelected = () => {
    if (!selectedId) return
    recordIdeaDeletion(selectedId, Date.now())
    commitIdeas(ideas.filter((idea) => idea.id !== selectedId))
    setSelectedId(null)
    flash('已删除')
  }

  const hasSheetOpen = composerOpen || !!selectedId

  return (
    <View className='stage theme-root' style={themeStyle}>
      <View className={`phone-shell mode-${mode}`}>
        <View className='ambient ambient-a' />
        <View className='ambient ambient-b' />

        <View className='topbar'>
          <View className='brand'>
            <Text className='eyebrow'>IDEA INBOX</Text>
            <Text className='title'>拾光笔记</Text>
          </View>
          <View className='topbar-actions'>
            <Button
              className='icon-btn search-btn'
              ariaLabel='搜索想法'
              onClick={() => setSearchOpen((open) => !open)}
            >
              <View className='search-icon-shell'>
                <Image className='search-icon' src={searchIcon} mode='aspectFit' />
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

        <View className={`search-wrap ${searchOpen ? 'show' : ''}`}>
          <View className='search-glyph search-field-glyph' />
          <Input
            className='search-input'
            value={query}
            focus={searchOpen}
            placeholder='搜索任务、项目或标签…'
            onInput={(event) => setQuery(event.detail.value)}
          />
          <Text className='search-close' onClick={() => { setQuery(''); setSearchOpen(false) }}>取消</Text>
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
            onSave={saveSelected}
            onTogglePin={togglePin}
            onDelete={deleteSelected}
          />
        )}

        <View className={`toast ${toast ? 'show' : ''}`}>{toast}</View>
      </View>
    </View>
  )
}
