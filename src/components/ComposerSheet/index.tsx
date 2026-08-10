import { Button, Text, Textarea, View } from '@tarojs/components'
import './index.css'

interface Props {
  open: boolean
  value: string
  onChange: (value: string) => void
  onSave: () => void
}

export default function ComposerSheet({ open, value, onChange, onSave }: Props) {
  return (
    <View className={`sheet composer-sheet ${open ? 'show' : ''}`}>
      <View className='grabber' />
      <Textarea
        className='idea-input'
        value={value}
        focus={open}
        maxlength={-1}
        placeholder={'刚刚想到什么？\n先记下来，整理以后再说。'}
        onInput={(event) => onChange(event.detail.value)}
      />
      <View className='composer-foot'>
        <Text className='composer-note'>默认进入「碎片池」</Text>
        <Button className='save-btn' onClick={onSave}>收进来 ↵</Button>
      </View>
    </View>
  )
}
