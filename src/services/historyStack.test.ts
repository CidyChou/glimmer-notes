import assert from 'node:assert/strict'
import test from 'node:test'
import { HistoryStack } from './historyStack'

test('keeps at most 50 undo entries and clears redo after a new change', () => {
  const stack = new HistoryStack<number>(50)
  for (let index = 0; index < 55; index += 1) stack.push(index)
  assert.equal(stack.state.undo.length, 50)
  assert.equal(stack.state.undo[0], 5)

  assert.equal(stack.move('undo', (entry) => entry === 54), 54)
  assert.deepEqual(stack.state.redo, [54])
  stack.push(99)
  assert.deepEqual(stack.state.redo, [])
  assert.equal(stack.state.undo.at(-1), 99)
})

test('does not move a stack when the current task no longer matches', () => {
  const stack = new HistoryStack<{ before: number; after: number }>()
  stack.push({ before: 1, after: 2 })
  assert.equal(stack.move('undo', (entry) => entry.after === 3), null)
  assert.equal(stack.state.undo.length, 1)
  assert.equal(stack.state.redo.length, 0)
})

test('supports continuous undo and redo in order', () => {
  const stack = new HistoryStack<{ id: string; before: number; after: number }>()
  stack.push({ id: 'a', before: 0, after: 1 })
  stack.push({ id: 'b', before: 0, after: 2 })

  assert.equal(stack.move('undo', (entry) => entry.id === 'b'), stack.state.redo[0])
  assert.equal(stack.move('undo', (entry) => entry.id === 'a'), stack.state.redo[1])
  assert.equal(stack.state.undo.length, 0)
  assert.equal(stack.move('redo', (entry) => entry.id === 'a')?.id, 'a')
  assert.equal(stack.move('redo', (entry) => entry.id === 'b')?.id, 'b')
  assert.equal(stack.state.redo.length, 0)
})
