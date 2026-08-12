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

/** Alphanumeric only — underscores use soft bounds so snake_case stays plain. */
function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9]/.test(ch)
}

/**
 * Left-to-right inline parse for code, http(s) links, strong, and em.
 * Only http:// and https:// URLs become link nodes.
 * Unclosed or empty marker spans stay literal text.
 */
export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = []
  let i = 0
  let buf = ''

  const flush = () => {
    if (buf) {
      nodes.push({ type: 'text', text: buf })
      buf = ''
    }
  }

  while (i < text.length) {
    // `code` — non-empty only
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1)
      if (end !== -1 && end > i + 1) {
        flush()
        nodes.push({ type: 'code', text: text.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }

    // [label](url) — only http(s) become links
    if (text[i] === '[') {
      const closeBracket = text.indexOf(']', i + 1)
      if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
        const closeParen = text.indexOf(')', closeBracket + 2)
        if (closeParen !== -1) {
          const label = text.slice(i + 1, closeBracket)
          const href = text.slice(closeBracket + 2, closeParen)
          if (/^https?:\/\//i.test(href)) {
            flush()
            nodes.push({ type: 'link', href, children: parseInline(label) })
            i = closeParen + 1
            continue
          }
        }
      }
    }

    // **strong** — non-empty only; failed ** must not fall through to *em*
    if (text[i] === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2)
      if (end !== -1 && end > i + 2) {
        flush()
        nodes.push({ type: 'strong', children: parseInline(text.slice(i + 2, end)) })
        i = end + 2
        continue
      }
      // Unclosed/empty **: emit first * as text; next loop sees remaining *
      buf += text[i]
      i += 1
      continue
    }

    // *em* — non-empty; never open when next char is * (handled above)
    if (text[i] === '*') {
      const end = text.indexOf('*', i + 1)
      if (end !== -1 && end > i + 1) {
        flush()
        nodes.push({ type: 'em', children: parseInline(text.slice(i + 1, end)) })
        i = end + 1
        continue
      }
    }

    // _em_ only at soft bounds: open/close not adjacent to word chars outside
    // so snake_case / a_b_c stay plain; _italic_ still works.
    if (text[i] === '_' && !isWordChar(text[i - 1])) {
      let end = i + 1
      while (end < text.length) {
        const close = text.indexOf('_', end)
        if (close === -1) break
        if (close > i + 1 && !isWordChar(text[close + 1])) {
          flush()
          nodes.push({ type: 'em', children: parseInline(text.slice(i + 1, close)) })
          i = close + 1
          end = -1
          break
        }
        end = close + 1
      }
      if (end === -1) continue
    }

    buf += text[i]
    i += 1
  }

  flush()
  return nodes
}

// Optional leading whitespace so indented "  - [ ] buy milk" is still a list item
const HEADING_RE = /^\s*(#{1,3})\s+(.*)$/
const BLOCKQUOTE_RE = /^\s*>\s?(.*)$/
const TASK_RE = /^\s*([-*])\s+\[([ xX])\]\s?(.*)$/
const UNORDERED_RE = /^\s*([-*])\s+(.*)$/
const ORDERED_RE = /^\s*(\d+)\.\s+(.*)$/

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
    const mark = task[2]
    return {
      kind: 'list',
      ordered: false,
      task: true,
      checked: mark === 'x' || mark === 'X',
      text: task[3]
    }
  }

  const unordered = UNORDERED_RE.exec(line)
  if (unordered) {
    return { kind: 'list', ordered: false, text: unordered[2] }
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
        children: parseInline(classified.text)
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
      blocks.push({
        type: 'blockquote',
        children: parseInline(parts.join('\n'))
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
          children: parseInline(next.text)
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
      children: parseInline(parts.join('\n'))
    })
  }

  return blocks
}

const TASK_LINE_RE = /^(\s*)([-*])\s+\[([ xX])\](.*)$/

/**
 * Flip task checkbox at 0-based source line index.
 * Preserves indent, bullet, and trailing text. No-op if not a task line.
 */
export function toggleTaskAtLine(source: string, lineIndex: number): string {
  const normalized = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')
  if (lineIndex < 0 || lineIndex >= lines.length) return source

  const m = TASK_LINE_RE.exec(lines[lineIndex])
  if (!m) return source

  const indent = m[1]
  const bullet = m[2]
  const mark = m[3]
  const rest = m[4]
  const nextMark = mark === ' ' ? 'x' : ' '
  lines[lineIndex] = `${indent}${bullet} [${nextMark}]${rest}`
  return lines.join('\n')
}

function stripInline(nodes: InlineNode[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case 'text':
        case 'code':
          return n.text
        case 'strong':
        case 'em':
        case 'link':
          return stripInline(n.children)
      }
    })
    .join('')
}

/**
 * Plain single-line summary without markdown markers (for list previews).
 */
export function stripMarkdown(source: string): string {
  const blocks = parseMarkdown(source)
  const parts: string[] = []

  for (const b of blocks) {
    if (b.type === 'list') {
      for (const item of b.items) {
        parts.push(stripInline(item.children))
      }
    } else {
      parts.push(stripInline(b.children))
    }
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim()
}
