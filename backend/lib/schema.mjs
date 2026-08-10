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
  return {
    id: requiredString(value.id, 'idea.id', 128),
    text: requiredString(value.text, 'idea.text', 10_000),
    createdAt: timestamp(value.createdAt, 'idea.createdAt'),
    updatedAt: timestamp(value.updatedAt, 'idea.updatedAt'),
    colorSlot: value.colorSlot,
    pinned: value.pinned,
    priority: value.priority
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
    tombstones: value.tombstones.map(validateTombstone)
  }
}

export function validateStoredState(value) {
  if (!value || value.schemaVersion !== 1) {
    throw new ValidationError('unsupported store schema')
  }
  const payload = validateSyncPayload(value)
  return { schemaVersion: 1, ...payload }
}
