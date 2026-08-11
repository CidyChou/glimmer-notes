import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Input, Text, View } from '@tarojs/components'
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  getSyncStatus,
  loginAndSync,
  logoutSync,
  retrySync,
  subscribeSyncData,
  subscribeSyncStatus
} from '@/services/sync'
import { loadIdeaState, loadProjects, loadTags, recordIdeaDeletion, saveIdeas, saveProjects, saveTags } from '@/services/ideaStorage'
import { reconcileIdeaHistory } from '@/services/ideaHistory'
import { scheduleSync } from '@/services/sync'
import { createId } from '@/utils/id'
import { THEME_OPTIONS, useTheme } from '@/theme'
import type { IdeaColorSlot, ThemeDefinition } from '@/theme'
import type { IdeaProject, IdeaTag } from '@/types/idea'
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
  const { themeId, theme, themeStyle, setTheme } = useTheme()
  const [notice, setNotice] = useState('')
  const [syncStatus, setSyncStatus] = useState(getSyncStatus)
  const [loginOpen, setLoginOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [projects, setProjects] = useState<IdeaProject[]>(loadProjects)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectColor, setNewProjectColor] = useState<IdeaColorSlot>(1)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingProjectName, setEditingProjectName] = useState('')
  const [editingProjectColor, setEditingProjectColor] = useState<IdeaColorSlot>(0)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
  const [tags, setTags] = useState<IdeaTag[]>(loadTags)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState<IdeaColorSlot>(0)
  const [archivedCount, setArchivedCount] = useState(() => loadIdeaState().ideas.filter((idea) => idea.archivedAt !== null).length)

  useDidShow(() => {
    setProjects(loadProjects())
    setTags(loadTags())
    setArchivedCount(loadIdeaState().ideas.filter((idea) => idea.archivedAt !== null).length)
  })

  useEffect(() => subscribeSyncStatus(setSyncStatus), [])

  useEffect(() => subscribeSyncData((nextIdeas, nextTags, nextProjects) => {
    setTags(nextTags)
    setProjects(nextProjects)
    setArchivedCount(nextIdeas.filter((idea) => idea.archivedAt !== null).length)
  }), [])

  const syncTitle = useMemo(() => ({
    'signed-out': '仅本地保存',
    syncing: '正在同步',
    synced: '已连接云端',
    offline: '离线使用中',
    error: '同步遇到问题'
  })[syncStatus.phase], [syncStatus.phase])

  const goBack = () => {
    // H5 在直接打开设置页或热更新后可能没有可靠的页面栈，
    // 直接重启到主界面可以避免 navigateBack 把当前页再次压回来的情况。
    Taro.reLaunch({ url: '/pages/index/index' })
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

  const addTag = () => {
    const name = newTagName.trim()
    if (!name) return
    if (tags.some((tag) => tag.name.toLowerCase() === name.toLowerCase())) {
      setNotice('已经有同名标签了')
      setTimeout(() => setNotice(''), 1500)
      return
    }
    const now = Date.now()
    const tag: IdeaTag = {
      id: createId(),
      name: name.slice(0, 12),
      colorSlot: newTagColor,
      createdAt: now,
      updatedAt: now
    }
    const next = [...tags, tag]
    setTags(next)
    saveTags(next)
    scheduleSync()
    Taro.eventCenter.trigger('idea-taxonomy-updated')
    setNewTagName('')
    setNewTagColor(((newTagColor + 1) % 7) as IdeaColorSlot)
    setNotice(`已添加「${tag.name}」`)
    setTimeout(() => setNotice(''), 1500)
  }

  const addProject = () => {
    const name = newProjectName.trim()
    if (!name) return
    if (projects.some((project) => project.name.toLowerCase() === name.toLowerCase())) {
      setNotice('已经有同名项目了')
      setTimeout(() => setNotice(''), 1500)
      return
    }
    const now = Date.now()
    const project: IdeaProject = {
      id: createId(),
      name: name.slice(0, 16),
      colorSlot: newProjectColor,
      createdAt: now,
      updatedAt: now,
      isDefault: false
    }
    const next = [...projects, project]
    setProjects(next)
    saveProjects(next)
    scheduleSync()
    Taro.eventCenter.trigger('idea-taxonomy-updated')
    setNewProjectName('')
    setNewProjectColor(((newProjectColor + 1) % 7) as IdeaColorSlot)
    setNotice(`已添加项目「${project.name}」`)
    setTimeout(() => setNotice(''), 1500)
  }

  const startProjectEdit = (project: IdeaProject) => {
    if (project.isDefault) return
    setDeletingProjectId(null)
    setEditingProjectId(project.id)
    setEditingProjectName(project.name)
    setEditingProjectColor(project.colorSlot)
  }

  const cancelProjectEdit = () => {
    setEditingProjectId(null)
    setEditingProjectName('')
  }

  const saveProjectEdit = () => {
    if (!editingProjectId) return
    const project = projects.find((item) => item.id === editingProjectId)
    const name = editingProjectName.trim()
    if (!project || project.isDefault || !name) return
    if (projects.some((item) => item.id !== project.id && item.name.toLowerCase() === name.toLowerCase())) {
      setNotice('已经有同名项目了')
      setTimeout(() => setNotice(''), 1500)
      return
    }

    const now = Date.now()
    const nextProjects = projects.map((item) => item.id === project.id
      ? { ...item, name: name.slice(0, 16), colorSlot: editingProjectColor, updatedAt: now }
      : item)
    const currentIdeas = loadIdeaState().ideas
    const nextIdeas = currentIdeas.map((idea) => idea.projectId === project.id
      ? { ...idea, colorSlot: editingProjectColor, updatedAt: editingProjectColor !== project.colorSlot ? now : idea.updatedAt }
      : idea)

    setProjects(nextProjects)
    saveProjects(nextProjects)
    if (editingProjectColor !== project.colorSlot) saveIdeas(nextIdeas)
    reconcileIdeaHistory(nextIdeas, nextProjects, loadTags())
    scheduleSync()
    Taro.eventCenter.trigger('idea-taxonomy-updated')
    cancelProjectEdit()
    setNotice(`已更新项目「${name.slice(0, 16)}」`)
    setTimeout(() => setNotice(''), 1500)
  }

  const requestProjectDelete = (project: IdeaProject) => {
    if (project.isDefault) return
    setEditingProjectId(null)
    setDeletingProjectId(project.id)
  }

  const cancelProjectDelete = () => setDeletingProjectId(null)

  const deleteProject = () => {
    if (!deletingProjectId) return
    const project = projects.find((item) => item.id === deletingProjectId)
    const defaultProject = projects.find((item) => item.isDefault)
    if (!project || project.isDefault || !defaultProject) return

    const now = Date.now()
    const nextProjects = projects.filter((item) => item.id !== project.id)
    const currentIdeas = loadIdeaState().ideas
    const nextIdeas = currentIdeas.map((idea) => idea.projectId === project.id
      ? { ...idea, projectId: defaultProject.id, colorSlot: defaultProject.colorSlot, updatedAt: now }
      : idea)

    setProjects(nextProjects)
    saveProjects(nextProjects)
    saveIdeas(nextIdeas)
    reconcileIdeaHistory(nextIdeas, nextProjects, loadTags())
    recordIdeaDeletion(project.id, now)
    scheduleSync()
    Taro.eventCenter.trigger('idea-taxonomy-updated')
    setDeletingProjectId(null)
    setNotice(`已删除项目「${project.name}」，关联任务已移到默认项目`)
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
            <View className='section-heading'>
              <Text className='section-title'>项目</Text>
              <Text className='section-copy'>每个任务只能属于一个项目，任务主色跟随项目；自定义项目可编辑或删除</Text>
            </View>
            <View className='tag-manager project-manager'>
              <View className='project-list'>
                {projects.map((project) => (
                  <View key={project.id} className='managed-project-item'>
                    <View
                      className='managed-tag managed-project-tag'
                      style={{ '--tag-color': theme.ideaPalette[project.colorSlot] } as CSSProperties}
                    >
                      <View className='managed-project-radio'><View /></View>
                      <Text className='managed-tag-name'>{project.name}</Text>
                      {project.isDefault && <Text className='managed-tag-default'>默认选项</Text>}
                      {!project.isDefault && (
                        <View className='managed-tag-actions'>
                          <View
                            className='managed-tag-action'
                            ariaRole='button'
                            ariaLabel={`编辑项目 ${project.name}`}
                            onClick={() => startProjectEdit(project)}
                          >编辑</View>
                          <View
                            className='managed-tag-action danger'
                            ariaRole='button'
                            ariaLabel={`删除项目 ${project.name}`}
                            onClick={() => requestProjectDelete(project)}
                          >删除</View>
                        </View>
                      )}
                    </View>

                    {editingProjectId === project.id && (
                      <View className='project-edit-panel'>
                        <View className='project-edit-row'>
                          <Input
                            className='project-edit-input'
                            value={editingProjectName}
                            maxlength={16}
                            ariaLabel='编辑项目名称'
                            onInput={(event) => setEditingProjectName(event.detail.value)}
                            onConfirm={saveProjectEdit}
                          />
                          <Button className='project-edit-save' onClick={saveProjectEdit}>保存</Button>
                          <View className='project-edit-cancel' ariaRole='button' onClick={cancelProjectEdit}>取消</View>
                        </View>
                        <View className='tag-color-list project-edit-colors'>
                          {theme.ideaPalette.map((_, index) => (
                            <View
                              key={index}
                              className={`tag-color ${editingProjectColor === index ? 'active' : ''}`}
                              style={{ '--tag-color': theme.ideaPalette[index] } as CSSProperties}
                              ariaRole='button'
                              ariaLabel={`选择项目颜色 ${index + 1}`}
                              onClick={() => setEditingProjectColor(index as IdeaColorSlot)}
                            />
                          ))}
                        </View>
                      </View>
                    )}

                    {deletingProjectId === project.id && (
                      <View className='project-delete-panel'>
                        <Text className='project-delete-copy'>删除后，关联任务会移到默认项目</Text>
                        <View className='project-delete-actions'>
                          <View className='project-edit-cancel' ariaRole='button' onClick={cancelProjectDelete}>取消</View>
                          <Button className='project-delete-confirm' onClick={deleteProject}>确认删除</Button>
                        </View>
                      </View>
                    )}
                  </View>
                ))}
              </View>

              <View className='tag-create'>
                <Text className='tag-create-label'>新增项目</Text>
                <View className='tag-create-row'>
                  <Input
                    className='tag-name-input'
                    value={newProjectName}
                    maxlength={16}
                    ariaLabel='项目名称'
                    placeholder='例如：拾光笔记、游戏官网'
                    placeholderClass='tag-input-placeholder'
                    confirmType='done'
                    onInput={(event) => setNewProjectName(event.detail.value)}
                    onConfirm={addProject}
                  />
                  <Button
                    className='tag-add-button'
                    disabled={newProjectName.trim() ? undefined : true}
                    onClick={addProject}
                  >新增</Button>
                </View>
                <View className='tag-color-list'>
                  {theme.ideaPalette.map((_, index) => (
                    <View
                      key={index}
                      className={`tag-color ${newProjectColor === index ? 'active' : ''}`}
                      style={{ '--tag-color': theme.ideaPalette[index] } as CSSProperties}
                      ariaRole='button'
                      ariaLabel={`选择项目颜色 ${index + 1}`}
                      onClick={() => setNewProjectColor(index as IdeaColorSlot)}
                    />
                  ))}
                </View>
              </View>
            </View>
          </View>

          <View className='settings-section'>
            <View className='section-heading'>
              <Text className='section-title'>标签</Text>
              <Text className='section-copy'>一个任务可以添加多个标签，并可通过标签名搜索</Text>
            </View>
            <View className='tag-manager'>
              <View className='tag-list'>
                {tags.map((tag) => (
                  <View
                    key={tag.id}
                    className='managed-tag'
                    style={{ '--tag-color': theme.ideaPalette[tag.colorSlot] } as CSSProperties}
                  >
                    <View className='managed-tag-dot' />
                    <Text className='managed-tag-name'>{tag.name}</Text>
                  </View>
                ))}
              </View>

              <View className='tag-create'>
                <Text className='tag-create-label'>新增自定义标签</Text>
                <View className='tag-create-row'>
                  <Input
                    className='tag-name-input'
                    value={newTagName}
                    maxlength={12}
                    ariaLabel='自定义标签名称'
                    placeholder='例如：工作、产品、生活'
                    placeholderClass='tag-input-placeholder'
                    confirmType='done'
                    onInput={(event) => setNewTagName(event.detail.value)}
                    onConfirm={addTag}
                  />
                  <Button
                    className='tag-add-button'
                    disabled={newTagName.trim() ? undefined : true}
                    onClick={addTag}
                  >新增</Button>
                </View>
                <View className='tag-color-list'>
                  {theme.ideaPalette.map((_, index) => (
                    <View
                      key={index}
                      className={`tag-color ${newTagColor === index ? 'active' : ''}`}
                      style={{ '--tag-color': theme.ideaPalette[index] } as CSSProperties}
                      ariaRole='button'
                      ariaLabel={`选择标签颜色 ${index + 1}`}
                      onClick={() => setNewTagColor(index as IdeaColorSlot)}
                    />
                  ))}
                </View>
              </View>
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
            <View
              className='archive-entry'
              ariaRole='button'
              ariaLabel={`查看已归档任务，共 ${archivedCount} 条`}
              onClick={() => Taro.navigateTo({ url: '/pages/archive/index' })}
            >
              <View className='archive-entry-icon'><View className='archive-entry-box' /></View>
              <View className='archive-entry-copy'>
                <Text className='archive-entry-title'>已归档任务</Text>
                <Text className='archive-entry-description'>查看、复制或恢复已经收纳的任务</Text>
              </View>
              <Text className='archive-entry-count'>{archivedCount}</Text>
              <View className='archive-entry-arrow' />
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
