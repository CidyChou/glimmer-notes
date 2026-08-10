import { Button, Input, Text, View } from '@tarojs/components'
import { useMemo, useState } from 'react'
import { IDEA_COLORS, PRIORITY_META } from '@/constants/priorities'
import BottomBar from '@/components/BottomBar'
import ComposerSheet from '@/components/ComposerSheet'
import DetailSheet from '@/components/DetailSheet'
import IdeaSpaceCanvas from '@/components/IdeaSpaceCanvas'
import OrganizeView from '@/components/OrganizeView'
import { loadIdeas, saveIdeas } from '@/services/ideaStorage'
import { createId } from '@/utils/id'
import { isToday } from '@/utils/date'
import type { Idea, PriorityKey } from '@/types/idea'
import './index.css'

type Mode = 'space' | 'organize'

export default function IndexPage() {
  const [ideas, setIdeas] = useState<Idea[]>(() => loadIdeas())
  const [mode, setMode] = useState<Mode>('space')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [bucketIndex, setBucketIndex] = useState(0)
  const [dragUi, setDragUi] = useState<{ active: boolean; hover: PriorityKey | null }>({ active: false, hover: null })
  const [toast, setToast] = useState('')

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
  }

  const flash = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(''), 1350)
  }

  const assignPriority = (id: string, priority: PriorityKey) => {
    commitIdeas(ideas.map((idea) => idea.id === id ? { ...idea, priority } : idea))
    flash(`已放入「${PRIORITY_META[priority].name}」`)
  }

  const saveDraft = () => {
    const text = draft.trim()
    if (!text) return
    const idea: Idea = {
      id: createId(),
      text,
      createdAt: Date.now(),
      color: IDEA_COLORS[Math.floor(Math.random() * IDEA_COLORS.length)],
      pinned: false,
      priority: 'inbox'
    }
    commitIdeas([idea, ...ideas])
    setDraft('')
    setComposerOpen(false)
    setBucketIndex(0)
    flash('已收进碎片池')
  }

  const togglePin = () => {
    if (!selectedId) return
    commitIdeas(ideas.map((idea) => idea.id === selectedId ? { ...idea, pinned: !idea.pinned } : idea))
  }

  const deleteSelected = () => {
    if (!selectedId) return
    commitIdeas(ideas.filter((idea) => idea.id !== selectedId))
    setSelectedId(null)
    flash('已删除')
  }

  const hasSheetOpen = composerOpen || !!selectedId

  return (
    <View className='stage'>
      <View className='phone-shell'>
        <View className='ambient ambient-a' />
        <View className='ambient ambient-b' />

        <View className='topbar'>
          <View className='brand'>
            <Text className='eyebrow'>IDEA INBOX</Text>
            <Text className='title'>Idea Space</Text>
          </View>
          <Button className='icon-btn' onClick={() => setSearchOpen((open) => !open)}>⌕</Button>
        </View>

        <View className='modebar'>
          <View className='segmented'>
            <View className={`segment ${mode === 'space' ? 'active' : ''}`} onClick={() => setMode('space')}>空间</View>
            <View className={`segment ${mode === 'organize' ? 'active' : ''}`} onClick={() => setMode('organize')}>整理</View>
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
          />
        </View>

        <BottomBar
          todayCount={todayCount}
          inboxCount={inboxCount}
          dragging={dragUi.active}
          hover={dragUi.hover}
          onAdd={() => setComposerOpen(true)}
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

        <ComposerSheet open={composerOpen} value={draft} onChange={setDraft} onSave={saveDraft} />
        <DetailSheet
          idea={selectedIdea}
          open={!!selectedIdea}
          onClose={() => setSelectedId(null)}
          onPriorityChange={(priority) => selectedId && assignPriority(selectedId, priority)}
          onTogglePin={togglePin}
          onDelete={deleteSelected}
        />

        <View className={`toast ${toast ? 'show' : ''}`}>{toast}</View>
      </View>
    </View>
  )
}
