import Taro from '@tarojs/taro'
import { loadIdeaState, saveIdeaState } from '@/services/ideaStorage'
import { mergeSyncStates } from '@/services/syncMerge'
import { DEFAULT_PROJECT_ID, LEGACY_PROJECT_TAG_ID } from '@/types/idea'
import type { Idea, IdeaProject, IdeaTag, IdeaTombstone } from '@/types/idea'

const TOKEN_STORAGE_KEY = 'idea-space-sync-token-v1'
const API_BASE_URL = __API_BASE_URL__.replace(/\/$/, '')
const SYNC_DELAY_MS = 350

export type SyncPhase = 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error'

export interface SyncStatus {
  phase: SyncPhase
  authenticated: boolean
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

let token = loadToken()
let status: SyncStatus = {
  phase: token ? 'offline' : 'signed-out',
  authenticated: Boolean(token),
  detail: token ? '等待连接云端' : '登录后可在设备间同步',
  lastSyncedAt: null
}
const statusListeners = new Set<StatusListener>()
const dataListeners = new Set<DataListener>()
let syncTimer: ReturnType<typeof setTimeout> | null = null
let syncPromise: Promise<void> | null = null
let initializePromise: Promise<void> | null = null
let rerunRequested = false

function updateStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next }
  statusListeners.forEach((listener) => listener(status))
}

function storeToken(next: string) {
  token = next
  try {
    if (next) Taro.setStorageSync(TOKEN_STORAGE_KEY, next)
    else Taro.removeStorageSync(TOKEN_STORAGE_KEY)
  } catch (error) {
    console.warn('[IdeaSpace] save sync session failed', error)
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
    dataListeners.forEach((listener) => listener(remoteIdeas, remoteTags, remoteProjects))
    return
  }
  const merged = mergeSyncStates(
    { ideas: current.ideas, projects: current.projects, tags: current.tags, tombstones: current.tombstones },
    { ideas: remoteIdeas, projects: remoteProjects, tags: remoteTags, tombstones: remote.tombstones }
  )
  saveIdeaState(merged.ideas, merged.tombstones, merged.tags, merged.projects)
  dataListeners.forEach((listener) => listener(merged.ideas, merged.tags, merged.projects))
}

async function performSync(initial: boolean) {
  const local = loadIdeaState()
  let remote: SyncResponse
  if (initial && !local.hasPersistedIdeas && local.tombstones.length === 0) {
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
    remote = await request<SyncResponse>('/api/sync', 'POST', {
      ideas: local.ideas,
      projects: local.projects,
      tags: local.tags,
      tombstones: local.tombstones
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
  if (!token) return
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
    await runSync(true)
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

export async function loginAndSync(password: string): Promise<void> {
  updateStatus({ phase: 'syncing', authenticated: false, detail: '正在验证访问口令…' })
  try {
    const result = await request<{ token: string; expiresAt: number }>('/api/auth/login', 'POST', { password })
    storeToken(result.token)
    await runSync(true)
  } catch (error) {
    if (!token) updateStatus({ phase: 'signed-out', authenticated: false, detail: '登录后可在设备间同步' })
    if (error instanceof ApiError && error.statusCode === 401) throw new Error('访问口令不正确')
    if (error instanceof ApiError && error.statusCode === 429) throw new Error('尝试次数过多，请稍后再试')
    throw new Error('暂时无法连接云端，请检查网络后重试')
  }
}

export function logoutSync(): void {
  storeToken('')
  updateStatus({ phase: 'signed-out', authenticated: false, detail: '已退出云端同步', lastSyncedAt: null })
}

export async function retrySync(): Promise<void> {
  if (!token) return
  await initializeSync()
}

export function startSyncLifecycle(): () => void {
  if (process.env.TARO_ENV === 'h5' && typeof window !== 'undefined') {
    const handleOnline = () => {
      if (token) void initializeSync()
    }
    window.addEventListener('online', handleOnline)
    void initializeSync()
    return () => window.removeEventListener('online', handleOnline)
  }

  const handleNetwork = (result: Taro.onNetworkStatusChange.CallbackResult) => {
    if (result.isConnected && token) void initializeSync()
  }
  Taro.onNetworkStatusChange(handleNetwork)
  void initializeSync()
  return () => Taro.offNetworkStatusChange(handleNetwork)
}
