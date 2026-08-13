import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { composeIdeaText, splitIdeaText } from './ideaText'

describe('idea text markdown preservation', () => {
  it('preserves a trailing list-marker space used by live continuation', () => {
    const value = composeIdeaText('Title', '1. item\n2. ')
    assert.equal(value, 'Title\n1. item\n2. ')
    assert.deepEqual(splitIdeaText(value), {
      title: 'Title',
      details: '1. item\n2. '
    })
  })

  it('preserves blank detail lines while treating whitespace-only details as empty', () => {
    const value = composeIdeaText(' Title ', '\nfirst\n\n')
    assert.equal(value, 'Title\n\nfirst\n\n')
    assert.equal(splitIdeaText(value).details, '\nfirst\n\n')
    assert.equal(composeIdeaText('Title', '  \n '), 'Title')
  })
})
