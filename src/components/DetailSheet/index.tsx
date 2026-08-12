import { Button, Input, ScrollView, Text, Textarea, View } from '@tarojs/components'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import MarkdownView from '@/components/MarkdownView'
import { PRIORITY_META, PRIORITY_ORDER } from '@/constants/priorities'
import { formatDetailTime } from '@/utils/date'
import { composeIdeaText, splitIdeaText } from '@/utils/ideaText'
import { toggleTaskAtLine } from '@/utils/markdown'
import type { Idea, IdeaProject, IdeaTag, PriorityKey } from '@/types/idea'
import { useTheme } from '@/theme'
import type { IdeaColorSlot } from '@/theme'
import './index.css'

type EditorMode = 'read' | 'edit'
type EditTab = 'source' | 'preview'

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
  onSave: (title: string, details: string) => void
  onPatchDetails: (details: string) => void
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
  onSave,
  onPatchDetails,
  onTogglePin,
  onCopy,
  onArchive,
  onDelete
}: Props) {
  const { theme } = useTheme()
  const live = splitIdeaText(idea.text)
  const [mode, setMode] = useState<EditorMode>('read')
  const [editTab, setEditTab] = useState<EditTab>('source')
  const [title, setTitle] = useState(live.title)
  const [details, setDetails] = useState(live.details)
  const [projectCreateOpen, setProjectCreateOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectColor, setNewProjectColor] = useState<IdeaColorSlot>(2)

  const hasTitle = !!title.trim()
  const hasChanges =
    composeIdeaText(title, details) !== composeIdeaText(live.title, live.details)

  const enterEdit = () => {
    setTitle(live.title)
    setDetails(live.details)
    setEditTab('source')
    setMode('edit')
  }

  const cancelEdit = () => {
    setMode('read')
    setEditTab('source')
  }

  const handleReadToggleTask = (lineIndex: number) => {
    const next = toggleTaskAtLine(live.details, lineIndex)
    if (next !== live.details) onPatchDetails(next)
  }

  const handlePreviewToggleTask = (lineIndex: number) => {
    setDetails((current) => toggleTaskAtLine(current, lineIndex))
  }

  const submitProject = () => {
    const name = newProjectName.trim()
    if (!name) return
    const project = onCreateProject(name, newProjectColor)
    if (!project) return
    setNewProjectName('')
    setProjectCreateOpen(false)
    setNewProjectColor(((project.colorSlot + 1) % theme.ideaPalette.length) as IdeaColorSlot)
  }

  return (
    <View className={`detail-sheet ${open ? 'show' : ''}`}>
      <View className='detail-grabber' />
      <View className='detail-top'>
        <View>
          <Text className='detail-kicker'>{mode === 'read' ? '任务详情' : '编辑任务'}</Text>
          <Text className='detail-time'>{formatDetailTime(idea.createdAt)}</Text>
        </View>
        <Button className='close-btn' ariaLabel='关闭详情面板' onClick={onClose}>×</Button>
      </View>

      {mode === 'read' ? (
        <View className='detail-editor detail-editor-read'>
          <Text className='detail-field-label'>标题</Text>
          <Text className='detail-read-title'>{live.title || '未命名任务'}</Text>
          <View className='detail-field-divider' />
          <View className='detail-label-row'>
            <Text className='detail-field-label'>详情</Text>
          </View>
          {live.details ? (
            <MarkdownView
              className='detail-markdown'
              source={live.details}
              onToggleTask={handleReadToggleTask}
            />
          ) : (
            <Text className='detail-empty-hint'>暂无详情，点编辑补充</Text>
          )}
          <View className='detail-read-actions'>
            <Button className='detail-edit-btn' onClick={enterEdit}>编辑内容</Button>
          </View>
        </View>
      ) : (
        <>
          <View className='detail-edit-tabs' ariaRole='tablist'>
            <View
              className={`detail-edit-tab ${editTab === 'source' ? 'active' : ''}`}
              ariaRole='tab'
              ariaLabel='源码'
              onClick={() => setEditTab('source')}
            >
              <Text>源码</Text>
            </View>
            <View
              className={`detail-edit-tab ${editTab === 'preview' ? 'active' : ''}`}
              ariaRole='tab'
              ariaLabel='预览'
              onClick={() => setEditTab('preview')}
            >
              <Text>预览</Text>
            </View>
          </View>

          <View className={`detail-editor ${editTab === 'preview' ? 'detail-editor-preview' : ''}`}>
            <Text className='detail-field-label'>标题</Text>
            {editTab === 'source' ? (
              <Input
                className='detail-title-input'
                value={title}
                maxlength={80}
                ariaLabel='任务标题'
                placeholder='输入任务标题'
                onInput={(event) => setTitle(event.detail.value)}
              />
            ) : (
              <Text className='detail-read-title'>{title.trim() || '未命名任务'}</Text>
            )}
            <View className='detail-field-divider' />
            <View className='detail-label-row'>
              <Text className='detail-field-label'>详情</Text>
              {editTab === 'source' ? <Text className='detail-optional'>选填 · Markdown</Text> : null}
            </View>
            {editTab === 'source' ? (
              <Textarea
                className='detail-body-input'
                value={details}
                autoHeight
                maxlength={-1}
                ariaLabel='任务详情'
                placeholder='补充步骤、背景或任何小细节...'
                onInput={(event) => setDetails(event.detail.value)}
              />
            ) : details.trim() ? (
              <MarkdownView
                className='detail-markdown'
                source={details}
                onToggleTask={handlePreviewToggleTask}
              />
            ) : (
              <Text className='detail-empty-hint'>暂无详情可预览</Text>
            )}
          </View>

          <View className='detail-save-row'>
            <Text className={`detail-save-status ${hasChanges ? 'unsaved' : ''}`}>
              {hasChanges ? '有未保存的修改' : '内容已同步'}
            </Text>
            <View className='detail-save-actions'>
              <Button className='detail-cancel-btn' onClick={cancelEdit}>取消</Button>
              <Button
                className='detail-save-btn'
                disabled={!hasTitle || !hasChanges ? true : undefined}
                onClick={() => onSave(title, details)}
              >
                保存修改
              </Button>
            </View>
          </View>
        </>
      )}

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
