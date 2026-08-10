import Taro from '@tarojs/taro'
import { Button, Input, Text, View } from '@tarojs/components'
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  getSyncStatus,
  loginAndSync,
  logoutSync,
  retrySync,
  subscribeSyncStatus
} from '@/services/sync'
import { THEME_OPTIONS, useTheme } from '@/theme'
import type { ThemeDefinition } from '@/theme'
import './index.css'

function previewStyle(option: ThemeDefinition): CSSProperties {
  return {
    '--preview-page': option.colors.page,
    '--preview-surface': option.colors.surface,
    '--preview-surface-high': option.colors.surfaceHigh,
    '--preview-text': option.colors.textPrimary,
    '--preview-muted': option.colors.textMuted,
    '--preview-accent': option.colors.accent,
    '--preview-border-rgb': option.colors.borderRgb,
    '--preview-ambient-a': option.colors.ambientA,
    '--preview-ambient-b': option.colors.ambientB
  } as CSSProperties
}

export default function SettingsPage() {
  const { themeId, themeStyle, setTheme } = useTheme()
  const [notice, setNotice] = useState('')
  const [syncStatus, setSyncStatus] = useState(getSyncStatus)
  const [loginOpen, setLoginOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  useEffect(() => subscribeSyncStatus(setSyncStatus), [])

  const syncTitle = useMemo(() => ({
    'signed-out': '仅本地保存',
    syncing: '正在同步',
    synced: '已连接云端',
    offline: '离线使用中',
    error: '同步遇到问题'
  })[syncStatus.phase], [syncStatus.phase])

  const goBack = () => {
    Taro.navigateBack({
      delta: 1,
      fail: () => Taro.reLaunch({ url: '/pages/index/index' })
    })
  }

  const chooseTheme = (option: ThemeDefinition) => {
    if (option.id === themeId) return
    setTheme(option.id)
    setNotice(`已切换到${option.name}`)
    setTimeout(() => setNotice(''), 1400)
  }

  const openLogin = () => {
    setLoginError('')
    setPassword('')
    setLoginOpen(true)
  }

  const closeLogin = () => {
    if (loggingIn) return
    setLoginOpen(false)
    setLoginError('')
  }

  const submitLogin = async () => {
    if (!password || loggingIn) return
    setLoggingIn(true)
    setLoginError('')
    try {
      await loginAndSync(password)
      setLoginOpen(false)
      setPassword('')
      setNotice('云端同步已开启')
      setTimeout(() => setNotice(''), 1600)
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : '登录失败，请重试')
    } finally {
      setLoggingIn(false)
    }
  }

  const handleRetry = async () => {
    try {
      await retrySync()
    } catch {
      setNotice('仍无法连接云端')
      setTimeout(() => setNotice(''), 1600)
    }
  }

  const handleLogout = () => {
    logoutSync()
    setNotice('已退出云端同步，本地数据保留')
    setTimeout(() => setNotice(''), 1800)
  }

  return (
    <View className='settings-stage theme-root' style={themeStyle}>
      <View className='settings-shell'>
        <View className='settings-ambient settings-ambient-a' />
        <View className='settings-ambient settings-ambient-b' />

        <View className='settings-topbar'>
          <View
            className='settings-back'
            ariaRole='button'
            ariaLabel='返回 Idea Space'
            onClick={goBack}
          >
            <View className='back-glyph' />
          </View>
          <View className='settings-heading'>
            <Text className='settings-eyebrow'>IDEA SPACE</Text>
            <Text className='settings-title'>设置</Text>
          </View>
          <View className='settings-topbar-spacer' />
        </View>

        <View className='settings-scroll'>
          <View className='settings-section'>
            <View className='section-heading'>
              <Text className='section-title'>外观</Text>
              <Text className='section-copy'>选择你想进入的灵感空间</Text>
            </View>

            <View className='theme-list'>
              {THEME_OPTIONS.map((option, index) => {
                const active = option.id === themeId
                const wide = index === THEME_OPTIONS.length - 1 && THEME_OPTIONS.length % 2 === 1
                return (
                  <View
                    key={option.id}
                    className={`theme-card ${active ? 'active' : ''} ${wide ? 'wide' : ''}`}
                    style={previewStyle(option)}
                    ariaRole='button'
                    ariaLabel={`${option.name}皮肤${active ? '，使用中' : ''}`}
                    onClick={() => chooseTheme(option)}
                  >
                    <View className='theme-preview'>
                      <View className='preview-ambient preview-ambient-a' />
                      <View className='preview-ambient preview-ambient-b' />
                      <View className='preview-topline' />
                      <View className='preview-orb preview-orb-a' />
                      <View className='preview-orb preview-orb-b' />
                      <View className='preview-orb preview-orb-c' />
                      <View className='preview-dock'>
                        <View className='preview-nav' />
                        <View className='preview-add' />
                        <View className='preview-nav' />
                      </View>
                    </View>

                    <View className='theme-card-body'>
                      <View>
                        <Text className='theme-name'>{option.name}</Text>
                        <Text className='theme-description'>{option.description}</Text>
                      </View>
                      <View className={`theme-state ${active ? 'active' : ''}`}>
                        {active && <View className='check-glyph' />}
                        <Text>{active ? '使用中' : '选择'}</Text>
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          </View>

          <View className='settings-section'>
            <View className='section-heading compact'>
              <Text className='section-title'>数据与隐私</Text>
            </View>
            <View className={`info-card sync-card sync-${syncStatus.phase}`}>
              <View className='info-icon sync-icon'>
                <View className='sync-cloud' />
                <View className='sync-core' />
              </View>
              <View className='info-copy'>
                <View className='sync-title-row'>
                  <Text className='info-title'>{syncTitle}</Text>
                  <Text className='sync-state-label'>{syncStatus.phase === 'synced' ? '已同步' : '本地安全'}</Text>
                </View>
                <Text className='info-description'>{syncStatus.detail}</Text>
                <View className='sync-actions'>
                  {!syncStatus.authenticated ? (
                    <Button className='sync-action primary' onClick={openLogin}>连接云端</Button>
                  ) : (
                    <>
                      <Button
                        className='sync-action primary'
                        disabled={syncStatus.phase === 'syncing'}
                        loading={syncStatus.phase === 'syncing'}
                        onClick={() => void handleRetry()}
                      >立即同步</Button>
                      <Button className='sync-action secondary' onClick={handleLogout}>退出同步</Button>
                    </>
                  )}
                </View>
              </View>
            </View>
          </View>

          <View className='settings-section about-section'>
            <View className='section-heading compact'>
              <Text className='section-title'>关于</Text>
            </View>
            <View className='about-card'>
              <View className='about-mark'><View className='about-core' /></View>
              <View>
                <Text className='about-title'>Idea Space</Text>
                <Text className='about-copy'>先捕捉，稍后整理。</Text>
              </View>
            </View>
          </View>
        </View>

        <View className={`login-scrim ${loginOpen ? 'show' : ''}`} onClick={closeLogin} />
        <View className={`login-sheet ${loginOpen ? 'show' : ''}`}>
          <View className='login-handle' />
          <Text className='login-eyebrow'>PRIVATE SYNC</Text>
          <Text className='login-title'>连接你的云端空间</Text>
          <Text className='login-description'>输入首次部署时生成的访问口令。本地记录不会因为登录失败而丢失。</Text>

          <View className='login-field'>
            <Text className='login-label'>访问口令</Text>
            <View className={`login-input-shell ${loginError ? 'has-error' : ''}`}>
              <Input
                className='login-input'
                ariaLabel='访问口令'
                value={password}
                password={!passwordVisible}
                focus={loginOpen}
                placeholder='输入访问口令'
                confirmType='done'
                onInput={(event) => setPassword(event.detail.value)}
                onConfirm={() => void submitLogin()}
              />
              <Button
                className='password-toggle'
                ariaLabel={passwordVisible ? '隐藏访问口令' : '显示访问口令'}
                onClick={() => setPasswordVisible((visible) => !visible)}
              >{passwordVisible ? '隐藏' : '显示'}</Button>
            </View>
            <View className={`login-error ${loginError ? 'show' : ''}`} ariaRole='alert'>
              {loginError || ' '}
            </View>
          </View>

          <View className='login-actions'>
            <Button className='login-cancel' disabled={loggingIn} onClick={closeLogin}>稍后再说</Button>
            <Button
              className='login-submit'
              disabled={!password || loggingIn}
              loading={loggingIn}
              onClick={() => void submitLogin()}
            >连接并同步</Button>
          </View>
        </View>

        <View className={`settings-toast ${notice ? 'show' : ''}`}>{notice}</View>
      </View>
    </View>
  )
}
