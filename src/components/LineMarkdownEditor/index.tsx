import { Text, Textarea, View } from '@tarojs/components'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import MarkdownView from '@/components/MarkdownView'
import {
  applyEnterAtSelection,
  isSingleNewlineInsertion,
  linesFromDetails
} from '@/utils/listContinue'
import { toggleTaskAtLine } from '@/utils/markdown'
import './index.css'

export type LineMarkdownCommitReason = 'edit' | 'task'

interface Props {
  value: string
  onChange: (value: string) => void
  onCommit: (value: string, reason: LineMarkdownCommitReason) => void
  className?: string
}

interface EditorSelection {
  start: number
  end: number
}

const EDITOR_LINE_HEIGHT = 26
const EDITOR_MAX_HEIGHT = 240
const EDITOR_PADDING = 2

function lineIndexAtOffset(value: string, offset: number): number {
  const safeOffset = Math.max(0, Math.min(offset, value.length))
  let lineIndex = 0
  for (let index = 0; index < safeOffset; index += 1) {
    if (value[index] === '\n') lineIndex += 1
  }
  return lineIndex
}

function caretAtPointer(textarea: HTMLTextAreaElement, clientX: number, clientY: number): number | null {
  const editor = textarea.closest('.line-md-continuous')
  const rows = editor?.querySelectorAll('.line-md-live-row')
  if (!rows?.length) return null

  let lineIndex = -1
  for (let index = 0; index < rows.length; index += 1) {
    const rect = rows[index].getBoundingClientRect()
    if (clientY >= rect.top && clientY <= rect.bottom) {
      lineIndex = index
      break
    }
  }
  if (lineIndex < 0) return null

  const lines = textarea.value.split('\n')
  const line = lines[lineIndex] || ''
  const textareaRect = textarea.getBoundingClientRect()
  const style = getComputedStyle(textarea)
  const contentX = Math.max(0, clientX - textareaRect.left - parseFloat(style.paddingLeft || '0'))
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  let column = line.length
  if (context) {
    context.font = style.font
    let width = 0
    for (let index = 0; index < line.length; index += 1) {
      const charWidth = context.measureText(line[index]).width
      if (contentX < width + charWidth / 2) {
        column = index
        break
      }
      width += charWidth
    }
  }

  let lineStart = 0
  for (let index = 0; index < lineIndex; index += 1) {
    lineStart += lines[index].length + 1
  }
  return lineStart + column
}

function textareaFromEvent(event: Event): HTMLTextAreaElement | null {
  const target = event.target as HTMLTextAreaElement | null
  if (target && typeof target.setSelectionRange === 'function') return target
  const currentTarget = event.currentTarget as HTMLElement | null
  return currentTarget?.querySelector?.('textarea') || null
}

function scrollTopForCaret(
  value: string,
  caret: number,
  textarea: HTMLTextAreaElement
): number {
  const editor = textarea.closest('.line-md-continuous') as HTMLElement | null
  const layer = editor?.querySelector('.line-md-live-layer') as HTMLElement | null
  const rows = layer?.querySelectorAll('.line-md-live-row')
  const lineIndex = lineIndexAtOffset(value, caret)
  const row = rows?.[lineIndex] as HTMLElement | undefined
  const fallbackContentHeight = linesFromDetails(value).length * EDITOR_LINE_HEIGHT + EDITOR_PADDING * 2
  const contentHeight = layer?.scrollHeight || fallbackContentHeight
  const viewportHeight = editor?.clientHeight || Math.min(EDITOR_MAX_HEIGHT, fallbackContentHeight)
  if (contentHeight <= viewportHeight) return 0

  const lineTop = row?.offsetTop ?? lineIndex * EDITOR_LINE_HEIGHT + EDITOR_PADDING
  const lineBottom = lineTop + (row?.offsetHeight || EDITOR_LINE_HEIGHT)
  if (lineTop < textarea.scrollTop) return Math.max(0, lineTop - EDITOR_PADDING)
  if (lineBottom > textarea.scrollTop + viewportHeight) {
    return Math.max(0, lineBottom - viewportHeight + EDITOR_PADDING)
  }
  return textarea.scrollTop
}

type ArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'

function moveCaret(value: string, caret: number, key: ArrowKey): number {
  if (key === 'ArrowLeft') return Math.max(0, caret - 1)
  if (key === 'ArrowRight') return Math.min(value.length, caret + 1)

  const lines = value.split('\n')
  const lineIndex = lineIndexAtOffset(value, caret)
  const targetLineIndex = key === 'ArrowUp' ? lineIndex - 1 : lineIndex + 1
  if (targetLineIndex < 0 || targetLineIndex >= lines.length) return caret

  let lineStart = 0
  for (let index = 0; index < lineIndex; index += 1) {
    lineStart += lines[index].length + 1
  }
  let targetLineStart = 0
  for (let index = 0; index < targetLineIndex; index += 1) {
    targetLineStart += lines[index].length + 1
  }
  const column = caret - lineStart
  return targetLineStart + Math.min(column, lines[targetLineIndex].length)
}

function applyArrowSelection(textarea: HTMLTextAreaElement, key: ArrowKey, extend: boolean) {
  const start = textarea.selectionStart ?? 0
  const end = textarea.selectionEnd ?? start
  const direction = textarea.selectionDirection

  if (!extend && start !== end) {
    const caret = key === 'ArrowLeft' || key === 'ArrowUp' ? start : end
    textarea.setSelectionRange(caret, caret)
    return
  }

  const anchor = direction === 'backward' ? end : start
  const focus = direction === 'backward' ? start : end
  const nextFocus = moveCaret(textarea.value, focus, key)
  if (!extend) {
    textarea.setSelectionRange(nextFocus, nextFocus)
    return
  }

  textarea.setSelectionRange(
    Math.min(anchor, nextFocus),
    Math.max(anchor, nextFocus),
    nextFocus < anchor ? 'backward' : 'forward'
  )
}

export default function LineMarkdownEditor({ value, onChange, onCommit, className }: Props) {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)
  const [requestedCaret, setRequestedCaret] = useState(-1)
  const [selection, setSelection] = useState<EditorSelection>({ start: 0, end: 0 })
  const [editorScrollTop, setEditorScrollTop] = useState(0)
  const draftRef = useRef(value)
  const focusedRef = useRef(false)
  const textareaRef = useRef<HTMLElement | null>(null)
  const pointerCaretRef = useRef<number | null>(null)
  const pointerDownRef = useRef(false)
  const syncSelectionRef = useRef<(textarea: HTMLTextAreaElement) => void>(() => {})
  const applyEnterRef = useRef<(
    selectionStart: number,
    selectionEnd: number,
    textarea?: HTMLTextAreaElement
  ) => void>(() => {})
  const nativePropsRef = useRef<Record<string, unknown> | null>(null)
  const onChangeRef = useRef(onChange)
  const onCommitRef = useRef(onCommit)
  onChangeRef.current = onChange
  onCommitRef.current = onCommit

  const lines = linesFromDetails(draft)
  const onlyEmptyLine = lines.length === 1 && !lines[0].trim()
  const selectionStartLine = lineIndexAtOffset(draft, selection.start)
  const selectionEndLine = lineIndexAtOffset(draft, selection.end)
  const requestedSelectionProps = requestedCaret >= 0 ? {
    cursor: requestedCaret,
    selectionStart: requestedCaret,
    selectionEnd: requestedCaret
  } : {}
  const textareaValueProps = { value: draft }

  const updateDraft = (nextValue: string) => {
    draftRef.current = nextValue
    setDraft(nextValue)
    onChangeRef.current(nextValue)
  }

  const revealCaret = (textarea: HTMLTextAreaElement, caret: number) => {
    const nextScrollTop = scrollTopForCaret(
      draftRef.current,
      caret,
      textarea
    )
    if (nextScrollTop !== textarea.scrollTop) textarea.scrollTop = nextScrollTop
    setEditorScrollTop(nextScrollTop)
    textarea.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  const requestCaret = (caret: number, textarea?: HTMLTextAreaElement) => {
    const safeCaret = Math.max(0, Math.min(caret, draftRef.current.length))
    setSelection({ start: safeCaret, end: safeCaret })
    if (process.env.TARO_ENV === 'h5') {
      const nativeTextarea = textarea || textareaRef.current?.querySelector('textarea')
      if (!nativeTextarea) return
      nativeTextarea.value = draftRef.current
      nativeTextarea.setSelectionRange(safeCaret, safeCaret)
      // Keep Taro's internal textarea state in sync with the value inserted by
      // the custom Enter handler. Otherwise its next render can restore the
      // pre-continuation value and pull the caret back before newly typed text.
      nativeTextarea.dispatchEvent(new Event('input', { bubbles: true }))
      nativeTextarea.setSelectionRange(safeCaret, safeCaret)
      revealCaret(nativeTextarea, safeCaret)
      setRequestedCaret(-1)
      return
    }
    setRequestedCaret(safeCaret)
  }

  const syncSelection = (textarea: HTMLTextAreaElement) => {
    const start = textarea.selectionStart ?? textarea.value.length
    const end = textarea.selectionEnd ?? start
    setSelection((current) => (
      current.start === start && current.end === end ? current : { start, end }
    ))
  }

  const beginEditing = () => {
    focusedRef.current = true
    setFocused(true)
  }

  const finishEditing = () => {
    if (!focusedRef.current) return
    pointerDownRef.current = false
    focusedRef.current = false
    onCommitRef.current(draftRef.current, 'edit')
    setFocused(false)
  }

  const applyEnter = (
    selectionStart: number,
    selectionEnd: number,
    textarea?: HTMLTextAreaElement
  ) => {
    const result = applyEnterAtSelection(draftRef.current, selectionStart, selectionEnd)
    updateDraft(result.value)
    onCommitRef.current(result.value, 'edit')
    requestCaret(result.caret, textarea)
  }
  syncSelectionRef.current = syncSelection
  applyEnterRef.current = applyEnter

  if (!nativePropsRef.current) {
    const syncNativeSelection = (event: Event) => {
      const textarea = textareaFromEvent(event)
      if (textarea) syncSelectionRef.current(textarea)
    }
    nativePropsRef.current = {
      spellCheck: false,
      onSelect: (event: Event) => {
        if (pointerDownRef.current) return
        syncNativeSelection(event)
      },
      onKeyUp: syncNativeSelection,
      onMouseDown: (event: MouseEvent) => {
        const textarea = textareaFromEvent(event)
        if (!textarea) return
        pointerDownRef.current = true
        pointerCaretRef.current = caretAtPointer(
          textarea,
          event.clientX,
          event.clientY
        )
      },
      onMouseUp: (event: MouseEvent) => {
        const textarea = textareaFromEvent(event)
        if (!textarea) return
        const pointerCaret = pointerCaretRef.current
        pointerCaretRef.current = null
        pointerDownRef.current = false
        if (pointerCaret !== null && textarea.selectionStart === textarea.selectionEnd) {
          textarea.setSelectionRange(pointerCaret, pointerCaret)
        }
        syncSelectionRef.current(textarea)
      },
      onScroll: (event: Event) => {
        const textarea = textareaFromEvent(event)
        if (textarea) setEditorScrollTop(textarea.scrollTop)
      },
      onKeyDown: (event: KeyboardEvent) => {
        if (event.isComposing) return
        if (
          ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) &&
          !event.altKey && !event.ctrlKey && !event.metaKey
        ) {
          event.preventDefault()
          const textarea = textareaFromEvent(event)
          if (!textarea) return
          applyArrowSelection(textarea, event.key as ArrowKey, event.shiftKey)
          syncSelectionRef.current(textarea)
          const caret = event.shiftKey
            ? (textarea.selectionDirection === 'backward' ? textarea.selectionStart : textarea.selectionEnd)
            : textarea.selectionStart
          revealCaret(textarea, caret ?? 0)
          return
        }
        if (event.key !== 'Enter') return
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
        event.preventDefault()
        const textarea = textareaFromEvent(event)
        if (!textarea) return
        applyEnterRef.current(
          textarea.selectionStart ?? textarea.value.length,
          textarea.selectionEnd ?? textarea.value.length,
          textarea
        )
      }
    }
  }

  useEffect(() => {
    if (focusedRef.current || value === draftRef.current) return
    draftRef.current = value
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (process.env.TARO_ENV !== 'h5') return
    const textareaRoot = textareaRef.current
    const handlers = nativePropsRef.current
    if (!textareaRoot || !handlers) return
    const listeners: Array<[string, EventListener]> = [
      ['select', handlers.onSelect as EventListener],
      ['keyup', handlers.onKeyUp as EventListener],
      ['mousedown', handlers.onMouseDown as EventListener],
      ['mouseup', handlers.onMouseUp as EventListener],
      ['scroll', handlers.onScroll as EventListener],
      ['keydown', handlers.onKeyDown as EventListener]
    ]
    listeners.forEach(([name, listener]) => textareaRoot.addEventListener(name, listener, true))
    return () => {
      listeners.forEach(([name, listener]) => textareaRoot.removeEventListener(name, listener, true))
    }
  }, [])

  useEffect(() => {
    if (process.env.TARO_ENV !== 'h5') return
    const textarea = textareaRef.current?.querySelector('textarea')
    if (!textarea || textarea.value === draft) return
    const start = Math.min(textarea.selectionStart ?? draft.length, draft.length)
    const end = Math.min(textarea.selectionEnd ?? start, draft.length)
    textarea.value = draft
    textarea.setSelectionRange(start, end)
  }, [draft])

  useLayoutEffect(() => {
    if (process.env.TARO_ENV !== 'h5' || !focusedRef.current) return
    const textarea = textareaRef.current?.querySelector('textarea')
    if (!textarea) return
    revealCaret(textarea, textarea.selectionStart ?? draft.length)
  }, [draft])

  useEffect(() => () => {
    if (focusedRef.current) onCommitRef.current(draftRef.current, 'edit')
  }, [])

  const toggleTask = (lineIndex: number) => {
    const nextValue = toggleTaskAtLine(draftRef.current, lineIndex)
    if (nextValue === draftRef.current) return
    updateDraft(nextValue)
    onCommitRef.current(nextValue, 'task')
  }

  return (
    <View className={`line-md-editor ${className || ''}`.trim()}>
      <View className='line-md-continuous'>
        <View
          className='line-md-live-layer'
          style={{ transform: `translateY(-${editorScrollTop}px)` }}
        >
          {lines.map((line, index) => {
            const showSource = focused && index >= selectionStartLine && index <= selectionEndLine
            const sourceText = line || (onlyEmptyLine ? '补充步骤、背景或任何小细节…' : '\u00a0')
            return (
              <View
                key={`live-line-${index}`}
                className={`line-md-live-row ${showSource ? 'source' : 'rendered'}`}
              >
                <Text
                  className={`line-md-live-measure ${showSource ? 'visible' : ''} ${onlyEmptyLine ? 'placeholder' : ''}`}
                >
                  {sourceText}
                </Text>
                {!showSource && line.trim() ? (
                  <View className='line-md-live-rendered'>
                    <MarkdownView
                      className='line-md-preview line-md-live-preview'
                      source={line}
                      taskToggleMode='checkbox'
                      onToggleTask={() => toggleTask(index)}
                    />
                  </View>
                ) : null}
              </View>
            )
          })}
        </View>
        <Textarea
          ref={textareaRef}
          className='line-md-textarea'
          {...textareaValueProps}
          fixed
          {...requestedSelectionProps}
          maxlength={-1}
          confirmType='return'
          confirmHold
          ariaLabel='编辑任务详情'
          onFocus={beginEditing}
          onInput={(event) => {
            const nextValue = event.detail.value.replace(/\r\n?/g, '\n')
            const cursor = event.detail.cursor
            if (isSingleNewlineInsertion(draftRef.current, nextValue, cursor)) {
              applyEnter(
                cursor - 1,
                cursor - 1,
                textareaRef.current?.querySelector('textarea') || undefined
              )
              return
            }
            updateDraft(nextValue)
            if (cursor >= 0) setSelection({ start: cursor, end: cursor })
          }}
          onBlur={finishEditing}
        />
      </View>
    </View>
  )
}
