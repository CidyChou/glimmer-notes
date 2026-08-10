import { Button, Input, Text, Textarea, View } from '@tarojs/components'
import './index.css'

interface Props {
  open: boolean
  title: string
  details: string
  onTitleChange: (value: string) => void
  onDetailsChange: (value: string) => void
  onSave: () => void
}

export default function ComposerSheet({ open, title, details, onTitleChange, onDetailsChange, onSave }: Props) {
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
            maxlength={-1}
            ariaLabel='任务详情'
            placeholder='补充步骤、背景或任何小细节...'
            onInput={(event) => onDetailsChange(event.detail.value)}
          />
        </View>
        <View className='input-meta'>
          <Text>整理页显示一行详情</Text>
          <Text className={`input-count ${details.length ? 'has-value' : ''}`}>{details.length} 字详情</Text>
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
