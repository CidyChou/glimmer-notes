import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseMarkdown } from './markdown'

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
})
