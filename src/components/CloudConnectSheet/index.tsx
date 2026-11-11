import { Button, Input, Text, View } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { loginAndSync } from '@/services/sync'
import './index.css'

interface Props {
  open: boolean
  onClose: () => void
  onConnected?: (result: 'synced' | 'conflict') => void
}

export default function CloudConnectSheet({ open, onClose, onConnected }: Props) {
  const [key, setKey] = useState('')
  const [keyVisible, setKeyVisible] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) return
    setKey('')
    setError('')
    setKeyVisible(true)
  }, [open])

  const close = () => {
    if (submitting) return
    onClose()
  }

  const submit = async () => {
    if (!key.trim() || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const result = await loginAndSync(key)
      onConnected?.(result)
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '连接失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className={`cloud-connect-layer ${open ? 'open' : ''}`}>
      <View className={`cloud-connect-scrim ${open ? 'show' : ''}`} onClick={close} />
      <View className={`cloud-connect-sheet ${open ? 'show' : ''}`}>
        <View className='cloud-connect-handle' />
        <Text className='cloud-connect-eyebrow'>CLOUD SPACE</Text>
        <Text className='cloud-connect-title'>连接你的云端空间</Text>
        <Text className='cloud-connect-description'>
          输入仓库密钥即可连接。不同密钥对应独立数据。首页可以随时切换，最多 10 个。
        </Text>

        <View className='cloud-connect-field'>
          <Text className='cloud-connect-label'>仓库密钥</Text>
          <View className={`cloud-connect-input-shell ${error ? 'has-error' : ''}`}>
            <Input
              className='cloud-connect-input'
              ariaLabel='仓库密钥'
              value={key}
              password={!keyVisible}
              focus={open}
              placeholder='请输入仓库密钥'
              confirmType='done'
              maxlength={64}
              onInput={(event) => setKey(event.detail.value)}
              onConfirm={() => void submit()}
            />
            <Button
              className='cloud-connect-toggle'
              ariaLabel={keyVisible ? '隐藏仓库密钥' : '显示仓库密钥'}
              onClick={() => setKeyVisible((visible) => !visible)}
            >{keyVisible ? '隐藏' : '显示'}</Button>
          </View>
          <View className={`cloud-connect-error ${error ? 'show' : ''}`} ariaRole='alert'>
            {error || ' '}
          </View>
        </View>

        <View className='cloud-connect-actions'>
          <Button className='cloud-connect-cancel' disabled={submitting} onClick={close}>稍后再说</Button>
          <Button
            className='cloud-connect-submit'
            disabled={!key.trim() || submitting}
            loading={submitting}
            onClick={() => void submit()}
          >连接并同步</Button>
        </View>
      </View>
    </View>
  )
}
