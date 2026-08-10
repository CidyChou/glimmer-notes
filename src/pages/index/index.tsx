import Taro from '@tarojs/taro'
import { Button, Input, Text, View } from '@tarojs/components'
import { useEffect, useMemo, useState } from 'react'
import { PRIORITY_META } from '@/constants/priorities'
import BottomBar from '@/components/BottomBar'
import ComposerSheet from '@/components/ComposerSheet'
import DetailSheet from '@/components/DetailSheet'
import IdeaSpaceCanvas from '@/components/IdeaSpaceCanvas'
import OrganizeView from '@/components/OrganizeView'
import { loadIdeaState, recordIdeaDeletion, saveIdeas } from '@/services/ideaStorage'
import { getSyncStatus, scheduleSync, subscribeSyncData, subscribeSyncStatus } from '@/services/sync'
import { createId } from '@/utils/id'
import { isToday } from '@/utils/date'
import { composeIdeaText } from '@/utils/ideaText'
import type { Idea, PriorityKey } from '@/types/idea'
import { useTheme } from '@/theme'
import type { IdeaColorSlot } from '@/theme'
import './index.css'

type Mode = 'space' | 'organize'

export default function IndexPage() {
  const { themeStyle } = useTheme()
  const [ideas, setIdeas] = useState<Idea[]>(() => loadIdeaState().ideas)
  const [mode, setMode] = useState<Mode>('space')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftDetails, setDraftDetails] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [bucketIndex, setBucketIndex] = useState(0)
  const [dragUi, setDragUi] = useState<{ active: boolean; hover: PriorityKey | null }>({ active: false, hover: null })
  const [toast, setToast] = useState('')

  useEffect(() => subscribeSyncData(setIdeas), [])

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

  const selectedIdea = useMemo(() => ideas.find((idea) => idea.id === selectedId) || null, [ideas, selectedId])
  const todayCount = useMemo(() => ideas.filter((idea) => isToday(idea.createdAt)).length, [ideas])
  const inboxCount = useMemo(() => ideas.filter((idea) => idea.priority === 'inbox').length, [ideas])
  const filteredIdeas = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return keyword ? ideas.filter((idea) => idea.text.toLowerCase().includes(keyword)) : ideas
  }, [ideas, query])

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

  const saveDraft = () => {
    const text = composeIdeaText(draftTitle, draftDetails)
    if (!draftTitle.trim()) return
    const now = Date.now()
    const idea: Idea = {
      id: createId(),
      text,
      createdAt: now,
      updatedAt: now,
      colorSlot: Math.floor(Math.random() * 7) as IdeaColorSlot,
      pinned: false,
      priority: 'inbox'
    }
    commitIdeas([idea, ...ideas])
    setDraftTitle('')
    setDraftDetails('')
    setComposerOpen(false)
    setBucketIndex(0)
    flash('已收进碎片池')
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
            >⌕</Button>
            <Button
              className='icon-btn settings-btn'
              ariaLabel='打开设置'
              onClick={() => Taro.navigateTo({ url: '/pages/settings/index' })}
            >
              <View className='settings-glyph'>
                <View className='settings-line line-top'><View className='settings-knob' /></View>
                <View className='settings-line line-mid'><View className='settings-knob' /></View>
                <View className='settings-line line-bottom'><View className='settings-knob' /></View>
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
            onDragUiChange={(active, hover) => setDragUi({ active, hover })}
          />
          <View className='space-fade' />
          <View className='space-hint'>拖动一个想法 → 放入底部优先级</View>
        </View>

        <View className={`organize-view ${mode === 'organize' ? 'active' : ''}`}>
          <OrganizeView
            ideas={ideas}
            query={query}
            current={bucketIndex}
            onCurrentChange={setBucketIndex}
            onOpenIdea={setSelectedId}
            onAssignPriority={assignPriority}
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
          <Text>⌕</Text>
          <Input
            className='search-input'
            value={query}
            focus={searchOpen}
            placeholder='搜索你的想法…'
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
          onTitleChange={setDraftTitle}
          onDetailsChange={setDraftDetails}
          onSave={saveDraft}
        />
        {selectedIdea && (
          <DetailSheet
            key={selectedIdea.id}
            idea={selectedIdea}
            open
            onClose={() => setSelectedId(null)}
            onPriorityChange={(priority) => selectedId && assignPriority(selectedId, priority)}
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
