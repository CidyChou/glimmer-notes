export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: InlineNode[] }
  | { type: 'em'; children: InlineNode[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: InlineNode[] }

export type ListItem = {
  task?: boolean
  checked?: boolean
  lineIndex: number
  children: InlineNode[]
}

export type BlockNode =
  | { type: 'heading'; level: 1 | 2 | 3; children: InlineNode[] }
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'blockquote'; children: InlineNode[] }
  | {
      type: 'list'
      ordered: boolean
      items: ListItem[]
    }

/** Task 1: block-only — inline is a single text node. Task 2 will expand this. */
function toInline(text: string): InlineNode[] {
  return [{ type: 'text', text }]
}

const HEADING_RE = /^(#{1,3})\s+(.*)$/
const BLOCKQUOTE_RE = /^>\s?(.*)$/
const TASK_RE = /^-\s+\[([ xX])\]\s?(.*)$/
const UNORDERED_RE = /^[-*]\s+(.*)$/
const ORDERED_RE = /^(\d+)\.\s+(.*)$/

type LineKind =
  | { kind: 'blank' }
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'blockquote'; text: string }
  | { kind: 'list'; ordered: boolean; task?: boolean; checked?: boolean; text: string }
  | { kind: 'paragraph'; text: string }

function classifyLine(line: string): LineKind {
  if (/^\s*$/.test(line)) return { kind: 'blank' }

  const heading = HEADING_RE.exec(line)
  if (heading) {
    const level = heading[1].length as 1 | 2 | 3
    return { kind: 'heading', level, text: heading[2] }
  }

  const quote = BLOCKQUOTE_RE.exec(line)
  if (quote) {
    return { kind: 'blockquote', text: quote[1] }
  }

  // Tasks before plain bullets: "- [ ] foo" also matches "- "
  const task = TASK_RE.exec(line)
  if (task) {
    const mark = task[1]
    return {
      kind: 'list',
      ordered: false,
      task: true,
      checked: mark === 'x' || mark === 'X',
      text: task[2]
    }
  }

  const unordered = UNORDERED_RE.exec(line)
  if (unordered) {
    return { kind: 'list', ordered: false, text: unordered[1] }
  }

  const ordered = ORDERED_RE.exec(line)
  if (ordered) {
    return { kind: 'list', ordered: true, text: ordered[2] }
  }

  return { kind: 'paragraph', text: line }
}

/**
 * Parse a markdown subset into block AST.
 * Tracks 0-based source line indices for list items (toggleTaskAtLine).
 */
export function parseMarkdown(source: string): BlockNode[] {
  const normalized = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (/^\s*$/.test(normalized)) return []

  const lines = normalized.split('\n')
  const blocks: BlockNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const classified = classifyLine(line)

    if (classified.kind === 'blank') {
      i += 1
      continue
    }

    if (classified.kind === 'heading') {
      blocks.push({
        type: 'heading',
        level: classified.level,
        children: toInline(classified.text)
      })
      i += 1
      continue
    }

    if (classified.kind === 'blockquote') {
      const parts: string[] = [classified.text]
      i += 1
      while (i < lines.length) {
        const next = classifyLine(lines[i])
        if (next.kind !== 'blockquote') break
        parts.push(next.text)
        i += 1
      }
      // Consecutive quote lines join with newline for later inline (Task 2)
      blocks.push({
        type: 'blockquote',
        children: toInline(parts.join('\n'))
      })
      continue
    }

    if (classified.kind === 'list') {
      const ordered = classified.ordered
      const items: ListItem[] = []

      while (i < lines.length) {
        const next = classifyLine(lines[i])
        if (next.kind !== 'list' || next.ordered !== ordered) break

        const item: ListItem = {
          lineIndex: i,
          children: toInline(next.text)
        }
        if (next.task) {
          item.task = true
          item.checked = next.checked
        }
        items.push(item)
        i += 1
      }

      blocks.push({ type: 'list', ordered, items })
      continue
    }

    // paragraph — consecutive non-blank non-special lines merge
    const parts: string[] = [classified.text]
    i += 1
    while (i < lines.length) {
      const next = classifyLine(lines[i])
      if (next.kind !== 'paragraph') break
      parts.push(next.text)
      i += 1
    }
    blocks.push({
      type: 'paragraph',
      children: toInline(parts.join('\n'))
    })
  }

  return blocks
}
