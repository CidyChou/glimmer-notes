import { Button, Input, ScrollView, Text, Textarea, View } from '@tarojs/components'
import type { CSSProperties } from 'react'
import type { IdeaProject, IdeaTag } from '@/types/idea'
import { useTheme } from '@/theme'
import './index.css'

interface Props {
  open: boolean
  title: string
  details: string
  projects: IdeaProject[]
  tags: IdeaTag[]
  selectedProjectId: string
  selectedTagIds: string[]
  onTitleChange: (value: string) => void
  onDetailsChange: (value: string) => void
  onProjectChange: (projectId: string) => void
  onTagToggle: (tagId: string) => void
  onSave: () => void
}

export default function ComposerSheet({ open, title, details, projects, tags, selectedProjectId, selectedTagIds, onTitleChange, onDetailsChange, onProjectChange, onTagToggle, onSave }: Props) {
  const { theme } = useTheme()
  const hasTitle = !!title.trim()

  return (
    <View className={`sheet composer-sheet ${open ? 'show' : ''}`}>
      <View className='grabber' />

      <View className='composer-head'>
        <View>
          <Text className='composer-title'>新建任务</Text>
          <Text className='composer-subtitle'>标题用于整理，详情可以稍后补充</Text>
        </View>
        <View className='composer-status'>
          <View className='composer-status-dot' />
          <Text>碎片池</Text>
        </View>
      </View>

      <View className='input-shell'>
        <View className='title-field'>
          <Text className='input-label'>标题</Text>
          <Input
            className='title-input'
            value={title}
            focus={open}
            maxlength={80}
            confirmType='next'
            ariaLabel='任务标题'
            placeholder='一句话写下要做的事'
            onInput={(event) => onTitleChange(event.detail.value)}
          />
        </View>

        <View className='field-divider' />

        <View className='details-field'>
          <View className='field-label-row'>
            <Text className='input-label'>详情</Text>
            <Text className='optional-label'>选填</Text>
          </View>
          <Textarea
            className='detail-input'
            value={details}
            autoHeight
            maxlength={-1}
            ariaLabel='任务详情'
            placeholder='补充步骤、背景或任何小细节...'
            onInput={(event) => onDetailsChange(event.detail.value)}
          />
        </View>
        <View className='input-meta'>
          <Text>支持基础 Markdown（列表、粗体、清单）</Text>
          <Text className={`input-count ${details.length ? 'has-value' : ''}`}>{details.length} 字详情</Text>
        </View>
      </View>

      <View className='composer-taxonomy'>
        <View className='composer-taxonomy-group'>
          <View className='composer-taxonomy-heading'>
            <Text className='composer-tags-label'>所属项目</Text>
            <Text className='composer-taxonomy-hint'>单选</Text>
          </View>
          <ScrollView className='composer-tag-scroll' scrollX enhanced showScrollbar={false}>
            <View className='composer-tag-list'>
              {projects.map((project) => (
                <View
                  key={project.id}
                  className={`composer-tag project ${selectedProjectId === project.id ? 'active' : ''}`}
                  style={{ '--tag-color': theme.ideaPalette[project.colorSlot] } as CSSProperties}
                  ariaRole='button'
                  ariaLabel={`选择所属项目${project.name}`}
                  onClick={() => onProjectChange(project.id)}
                >
                  <View className='composer-tag-radio'><View /></View>
                  <Text>{project.name}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        <View className='composer-taxonomy-group'>
          <View className='composer-taxonomy-heading'>
            <Text className='composer-tags-label'>任务标签</Text>
            <Text className='composer-taxonomy-hint'>可多选</Text>
          </View>
          {tags.length ? (
            <ScrollView className='composer-tag-scroll' scrollX enhanced showScrollbar={false}>
              <View className='composer-tag-list'>
                {tags.map((tag) => (
                  <View
                    key={tag.id}
                    className={`composer-tag ${selectedTagIds.includes(tag.id) ? 'active' : ''}`}
                    style={{ '--tag-color': theme.ideaPalette[tag.colorSlot] } as CSSProperties}
                    ariaRole='button'
                    ariaLabel={`${selectedTagIds.includes(tag.id) ? '移除' : '添加'}${tag.name}标签`}
                    onClick={() => onTagToggle(tag.id)}
                  >
                    <View className='composer-tag-dot' />
                    <Text>{tag.name}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            <Text className='composer-tags-empty'>可在设置中新增标签</Text>
          )}
        </View>
      </View>

      <View className='composer-foot'>
        <View className='composer-destination'>
          <View className='destination-orbit'>
            <View className='destination-core' />
          </View>
          <View>
            <Text className='destination-label'>保存至</Text>
            <Text className='destination-name'>碎片池</Text>
          </View>
        </View>
        <Button className='save-btn' disabled={hasTitle ? undefined : true} onClick={onSave}>创建任务</Button>
      </View>
    </View>
  )
}
