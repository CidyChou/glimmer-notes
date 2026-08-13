export type ContinueResult =
  | { type: 'continue'; prefix: string }
  | { type: 'end' }

const ORDERED_WITH_CONTENT_RE = /^(\s*)(\d+)\.\s+(.*\S.*)$/
const ORDERED_MARKER_ONLY_RE = /^(\s*)\d+\.\s*$/
const TASK_WITH_CONTENT_RE = /^(\s*)[-*]\s+\[[ xX]\]\s+(.*\S.*)$/
const TASK_MARKER_ONLY_RE = /^(\s*)[-*]\s+\[[ xX]\]\s*$/
const BULLET_WITH_CONTENT_RE = /^(\s*)([-*])\s+(.*\S.*)$/
const BULLET_MARKER_ONLY_RE = /^(\s*)[-*]\s*$/

/** Return the source prefix for the next line, or end an empty list item. */
export function continueListMarker(line: string): ContinueResult {
  const ordered = ORDERED_WITH_CONTENT_RE.exec(line)
  if (ordered) {
    return {
      type: 'continue',
      prefix: `${ordered[1]}${Number(ordered[2]) + 1}. `
    }
  }
  if (ORDERED_MARKER_ONLY_RE.test(line)) return { type: 'end' }

  const task = TASK_WITH_CONTENT_RE.exec(line)
  if (task) {
    return { type: 'continue', prefix: `${task[1]}- [ ] ` }
  }
  if (TASK_MARKER_ONLY_RE.test(line)) return { type: 'end' }

  const bullet = BULLET_WITH_CONTENT_RE.exec(line)
  if (bullet) {
    return { type: 'continue', prefix: `${bullet[1]}${bullet[2]} ` }
  }
  if (BULLET_MARKER_ONLY_RE.test(line)) return { type: 'end' }

  return { type: 'continue', prefix: '' }
}

export function linesFromDetails(details: string): string[] {
  return details.replace(/\r\n?/g, '\n').split('\n')
}

export function detailsFromLines(lines: string[]): string {
  return lines.length ? lines.join('\n') : ''
}

export interface ApplyEnterResult {
  lines: string[]
  focusIndex: number
}

export interface ApplyEnterAtSelectionResult {
  value: string
  caret: number
}

export function isSingleNewlineInsertion(previous: string, next: string, cursor: number): boolean {
  const insertedAt = cursor - 1
  return insertedAt >= 0 &&
    next[insertedAt] === '\n' &&
    next.length === previous.length + 1 &&
    `${next.slice(0, insertedAt)}${next.slice(insertedAt + 1)}` === previous
}

const LIST_PREFIX_RE = /^(?:\s*\d+\.\s+|\s*[-*]\s+\[[ xX]\]\s+|\s*[-*]\s+)/

/**
 * Apply Enter inside one continuous text editor.
 *
 * Unlike applyEnterAtLine, this keeps the native document selection model, so
 * selections and cursor movement can cross line boundaries.
 */
export function applyEnterAtSelection(
  value: string,
  selectionStart: number,
  selectionEnd = selectionStart
): ApplyEnterAtSelectionResult {
  const start = Math.max(0, Math.min(selectionStart, value.length))
  const end = Math.max(start, Math.min(selectionEnd, value.length))

  if (start !== end) {
    return {
      value: `${value.slice(0, start)}\n${value.slice(end)}`,
      caret: start + 1
    }
  }

  const lineStart = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1
  const nextBreak = value.indexOf('\n', start)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak
  const line = value.slice(lineStart, lineEnd)
  const column = start - lineStart
  const continuation = continueListMarker(line)

  if (continuation.type === 'end' && column >= line.length) {
    return {
      value: `${value.slice(0, lineStart)}${value.slice(lineEnd)}`,
      caret: lineStart
    }
  }

  const sourcePrefixLength = LIST_PREFIX_RE.exec(line)?.[0].length ?? 0
  const prefix = continuation.type === 'continue' && sourcePrefixLength && column >= sourcePrefixLength
    ? continuation.prefix
    : ''
  const suffixStart = prefix && value[start] === ' ' ? start + 1 : start
  return {
    value: `${value.slice(0, start)}\n${prefix}${value.slice(suffixStart)}`,
    caret: start + 1 + prefix.length
  }
}

/** Apply Enter to a whole-line editor without mutating the input array. */
export function applyEnterAtLine(lines: string[], index: number): ApplyEnterResult {
  const safeLines = lines.length ? lines : ['']
  if (index < 0 || index >= safeLines.length) {
    return {
      lines: [...safeLines],
      focusIndex: Math.max(0, Math.min(index, safeLines.length - 1))
    }
  }

  const result = continueListMarker(safeLines[index])
  const next = [...safeLines]
  if (result.type === 'end') {
    next[index] = ''
    return { lines: next, focusIndex: index }
  }

  next.splice(index + 1, 0, result.prefix)
  return { lines: next, focusIndex: index + 1 }
}
