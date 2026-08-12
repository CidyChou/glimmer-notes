import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseMarkdown, stripMarkdown, toggleTaskAtLine } from './markdown'

describe('parseMarkdown blocks', () => {
  it('parses headings, paragraphs, lists, quote, and tasks', () => {
    const src = [
      '# Title',
      '',
      'Hello **world**',
      '',
      '- item',
      '1. ordered',
      '- [ ] todo',
      '- [x] done',
      '',
      '> quote line'
    ].join('\n')

    const ast = parseMarkdown(src)
    assert.equal(ast[0].type, 'heading')
    assert.equal((ast[0] as { level: number }).level, 1)
    assert.equal(ast[1].type, 'paragraph')
    assert.equal(ast[2].type, 'list')
    assert.equal((ast[2] as { ordered: boolean }).ordered, false)
    // list should contain bullet + task items; exact shape defined in implementation
    assert.ok(ast.some((n) => n.type === 'list'))
    assert.ok(ast.some((n) => n.type === 'blockquote'))
  })

  it('returns empty array for empty string', () => {
    assert.deepEqual(parseMarkdown(''), [])
    assert.deepEqual(parseMarkdown('   '), [])
  })

  it('merges consecutive bullets and tasks into one unordered list with task flags and lineIndex', () => {
    const src = '- item\n- [ ] todo\n- [x] done'
    const [list] = parseMarkdown(src)
    assert.equal(list.type, 'list')
    const items = (list as { items: { task?: boolean; checked?: boolean; lineIndex: number }[] }).items
    assert.equal(items.length, 3)
    assert.equal(items[0].task, undefined)
    assert.equal(items[0].lineIndex, 0)
    assert.equal(items[1].task, true)
    assert.equal(items[1].checked, false)
    assert.equal(items[1].lineIndex, 1)
    assert.equal(items[2].task, true)
    assert.equal(items[2].checked, true)
    assert.equal(items[2].lineIndex, 2)
  })

  it('parses indented task lines as list items with correct lineIndex', () => {
    const src = 'Note\n  - [ ] buy milk\n- [x] done'
    const ast = parseMarkdown(src)
    assert.equal(ast[0].type, 'paragraph')
    assert.equal(ast[1].type, 'list')
    const items = (
      ast[1] as {
        items: { task?: boolean; checked?: boolean; lineIndex: number; children: { type: string; text?: string }[] }[]
      }
    ).items
    assert.equal(items.length, 2)
    assert.equal(items[0].task, true)
    assert.equal(items[0].checked, false)
    assert.equal(items[0].lineIndex, 1)
    assert.equal(items[1].task, true)
    assert.equal(items[1].checked, true)
    assert.equal(items[1].lineIndex, 2)
  })

  it('normalizes CRLF line endings', () => {
    const src = '# Hi\r\n\r\n- [ ] a\r\n- [x] b'
    const ast = parseMarkdown(src)
    assert.equal(ast[0].type, 'heading')
    assert.equal(ast[1].type, 'list')
    const items = (ast[1] as { items: { task?: boolean; checked?: boolean; lineIndex: number }[] }).items
    assert.equal(items.length, 2)
    assert.equal(items[0].task, true)
    assert.equal(items[0].checked, false)
    assert.equal(items[0].lineIndex, 2)
    assert.equal(items[1].checked, true)
    assert.equal(items[1].lineIndex, 3)
  })
})

describe('inline', () => {
  it('parses strong, em, code, and http links', () => {
    const [p] = parseMarkdown('A **b** and *c* and `d` and [e](https://x.com)')
    assert.equal(p.type, 'paragraph')
    const types = (p as { children: { type: string }[] }).children.map((c) => c.type)
    assert.ok(types.includes('strong'))
    assert.ok(types.includes('em'))
    assert.ok(types.includes('code'))
    assert.ok(types.includes('link'))
  })

  it('does not treat javascript: as link', () => {
    const [p] = parseMarkdown('[x](javascript:alert(1))')
    const children = (p as { children: { type: string }[] }).children
    assert.ok(!children.some((c) => c.type === 'link'))
  })

  it('parses inline inside headings and list items', () => {
    const src = '## Hello **world**\n- buy *milk* and `eggs`'
    const ast = parseMarkdown(src)
    assert.equal(ast[0].type, 'heading')
    const hTypes = (ast[0] as { children: { type: string }[] }).children.map((c) => c.type)
    assert.ok(hTypes.includes('strong'))
    assert.equal(ast[1].type, 'list')
    const itemChildren = (
      ast[1] as { items: { children: { type: string }[] }[] }
    ).items[0].children
    const itemTypes = itemChildren.map((c) => c.type)
    assert.ok(itemTypes.includes('em'))
    assert.ok(itemTypes.includes('code'))
  })
})

describe('toggleTaskAtLine', () => {
  it('toggles unchecked to checked preserving indent and text', () => {
    const src = 'Note\n  - [ ] buy milk\n- [x] done'
    const next = toggleTaskAtLine(src, 1)
    assert.equal(next.split('\n')[1], '  - [x] buy milk')
  })

  it('toggles checked to unchecked', () => {
    const src = '- [X] done'
    assert.equal(toggleTaskAtLine(src, 0), '- [ ] done')
  })

  it('no-ops on non-task lines', () => {
    const src = 'hello'
    assert.equal(toggleTaskAtLine(src, 0), src)
  })
})

describe('stripMarkdown', () => {
  it('produces a single-line plain summary', () => {
    const s = stripMarkdown('## Hi\n\n- [x] a\n**b** and [c](https://x.com)')
    assert.ok(!s.includes('##'))
    assert.ok(!s.includes('**'))
    assert.ok(!s.includes('['))
    assert.ok(!s.includes('\n'))
    assert.ok(s.includes('Hi'))
    assert.ok(s.includes('a'))
    assert.ok(s.includes('b'))
    assert.ok(s.includes('c'))
  })
})
