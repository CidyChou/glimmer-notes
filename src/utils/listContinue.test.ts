import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyEnterAtSelection,
  applyEnterAtLine,
  continueListMarker,
  detailsFromLines,
  isSingleNewlineInsertion,
  linesFromDetails
} from './listContinue'

describe('continueListMarker', () => {
  it('increments ordered lists and preserves indentation', () => {
    assert.deepEqual(continueListMarker('1. first'), { type: 'continue', prefix: '2. ' })
    assert.deepEqual(continueListMarker('  9. item'), { type: 'continue', prefix: '  10. ' })
  })

  it('continues unordered and task lists', () => {
    assert.deepEqual(continueListMarker('- item'), { type: 'continue', prefix: '- ' })
    assert.deepEqual(continueListMarker('* item'), { type: 'continue', prefix: '* ' })
    assert.deepEqual(continueListMarker('- [x] done'), { type: 'continue', prefix: '- [ ] ' })
    assert.deepEqual(continueListMarker('  - [ ] todo'), { type: 'continue', prefix: '  - [ ] ' })
  })

  it('ends a list when the current line only contains a marker', () => {
    assert.deepEqual(continueListMarker('1. '), { type: 'end' })
    assert.deepEqual(continueListMarker('- '), { type: 'end' })
    assert.deepEqual(continueListMarker('- [ ] '), { type: 'end' })
  })

  it('inserts a plain empty line after normal text', () => {
    assert.deepEqual(continueListMarker('hello'), { type: 'continue', prefix: '' })
  })
})

describe('line editor helpers', () => {
  it('roundtrips blank and trailing lines', () => {
    assert.deepEqual(linesFromDetails('a\n\nb\n'), ['a', '', 'b', ''])
    assert.equal(detailsFromLines(['a', '', 'b', '']), 'a\n\nb\n')
    assert.deepEqual(linesFromDetails(''), [''])
    assert.deepEqual(linesFromDetails('a\r\nb'), ['a', 'b'])
  })

  it('continues an ordered list and moves focus to the inserted line', () => {
    const result = applyEnterAtLine(['1. a'], 0)
    assert.deepEqual(result.lines, ['1. a', '2. '])
    assert.equal(result.focusIndex, 1)
  })

  it('clears an empty marker and keeps focus on that line', () => {
    const result = applyEnterAtLine(['1. a', '2. '], 1)
    assert.deepEqual(result.lines, ['1. a', ''])
    assert.equal(result.focusIndex, 1)
  })

  it('does not mutate input lines', () => {
    const lines = ['- item']
    applyEnterAtLine(lines, 0)
    assert.deepEqual(lines, ['- item'])
  })
})

describe('continuous editor helpers', () => {
  it('detects only a single native newline insertion', () => {
    assert.equal(isSingleNewlineInsertion('- 123', '- 123\n', 6), true)
    assert.equal(isSingleNewlineInsertion('- 123', '- 123\n-', 7), false)
    assert.equal(isSingleNewlineInsertion('a', 'ab', 2), false)
  })

  it('continues a list at the document caret', () => {
    assert.deepEqual(applyEnterAtSelection('before\n1. first', 15), {
      value: 'before\n1. first\n2. ',
      caret: 19
    })
  })

  it('splits a list item without losing the suffix', () => {
    assert.deepEqual(applyEnterAtSelection('1. first second', 8), {
      value: '1. first\n2. second',
      caret: 12
    })
  })

  it('continues task items unchecked and keeps the caret after the marker', () => {
    assert.deepEqual(applyEnterAtSelection('- [x] done', 10), {
      value: '- [x] done\n- [ ] ',
      caret: 17
    })
    assert.deepEqual(applyEnterAtSelection('- [ ] first', 11), {
      value: '- [ ] first\n- [ ] ',
      caret: 18
    })
  })

  it('splits a task item in the middle without losing its suffix', () => {
    assert.deepEqual(applyEnterAtSelection('- [ ] first second', 11), {
      value: '- [ ] first\n- [ ] second',
      caret: 18
    })
  })

  it('ends a task list from an empty marker', () => {
    assert.deepEqual(applyEnterAtSelection('- [ ] first\n- [ ] ', 18), {
      value: '- [ ] first\n',
      caret: 12
    })
  })

  it('ends an empty list item in place', () => {
    assert.deepEqual(applyEnterAtSelection('1. first\n2. ', 12), {
      value: '1. first\n',
      caret: 9
    })
  })

  it('keeps native split behavior before an empty marker', () => {
    assert.deepEqual(applyEnterAtSelection('1. ', 0), {
      value: '\n1. ',
      caret: 1
    })
  })

  it('inserts at the beginning of a document that already starts blank', () => {
    assert.deepEqual(applyEnterAtSelection('\nnext', 0), {
      value: '\n\nnext',
      caret: 1
    })
  })

  it('replaces a cross-line selection with one newline', () => {
    assert.deepEqual(applyEnterAtSelection('one\ntwo\nthree', 2, 8), {
      value: 'on\nthree',
      caret: 3
    })
  })
})
