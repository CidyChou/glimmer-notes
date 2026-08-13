import Taro from '@tarojs/taro'
import { isDemoSeedId, isDemoSeedText, isDemoOnlyIdeaSet } from '@/constants/demoSeeds'
import { DEFAULT_PROJECT, loadIdeaState, saveIdeaState } from '@/services/ideaStorage'
import { reconcileIdeaHistory } from '@/services/ideaHistory'
import { mergeSyncStates } from '@/services/syncMerge'
import { DEFAULT_PROJECT_ID, LEGACY_PROJECT_TAG_ID } from '@/types/idea'
import type { Idea, IdeaProject, IdeaTag, IdeaTombstone } from '@/types/idea'

const TOKEN_STORAGE_KEY = 'idea-space-sync-token-v1'
const AUTO_SYNC_STORAGE_KEY = 'idea-space-auto-sync-v1'
const SYNC_INITIALIZED_STORAGE_KEY = 'idea-space-sync-initialized-v1'
const API_BASE_URL = __API_BASE_URL__.replace(/\/$/, '')
const SYNC_DELAY_MS = 350

export type SyncPhase = 'signed-out' | 'conflict' | 'syncing' | 'synced' | 'offline' | 'error'

export type InitialSyncChoice = 'replace-local' | 'merge'

export interface SyncConflict {
  localIdeaCount: number
  remoteIdeaCount: number
}

export interface SyncStatus {
  phase: SyncPhase
  authenticated: boolean
  autoSyncEnabled: boolean
  conflict: SyncConflict | null
  detail: string
  lastSyncedAt: number | null
}

interface SyncResponse {
  schemaVersion: number
  ideas: Idea[]
  projects?: IdeaProject[]
  tags?: IdeaTag[]
  tombstones: IdeaTombstone[]
  serverTime: number
}

class ApiError extends Error {
  statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.statusCode = statusCode
  }
}

type StatusListener = (status: SyncStatus) => void
type DataListener = (ideas: Idea[], tags: IdeaTag[], projects: IdeaProject[]) => void

function loadToken(): string {
  try {
    const value = Taro.getStorageSync(TOKEN_STORAGE_KEY) as unknown
    return typeof value === 'string' ? value : ''
  } catch {
    return ''
  }
}

function loadAutoSyncEnabled(): boolean {
  try {
    return Taro.getStorageSync(AUTO_SYNC_STORAGE_KEY) !== false
  } catch {
    return true
  }
}

function loadSyncInitialized(existingToken: string): boolean {
  if (!existingToken) return false
  try {
    return Taro.getStorageSync(SYNC_INITIALIZED_STORAGE_KEY) !== false
  } catch {
    return true
  }
}

let token = loadToken()
let autoSyncEnabled = loadAutoSyncEnabled()
let syncInitialized = loadSyncInitialized(token)
let status: SyncStatus = {
  phase: token ? 'offline' : 'signed-out',
  authenticated: Boolean(token),
  autoSyncEnabled,
  conflict: null,
  detail: token
    ? autoSyncEnabled ? '等待连接云端' : '自动同步已关闭，可手动同步'
    : '登录后可在设备间同步',
  lastSyncedAt: null
}
const statusListeners = new Set<StatusListener>()
const dataListeners = new Set<DataListener>()
let syncTimer: ReturnType<typeof setTimeout> | null = null
let syncPromise: Promise<void> | null = null
let initializePromise: Promise<void> | null = null
let rerunRequested = false
let pendingRemoteState: SyncResponse | null = null

function updateStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next }
  statusListeners.forEach((listener) => listener(status))
}

function storeToken(next: string, initialized = syncInitialized) {
  token = next
  syncInitialized = next ? initialized : false
  try {
    if (next) {
      Taro.setStorageSync(TOKEN_STORAGE_KEY, next)
      Taro.setStorageSync(SYNC_INITIALIZED_STORAGE_KEY, syncInitialized)
    } else {
      Taro.removeStorageSync(TOKEN_STORAGE_KEY)
      Taro.removeStorageSync(SYNC_INITIALIZED_STORAGE_KEY)
    }
  } catch (error) {
    console.warn('[IdeaSpace] save sync session failed', error)
  }
}

function markSyncInitialized() {
  syncInitialized = true
  try {
    Taro.setStorageSync(SYNC_INITIALIZED_STORAGE_KEY, true)
  } catch (error) {
    console.warn('[IdeaSpace] save sync initialization failed', error)
  }
}

function stripDemoDefaults(state: ReturnType<typeof loadIdeaState>) {
  const demoIds = new Set(
    state.ideas
      .filter((idea) => isDemoSeedId(idea.id) || isDemoSeedText(idea.text))
      .map((idea) => idea.id)
  )
  const ideas = state.ideas.filter((idea) => !demoIds.has(idea.id))
  const tombstones = state.tombstones.filter((item) => !demoIds.has(item.id) && !isDemoSeedId(item.id))
  return {
    ideas,
    // Projects and tags are user-authored data even before a task references them.
    projects: state.projects,
    tags: state.tags,
    tombstones
  }
}

function remoteHasContent(remote: SyncResponse): boolean {
  return remote.ideas.length > 0 || remote.tombstones.length > 0 ||
    Boolean(remote.tags?.length) || Boolean(remote.projects?.some((project) => !project.isDefault))
}

function localHasRealContent(local: ReturnType<typeof loadIdeaState>): boolean {
  return stripDemoDefaults(local).ideas.length > 0 ||
    stripDemoDefaults(local).tombstones.length > 0 ||
    local.tags.length > 0 || local.projects.some((project) => !project.isDefault)
}

function remoteToSyncState(remote: SyncResponse) {
  return {
    ideas: remote.ideas,
    projects: remote.projects?.length ? remote.projects : [DEFAULT_PROJECT],
    tags: remote.tags || [],
    tombstones: remote.tombstones
  }
}

async function request<T>(path: string, method: 'GET' | 'POST', data?: unknown): Promise<T> {
  const response = await Taro.request<T & { error?: string; message?: string }>({
    url: `${API_BASE_URL}${path}`,
    method,
    data,
    timeout: 10_000,
    header: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  })
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new ApiError(response.statusCode, response.data?.message || response.data?.error || 'request_failed')
  }
  return response.data
}

function applyServerState(remote: SyncResponse, replaceLocal = false) {
  const current = loadIdeaState()
  const remoteTags = (remote.tags?.length ? remote.tags : current.tags).filter((tag) => tag.id !== LEGACY_PROJECT_TAG_ID)
  const receivedProjects = remote.projects?.length ? remote.projects : current.projects
  const defaultProject = current.projects.find((project) => project.id === DEFAULT_PROJECT_ID)
  const remoteProjects = receivedProjects.some((project) => project.id === DEFAULT_PROJECT_ID) || !defaultProject
    ? receivedProjects
    : [defaultProject, ...receivedProjects]
  const remoteIdeas = remote.ideas.map((idea) => {
    const legacyTagId = (idea as Idea & { tagId?: string }).tagId
    const project = remoteProjects.find((item) => item.id === idea.projectId) || remoteProjects.find((item) => item.id === DEFAULT_PROJECT_ID)
    return {
      ...idea,
      projectId: project?.id || DEFAULT_PROJECT_ID,
      tagIds: Array.isArray(idea.tagIds)
        ? idea.tagIds.filter((id) => remoteTags.some((tag) => tag.id === id))
        : legacyTagId && legacyTagId !== LEGACY_PROJECT_TAG_ID ? [legacyTagId] : [],
      colorSlot: project?.colorSlot ?? idea.colorSlot,
      archivedAt: typeof idea.archivedAt === 'number' ? idea.archivedAt : null
    }
  })
  if (replaceLocal) {
    saveIdeaState(remoteIdeas, remote.tombstones, remoteTags, remoteProjects)
    reconcileIdeaHistory(remoteIdeas, remoteProjects, remoteTags, { replaceLocal: true })
    dataListeners.forEach((listener) => listener(remoteIdeas, remoteTags, remoteProjects))
    return
  }
  const merged = mergeSyncStates(
    { ideas: current.ideas, projects: current.projects, tags: current.tags, tombstones: current.tombstones },
    { ideas: remoteIdeas, projects: remoteProjects, tags: remoteTags, tombstones: remote.tombstones }
  )
  saveIdeaState(merged.ideas, merged.tombstones, merged.tags, merged.projects)
  reconcileIdeaHistory(merged.ideas, merged.projects, merged.tags)
  dataListeners.forEach((listener) => listener(merged.ideas, merged.tags, merged.projects))
}

async function performSync(initial: boolean) {
  const local = loadIdeaState()
  let remote: SyncResponse

  // Fresh device / cleared storage still shows demo seeds in memory. Never id-merge those
  // into a cloud account that already has real data — that was the main source of duplicates.
  const localIsEphemeralDemo = (
    (!local.hasPersistedIdeas || isDemoOnlyIdeaSet(local.ideas))
    && !localHasRealContent(local)
  )

  if (initial && localIsEphemeralDemo) {
    remote = await request<SyncResponse>('/api/sync', 'GET')
    if (remote.ideas.length === 0 && remote.tombstones.length === 0) {
      // Brand-new cloud: seed once with stable demo IDs.
      remote = await request<SyncResponse>('/api/sync', 'POST', {
        ideas: local.ideas,
        projects: local.projects,
        tags: local.tags,
        tombstones: local.tombstones
      })
    }
    applyServerState(remote, true)
  } else if (localIsEphemeralDemo) {
    // Non-initial path but still only demo seeds: prefer GET/replace over merge.
    remote = await request<SyncResponse>('/api/sync', 'GET')
    if (remote.ideas.length === 0 && remote.tombstones.length === 0) {
      remote = await request<SyncResponse>('/api/sync', 'POST', {
        ideas: local.ideas,
        projects: local.projects,
        tags: local.tags,
        tombstones: local.tombstones
      })
    }
    applyServerState(remote, true)
  } else {
    const upload = isDemoOnlyIdeaSet(local.ideas) ? stripDemoDefaults(local) : local
    remote = await request<SyncResponse>('/api/sync', 'POST', {
      ideas: upload.ideas,
      projects: upload.projects,
      tags: upload.tags,
      tombstones: upload.tombstones
    })
    applyServerState(remote)
  }
  updateStatus({
    phase: 'synced',
    authenticated: true,
    detail: '本地与云端已同步',
    lastSyncedAt: Date.now()
  })
}

async function inspectInitialSync(): Promise<void> {
  const local = loadIdeaState()
  const remote = await request<SyncResponse>('/api/sync', 'GET')
  pendingRemoteState = remote

  const localIsOnlyDemo = !localHasRealContent(local)
  if (localIsOnlyDemo && remoteHasContent(remote)) {
    applyServerState(remote, true)
  } else if (localHasRealContent(local) && remoteHasContent(remote)) {
    updateStatus({
      phase: 'conflict',
      authenticated: true,
      conflict: {
        localIdeaCount: stripDemoDefaults(local).ideas.length,
        remoteIdeaCount: remote.ideas.length
      },
      detail: '本地与云端都有内容，请选择同步方式'
    })
    return
  } else if (!remoteHasContent(remote)) {
    const upload = localIsOnlyDemo ? stripDemoDefaults(local) : local
    const synced = await request<SyncResponse>('/api/sync', 'POST', upload)
    applyServerState(synced, true)
  } else {
    applyServerState(remote, true)
  }

  pendingRemoteState = null
  markSyncInitialized()
  updateStatus({
    phase: 'synced',
    authenticated: true,
    conflict: null,
    detail: '本地与云端已同步',
    lastSyncedAt: Date.now()
  })
}

async function runSync(initial = false): Promise<void> {
  if (!token) {
    updateStatus({ phase: 'signed-out', authenticated: false, detail: '登录后可在设备间同步' })
    return
  }
  if (syncPromise) {
    rerunRequested = true
    return syncPromise
  }

  syncPromise = (async () => {
    let isInitial = initial
    do {
      rerunRequested = false
      updateStatus({ phase: 'syncing', authenticated: true, detail: '正在同步…' })
      await performSync(isInitial)
      isInitial = false
    } while (rerunRequested)
  })()

  try {
    await syncPromise
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      storeToken('')
      updateStatus({ phase: 'signed-out', authenticated: false, detail: '登录已过期，请重新登录' })
    } else {
      console.warn('[IdeaSpace] cloud sync failed', error)
      updateStatus({
        phase: error instanceof ApiError ? 'error' : 'offline',
        authenticated: Boolean(token),
        detail: error instanceof ApiError ? '同步失败，请稍后重试' : '云端暂时不可用，本地数据已保存'
      })
    }
    throw error
  } finally {
    syncPromise = null
  }
}

export function getSyncStatus(): SyncStatus {
  return status
}

export function subscribeSyncStatus(listener: StatusListener): () => void {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}

export function subscribeSyncData(listener: DataListener): () => void {
  dataListeners.add(listener)
  return () => dataListeners.delete(listener)
}

export function scheduleSync(): void {
  if (!token || !autoSyncEnabled || status.phase === 'conflict') return
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    syncTimer = null
    void runSync().catch(() => undefined)
  }, SYNC_DELAY_MS)
}

export async function initializeSync(): Promise<void> {
  if (!token) {
    updateStatus({ phase: 'signed-out', authenticated: false, detail: '登录后可在设备间同步' })
    return
  }
  if (initializePromise) return initializePromise
  initializePromise = (async () => {
    updateStatus({ phase: 'syncing', authenticated: true, detail: '正在连接云端…' })
    await request('/api/auth/session', 'GET')
    if (!syncInitialized) await inspectInitialSync()
    else if (autoSyncEnabled) await runSync()
    else updateStatus({
      phase: 'synced',
      authenticated: true,
      detail: '自动同步已关闭，可手动同步'
    })
  })()
  try {
    await initializePromise
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      storeToken('')
      updateStatus({ phase: 'signed-out', authenticated: false, detail: '登录已过期，请重新登录' })
    } else {
      updateStatus({ phase: 'offline', authenticated: Boolean(token), detail: '云端暂时不可用，本地数据已保存' })
    }
  } finally {
    initializePromise = null
  }
}

export async function loginAndSync(password: string): Promise<'synced' | 'conflict'> {
  updateStatus({ phase: 'syncing', authenticated: false, detail: '正在验证访问口令…' })
  try {
    const result = await request<{ token: string; expiresAt: number }>('/api/auth/login', 'POST', { password })
    storeToken(result.token, false)
    await inspectInitialSync()
    return status.phase === 'conflict' ? 'conflict' : 'synced'
  } catch (error) {
    if (!token) updateStatus({ phase: 'signed-out', authenticated: false, detail: '登录后可在设备间同步' })
    if (error instanceof ApiError && error.statusCode === 401) throw new Error('访问口令不正确')
    if (error instanceof ApiError && error.statusCode === 429) throw new Error('尝试次数过多，请稍后再试')
    throw new Error('暂时无法连接云端，请检查网络后重试')
  }
}

export function logoutSync(): void {
  pendingRemoteState = null
  storeToken('')
  updateStatus({ phase: 'signed-out', authenticated: false, conflict: null, detail: '已退出云端同步', lastSyncedAt: null })
}

export async function retrySync(): Promise<void> {
  if (!token) return
  await runSync()
}

export function getAutoSyncEnabled(): boolean {
  return autoSyncEnabled
}

export function setAutoSyncEnabled(enabled: boolean): void {
  autoSyncEnabled = enabled
  try {
    Taro.setStorageSync(AUTO_SYNC_STORAGE_KEY, enabled)
  } catch (error) {
    console.warn('[IdeaSpace] save auto sync preference failed', error)
  }
  updateStatus({
    autoSyncEnabled: enabled,
    detail: enabled
      ? token ? '自动同步已开启' : '登录后将自动同步'
      : token ? '自动同步已关闭，可手动同步' : '自动同步已关闭'
  })
  if (enabled && token && status.phase !== 'conflict') scheduleSync()
}

export async function resolveInitialSync(choice: InitialSyncChoice): Promise<void> {
  if (!token || !pendingRemoteState || status.phase !== 'conflict') return
  updateStatus({ phase: 'syncing', authenticated: true, detail: '正在处理首次同步…' })
  const remote = pendingRemoteState
  if (choice === 'replace-local') {
    applyServerState(remote, true)
  } else {
    const local = stripDemoDefaults(loadIdeaState())
    const merged = mergeSyncStates(local, remoteToSyncState(remote))
    const result = await request<SyncResponse>('/api/sync', 'POST', merged)
    applyServerState(result, true)
  }
  pendingRemoteState = null
  markSyncInitialized()
  updateStatus({
    phase: 'synced',
    authenticated: true,
    conflict: null,
    detail: choice === 'merge' ? '本地与云端内容已合并' : '已使用云端内容',
    lastSyncedAt: Date.now()
  })
}

export async function manualSync(): Promise<void> {
  if (!token) {
    Taro.eventCenter.trigger('idea-sync-feedback', '请先在设置中连接云端')
    return
  }
  if (status.phase === 'conflict') {
    Taro.eventCenter.trigger('idea-sync-feedback', '请先在设置中选择首次同步方式')
    return
  }
  Taro.eventCenter.trigger('idea-sync-feedback', '正在保存并同步…')
  try {
    await runSync()
    Taro.eventCenter.trigger('idea-sync-feedback', '已保存并同步')
  } catch {
    Taro.eventCenter.trigger('idea-sync-feedback', '云端保存失败，本地数据已保存')
  }
}

export function startSyncLifecycle(): () => void {
  if (process.env.TARO_ENV === 'h5' && typeof window !== 'undefined') {
    const handleOnline = () => {
      if (token && autoSyncEnabled) void initializeSync()
    }
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void manualSync()
      }
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('keydown', handleSaveShortcut)
    void initializeSync()
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('keydown', handleSaveShortcut)
    }
  }

  const handleNetwork = (result: Taro.onNetworkStatusChange.CallbackResult) => {
    if (result.isConnected && token && autoSyncEnabled) void initializeSync()
  }
  Taro.onNetworkStatusChange(handleNetwork)
  void initializeSync()
  return () => Taro.offNetworkStatusChange(handleNetwork)
}
