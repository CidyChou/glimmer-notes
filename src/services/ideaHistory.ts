import {
  DEFAULT_PROJECT_ID,
  type Idea,
  type IdeaProject,
  type IdeaTag
} from '@/types/idea'
import { removeIdeaDeletion, recordIdeaDeletion, saveIdeas } from '@/services/ideaStorage'
import { HistoryStack } from '@/services/historyStack'

export const MAX_IDEA_HISTORY = 50

export interface IdeaHistoryEntry {
  id: string
  label: string
  ideaId: string
  before: Idea | null
  after: Idea | null
}

export interface IdeaHistoryState {
  canUndo: boolean
  canRedo: boolean
  undoLabel: string | null
  redoLabel: string | null
}

export interface IdeaHistoryContext {
  ideas: Idea[]
  projects: IdeaProject[]
  tags: IdeaTag[]
}

export interface IdeaHistoryResult {
  ideas: Idea[]
  label: string
}

const historyStack = new HistoryStack<IdeaHistoryEntry>(MAX_IDEA_HISTORY)
let sequence = 0
const listeners = new Set<(state: IdeaHistoryState) => void>()

function cloneIdea(idea: Idea | null): Idea | null {
  return idea ? { ...idea, tagIds: [...idea.tagIds] } : null
}

function ideaState(idea: Idea | null): unknown {
  if (!idea) return null
  return {
    id: idea.id,
    text: idea.text,
    createdAt: idea.createdAt,
    colorSlot: idea.colorSlot,
    projectId: idea.projectId,
    tagIds: [...idea.tagIds].sort(),
    pinned: idea.pinned,
    priority: idea.priority,
    archivedAt: idea.archivedAt
  }
}

function sameIdea(a: Idea | null, b: Idea | null): boolean {
  return JSON.stringify(ideaState(a)) === JSON.stringify(ideaState(b))
}

function emit() {
  const state = getIdeaHistoryState()
  listeners.forEach((listener) => listener(state))
}

function snapshotLabel(label: string): string {
  return label.trim() || '任务变更'
}

export function getIdeaHistoryState(): IdeaHistoryState {
  const { undo, redo } = historyStack.state
  return {
    canUndo: undo.length > 0,
    canRedo: redo.length > 0,
    undoLabel: undo.length ? undo[undo.length - 1].label : null,
    redoLabel: redo.length ? redo[redo.length - 1].label : null
  }
}

export function subscribeIdeaHistory(listener: (state: IdeaHistoryState) => void): () => void {
  listeners.add(listener)
  listener(getIdeaHistoryState())
  return () => listeners.delete(listener)
}

export function clearIdeaHistory(): void {
  const { undo, redo } = historyStack.state
  if (!undo.length && !redo.length) return
  historyStack.clear()
  emit()
}

export function recordIdeaChange(input: Omit<IdeaHistoryEntry, 'id'>): void {
  const before = cloneIdea(input.before)
  const after = cloneIdea(input.after)
  if (sameIdea(before, after)) return

  historyStack.push({
    id: `idea-history-${Date.now()}-${sequence++}`,
    label: snapshotLabel(input.label),
    ideaId: input.ideaId,
    before,
    after
  })
  emit()
}

function normalizeTarget(target: Idea, context: IdeaHistoryContext): Idea {
  const project = context.projects.find((item) => item.id === target.projectId)
    || context.projects.find((item) => item.id === DEFAULT_PROJECT_ID)
  const validTagIds = new Set(context.tags.map((tag) => tag.id))
  return {
    ...target,
    projectId: project?.id || DEFAULT_PROJECT_ID,
    colorSlot: project?.colorSlot ?? target.colorSlot,
    tagIds: target.tagIds.filter((tagId) => validTagIds.has(tagId))
  }
}

function applyEntry(context: IdeaHistoryContext, entry: IdeaHistoryEntry, target: Idea | null): Idea[] {
  const now = Date.now()
  if (!target) {
    recordIdeaDeletion(entry.ideaId, now)
    return context.ideas.filter((idea) => idea.id !== entry.ideaId)
  }
  const normalized = { ...normalizeTarget(target, context), updatedAt: now }
  removeIdeaDeletion(entry.ideaId)
  return context.ideas.some((idea) => idea.id === entry.ideaId)
    ? context.ideas.map((idea) => idea.id === entry.ideaId ? normalized : idea)
    : [normalized, ...context.ideas]
}

function expectedStateForEntry(entry: IdeaHistoryEntry, undo: boolean): Idea | null {
  return undo ? entry.after : entry.before
}

function execute(context: IdeaHistoryContext, direction: 'undo' | 'redo'): IdeaHistoryResult | null {
  const currentById = new Map(context.ideas.map((idea) => [idea.id, idea]))
  const entry = historyStack.move(direction, (candidate) => {
    const current = currentById.get(candidate.ideaId) || null
    const expected = expectedStateForEntry(candidate, direction === 'undo')
    return sameIdea(current, expected ? normalizeTarget(expected, context) : null)
  })
  if (!entry) {
    reconcileIdeaHistory(context.ideas, context.projects, context.tags)
    return null
  }

  const nextIdeas = applyEntry(context, entry, direction === 'undo' ? entry.before : entry.after)
  saveIdeas(nextIdeas)
  emit()
  return { ideas: nextIdeas, label: entry.label }
}

export function undoIdeaChange(context: IdeaHistoryContext): IdeaHistoryResult | null {
  return execute(context, 'undo')
}

export function redoIdeaChange(context: IdeaHistoryContext): IdeaHistoryResult | null {
  return execute(context, 'redo')
}

export function reconcileIdeaHistory(
  ideas: Idea[],
  projects: IdeaProject[],
  tags: IdeaTag[],
  options: { replaceLocal?: boolean } = {}
): void {
  if (options.replaceLocal) {
    clearIdeaHistory()
    return
  }

  const currentById = new Map(ideas.map((idea) => [idea.id, idea]))
  const entriesByIdea = new Map<string, IdeaHistoryEntry[]>()
  const { undo, redo } = historyStack.state
  for (const entry of [...undo, ...redo]) {
    entriesByIdea.set(entry.ideaId, [...(entriesByIdea.get(entry.ideaId) || []), entry])
  }

  const invalidIds = new Set<string>()
  entriesByIdea.forEach((entries, ideaId) => {
    const current = currentById.get(ideaId) || null
    const matchesKnownState = entries.some((entry) => {
      const before = entry.before ? normalizeTarget(entry.before, { ideas, projects, tags }) : null
      const after = entry.after ? normalizeTarget(entry.after, { ideas, projects, tags }) : null
      return sameIdea(current, before) || sameIdea(current, after)
    })
    if (!matchesKnownState) invalidIds.add(ideaId)
  })

  if (!invalidIds.size) return
  historyStack.filter((entry) => !invalidIds.has(entry.ideaId))
  emit()
}
