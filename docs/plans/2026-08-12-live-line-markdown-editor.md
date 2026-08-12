# Live Line Markdown Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 详情区改为按行混合编辑：未聚焦行渲染 Markdown，聚焦行编辑源码；列表回车自动续前缀；失焦/换行/勾选自动保存。

**Architecture:** 将 details 按 `\n` 拆成 `string[]`。`LineMarkdownEditor` 管理 `focusedIndex`；聚焦行用 Taro `Input`，其它行单行渲染；`continueListMarker` 处理回车续行。DetailSheet 去掉 read/edit Tab，标题与详情均自动写回（不关面板）。存储仍为 `composeIdeaText` 纯文本。

**Tech Stack:** Taro 4 + React + TS；现有 `@/utils/markdown`；`tsx --test` 单测。

**Design doc:** `docs/plans/2026-08-12-live-line-markdown-editor-design.md`

---

### Task 1: list continue pure helpers (TDD)

**Files:**
- Create: `src/utils/listContinue.ts`
- Create: `src/utils/listContinue.test.ts`
- Modify: `package.json` — add `"test:list-continue": "tsx --test src/utils/listContinue.test.ts"` (optional; or reuse a combined script)

**Step 1: Write failing tests**

```ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { continueListMarker } from './listContinue'

describe('continueListMarker', () => {
  it('increments ordered list', () => {
    assert.deepEqual(continueListMarker('1. first'), { type: 'continue', prefix: '2. ' })
    assert.deepEqual(continueListMarker('  9. item'), { type: 'continue', prefix: '  10. ' })
  })

  it('continues unordered and task lists', () => {
    assert.deepEqual(continueListMarker('- item'), { type: 'continue', prefix: '- ' })
    assert.deepEqual(continueListMarker('* item'), { type: 'continue', prefix: '* ' })
    assert.deepEqual(continueListMarker('- [x] done'), { type: 'continue', prefix: '- [ ] ' })
    assert.deepEqual(continueListMarker('  - [ ] todo'), { type: 'continue', prefix: '  - [ ] ' })
  })

  it('ends list when marker-only line', () => {
    assert.deepEqual(continueListMarker('1. '), { type: 'end' })
    assert.deepEqual(continueListMarker('- '), { type: 'end' })
    assert.deepEqual(continueListMarker('- [ ] '), { type: 'end' })
  })

  it('returns plain continue empty for normal paragraphs', () => {
    assert.deepEqual(continueListMarker('hello'), { type: 'continue', prefix: '' })
  })
})
```

**Step 2:** `npx tsx --test src/utils/listContinue.test.ts` → FAIL

**Step 3: Implement**

```ts
export type ContinueResult =
  | { type: 'continue'; prefix: string }
  | { type: 'end' }

export function continueListMarker(line: string): ContinueResult {
  // ordered with content → continue n+1
  // ordered empty marker → end
  // task with content → '- [ ] ' with indent
  // task empty → end
  // bullet with content → same bullet
  // bullet empty → end
  // else → { type: 'continue', prefix: '' }
}
```

Match design regexes; task before plain bullet.

**Step 4:** tests PASS

**Step 5: Commit**

```bash
git add src/utils/listContinue.ts src/utils/listContinue.test.ts package.json
git commit -m "feat(markdown): list continue/end helpers"
```

---

### Task 2: line split/join + applyEnter helpers (TDD)

**Files:**
- Modify: `src/utils/listContinue.ts` (or new `src/utils/lineEditor.ts`)
- Modify: tests

**Step 1: Tests**

```ts
import { applyEnterAtLine, linesFromDetails, detailsFromLines } from './listContinue' // or lineEditor

it('roundtrips lines', () => {
  assert.deepEqual(linesFromDetails('a\n\nb'), ['a', '', 'b'])
  assert.equal(detailsFromLines(['a', '', 'b']), 'a\n\nb')
  assert.deepEqual(linesFromDetails(''), ['']) // one empty line for empty editor
})

it('applyEnter continues ordered list', () => {
  const r = applyEnterAtLine(['1. a'], 0)
  assert.deepEqual(r.lines, ['1. a', '2. '])
  assert.equal(r.focusIndex, 1)
})

it('applyEnter ends empty ordered marker', () => {
  const r = applyEnterAtLine(['1. a', '2. '], 1)
  assert.deepEqual(r.lines, ['1. a', ''])
  assert.equal(r.focusIndex, 1)
})
```

**Step 2–4:** implement `linesFromDetails`, `detailsFromLines`, `applyEnterAtLine(lines, index)` using `continueListMarker`

**Step 5: Commit**

```bash
git commit -m "feat(markdown): line enter applies list continue"
```

---

### Task 3: LineMarkdownEditor component

**Files:**
- Create: `src/components/LineMarkdownEditor/index.tsx`
- Create: `src/components/LineMarkdownEditor/index.css`

**Props:**

```ts
interface Props {
  value: string // full details source
  onChange: (value: string) => void // every local edit
  onCommit: (value: string) => void // blur / enter / toggle — parent may persist
  onToggleTaskLine?: (lineIndex: number) => void // optional; if absent, toggle via onChange+onCommit
  className?: string
}
```

**Behavior:**
1. Internal `lines` state synced from `value` when `value` changes and editor is not mid-edit (compare join).
2. `focusedIndex: number | null` — null means all preview.
3. Render map lines:
   - if `i === focusedIndex`: `Input` with `focus`, `value={lines[i]}`, `onInput` update line, `onBlur` → set focused null + `onCommit(join)`, `onConfirm` → `applyEnterAtLine` + focus next + `onCommit`
   - else: preview row; click body → set focusedIndex i; if task, checkbox separate click → toggle via `toggleTaskAtLine(detailsFromLines(lines), i)` then `onChange` + `onCommit` (or `onToggleTaskLine`)
4. Empty value: show one empty line; placeholder on focus.
5. After enter end-list: line becomes `''`, stay focused.

**Preview rendering:** For each non-focused line, call `parseMarkdown(line)` and render similar to MarkdownView but compact single-block (or reuse MarkdownView with `source={line}` and only pass `onToggleTask` when task). Checkbox must `stopPropagation` so it does not focus the line for edit.

**CSS:** match DetailSheet density; focused input transparent/caret accent; preview rows min-height ~36px for touch.

**Step:** typecheck; commit

```bash
git add src/components/LineMarkdownEditor
git commit -m "feat(ui): add LineMarkdownEditor"
```

---

### Task 4: Wire DetailSheet + auto-save parent

**Files:**
- Modify: `src/components/DetailSheet/index.tsx`
- Modify: `src/components/DetailSheet/index.css`
- Modify: `src/pages/index/index.tsx`

**DetailSheet:**
1. Remove `mode` read/edit and edit tabs.
2. Title: always editable `Input` OR click-to-edit; `onBlur` commit title+details if changed.
3. Body: `LineMarkdownEditor` with:
   - `value={live.details}` or local draft — prefer controlled from `idea` for title/details with local buffer that commits on blur
4. Recommended state:
   - `title` / `details` local, init from `live` when `idea.id` or external text changes (key on idea.id already)
   - `LineMarkdownEditor onChange={setDetails}` 
   - `onCommit={(d) => { setDetails(d); persist(title, d) }}`
5. `persist` calls new prop `onAutoSave(title, details)` that does **not** close sheet.

**index.tsx:**
```ts
const autoSaveSelected = (title: string, details: string) => {
  if (!selectedId || !title.trim()) return
  const current = ideasRef.current.find(...)
  const text = composeIdeaText(title, details)
  if (text === current.text) return
  const after = { ...current, text, updatedAt: Date.now() }
  commitIdeas(...)
  recordIdeaChange({ ..., label: '编辑详情' })
  // do NOT setSelectedId(null)
}
```

Keep `onToggleTaskLine` for checklist from LineMarkdownEditor (or route through autoSave with toggled details). Prefer existing `toggleSelectedTaskLine` for checklist to reuse race-safe ref.

Remove dependency on full-save-close for normal flow; optional keep explicit save if still needed — **YAGNI: no save button** if auto-save covers all. If title empty, block commit / flash 标题不能为空.

**Step:** typecheck; manual mental walkthrough; commit

```bash
git commit -m "feat(detail): live line editor with auto-save"
```

---

### Task 5: Focus race + empty states polish

**Files:**
- `LineMarkdownEditor`, `DetailSheet` CSS/TS

**Issues to handle:**
1. Blur vs next-line click: delay `setFocusedIndex(null)` by ~50ms; if new focus requested, cancel clear.
2. Empty details: one blank line; placeholder「补充步骤…」
3. After auto-save, parent updates `idea.text` — do not reset focus if still editing same idea (compare details carefully; only sync lines when `!focused` or external change).
4. Closing sheet: parent `onClose` — editor blur commits first if needed (`useEffect` cleanup commit).

**Commit:**

```bash
git commit -m "fix(editor): focus handoff and empty-line sync"
```

---

### Task 6: Verification

```bash
npm run typecheck
npx tsx --test src/utils/listContinue.test.ts
npm run test:markdown
npm run test:history
```

**Manual (H5):**
1. 打开任务：无「编辑内容」按钮；详情行均渲染
2. 点第 3 行 → 源码；其它行仍渲染
3. `1. a` 回车 → 出现 `2. ` 焦点在新行；失焦后两行渲染为有序列表
4. `- [ ] x` 回车 → `- [ ] `；点勾选不进入编辑且保存
5. 点清单文案进入编辑
6. 改标题失焦 → 持久化；关开后仍在
7. 撤销可回退 `编辑详情` / `更新清单`

**Commit** only if polish needed.

---

## Execution notes

- Do not reintroduce read/edit dual mode.
- Do not add third-party editors.
- Weapp-safe: Input/View/Text only.
- Prefer TDD for `listContinue` / `applyEnterAtLine`.

## Handoff

1. **Subagent-Driven (this session)**  
2. **Parallel Session** with executing-plans
