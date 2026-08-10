const PRIORITIES = new Set(['inbox', 'urgent', 'important', 'quick'])

export class ValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ValidationError'
  }
}

function requiredString(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new ValidationError(`${field} must be a non-empty string up to ${maxLength} characters`)
  }
  return value
}

function timestamp(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ValidationError(`${field} must be a non-negative integer timestamp`)
  }
  return value
}

export function validateIdea(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('idea must be an object')
  }
  if (!Number.isInteger(value.colorSlot) || value.colorSlot < 0 || value.colorSlot > 6) {
    throw new ValidationError('idea.colorSlot must be an integer from 0 to 6')
  }
  if (typeof value.pinned !== 'boolean') {
    throw new ValidationError('idea.pinned must be a boolean')
  }
  if (!PRIORITIES.has(value.priority)) {
    throw new ValidationError('idea.priority is invalid')
  }
  const legacyTagId = typeof value.tagId === 'string' && value.tagId.trim() && value.tagId !== 'tag-project'
    ? value.tagId.slice(0, 128)
    : null
  const tagIds = Array.isArray(value.tagIds)
    ? [...new Set(value.tagIds.map((id) => requiredString(id, 'idea.tagIds[]', 128)))].slice(0, 50)
    : legacyTagId ? [legacyTagId] : []
  return {
    id: requiredString(value.id, 'idea.id', 128),
    text: requiredString(value.text, 'idea.text', 10_000),
    createdAt: timestamp(value.createdAt, 'idea.createdAt'),
    updatedAt: timestamp(value.updatedAt, 'idea.updatedAt'),
    colorSlot: value.colorSlot,
    projectId: typeof value.projectId === 'string' && value.projectId.trim() ? value.projectId.slice(0, 128) : 'project-default',
    tagIds,
    pinned: value.pinned,
    priority: value.priority,
    archivedAt: value.archivedAt == null ? null : timestamp(value.archivedAt, 'idea.archivedAt')
  }
}

export function validateTag(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('tag must be an object')
  }
  if (!Number.isInteger(value.colorSlot) || value.colorSlot < 0 || value.colorSlot > 6) {
    throw new ValidationError('tag.colorSlot must be an integer from 0 to 6')
  }
  return {
    id: requiredString(value.id, 'tag.id', 128),
    name: requiredString(value.name, 'tag.name', 12),
    colorSlot: value.colorSlot,
    createdAt: timestamp(value.createdAt, 'tag.createdAt'),
    updatedAt: timestamp(value.updatedAt, 'tag.updatedAt')
  }
}

export function validateProject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('project must be an object')
  }
  if (!Number.isInteger(value.colorSlot) || value.colorSlot < 0 || value.colorSlot > 6) {
    throw new ValidationError('project.colorSlot must be an integer from 0 to 6')
  }
  return {
    id: requiredString(value.id, 'project.id', 128),
    name: requiredString(value.name, 'project.name', 16),
    colorSlot: value.colorSlot,
    createdAt: timestamp(value.createdAt, 'project.createdAt'),
    updatedAt: timestamp(value.updatedAt, 'project.updatedAt'),
    isDefault: Boolean(value.isDefault)
  }
}

export function validateTombstone(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('tombstone must be an object')
  }
  return {
    id: requiredString(value.id, 'tombstone.id', 128),
    deletedAt: timestamp(value.deletedAt, 'tombstone.deletedAt')
  }
}

export function validateSyncPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('sync payload must be an object')
  }
  if (!Array.isArray(value.ideas) || !Array.isArray(value.tombstones)) {
    throw new ValidationError('ideas and tombstones must be arrays')
  }
  if (value.ideas.length > 10_000 || value.tombstones.length > 20_000) {
    throw new ValidationError('sync payload contains too many records')
  }
  return {
    ideas: value.ideas.map(validateIdea),
    projects: Array.isArray(value.projects) ? value.projects.map(validateProject) : [],
    tags: Array.isArray(value.tags) ? value.tags.map(validateTag) : [],
    tombstones: value.tombstones.map(validateTombstone)
  }
}

export function validateStoredState(value) {
  if (!value || ![1, 2, 3].includes(value.schemaVersion)) {
    throw new ValidationError('unsupported store schema')
  }
  const payload = validateSyncPayload(value)
  return { schemaVersion: 3, ...payload }
}
