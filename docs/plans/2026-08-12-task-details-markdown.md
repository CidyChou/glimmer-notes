# Task Details Markdown Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 任务详情支持基础 Markdown：阅读渲染、编辑预览、任务清单可勾选写回，列表摘要去格式。

**Architecture:** 自研轻量解析（`src/utils/markdown.ts`）产出 AST；`MarkdownView` 用 Taro 组件渲染；`DetailSheet` 默认阅读模式，编辑时源码/预览切换；清单通过行号改写源码后保存。不改 `idea.text` schema 与同步协议。

**Tech Stack:** Taro 4 + React + TypeScript；测试用现有 `tsx --test`；无第三方 markdown 库。

**Design doc:** `docs/plans/2026-08-12-task-details-markdown-design.md`

---

### Task 1: Markdown AST types + parse block structure (TDD)

**Files:**
- Create: `src/utils/markdown.ts`
- Create: `src/utils/markdown.test.ts`
- Modify: `package.json` (add `"test:markdown": "tsx --test src/utils/markdown.test.ts"` if useful)

**Step 1: Write the failing test**

```ts
// src/utils/markdown.test.ts
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
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test src/utils/markdown.test.ts`  
Expected: FAIL (module / `parseMarkdown` missing)

**Step 3: Write minimal implementation**

Define AST types and `parseMarkdown` that:

- Normalizes `\r\n` → `\n`
- Splits lines; tracks original line index for each source line
- Detects: `#{1,3} `, `> `, `- [ ]` / `- [x]` / `- [X]`, `- ` / `* `, ordered `^\d+\. `, else paragraph
- Groups consecutive list lines into one `list` node; consecutive `>` into one `blockquote`
- Blank lines separate blocks
- Inline content can be plain string first; Task 2 adds inline parse

Suggested types (adjust names as needed, keep consistent):

```ts
export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: InlineNode[] }
  | { type: 'em'; children: InlineNode[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: InlineNode[] }

export type BlockNode =
  | { type: 'heading'; level: 1 | 2 | 3; children: InlineNode[] }
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'blockquote'; children: InlineNode[] }
  | {
      type: 'list'
      ordered: boolean
      items: Array<{
        task?: boolean
        checked?: boolean
        lineIndex: number
        children: InlineNode[]
      }>
    }

export function parseMarkdown(source: string): BlockNode[]
```

**Step 4: Run tests — expect PASS for block structure tests**

**Step 5: Commit**

```bash
git add src/utils/markdown.ts src/utils/markdown.test.ts package.json
git commit -m "feat(markdown): add lightweight block parser"
```

---

### Task 2: Inline parsing + stripMarkdown + toggleTaskAtLine (TDD)

**Files:**
- Modify: `src/utils/markdown.ts`
- Modify: `src/utils/markdown.test.ts`

**Step 1: Write failing tests**

```ts
import { parseMarkdown, stripMarkdown, toggleTaskAtLine } from './markdown'

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
```

**Step 2: Run tests — expect FAIL on new cases**

**Step 3: Implement**

- `parseInline(text: string): InlineNode[]` — left-to-right scan for `` `...` ``, `[text](url)`, `**...**`, `*...*` / `_..._` (no nest explosion; prefer simple non-greedy match)
- Apply `parseInline` to heading/paragraph/quote/list item text
- `toggleTaskAtLine(source, lineIndex)`: split lines, match `/^(\s*)([-*])\s+\[([ xX])\](.*)$/` , flip checkbox, rejoin
- `stripMarkdown`: walk AST or regex-light strip markers; collapse whitespace to single line

**Step 4: Run full markdown tests — PASS**

**Step 5: Commit**

```bash
git add src/utils/markdown.ts src/utils/markdown.test.ts
git commit -m "feat(markdown): inline parse, task toggle, strip for summary"
```

---

### Task 3: MarkdownView component

**Files:**
- Create: `src/components/MarkdownView/index.tsx`
- Create: `src/components/MarkdownView/index.css`

**Step 1: Implement component**

```tsx
// Props
interface Props {
  source: string
  onToggleTask?: (lineIndex: number) => void
  className?: string
}
```

- Call `parseMarkdown(source)`
- Map blocks to Taro `View`/`Text`
- Task items: row with checkbox control (`View` role=button); `onClick` → `onToggleTask?.(item.lineIndex)` when provided
- Links: `Text` with class; `onClick` → `Taro.setClipboardData` or `Taro.openUrl` / H5 `window.open` for https only — prefer `Taro.openUrl` if available, else copy URL fallback consistent with app style
- Empty source: render nothing (parent shows empty hint)

CSS: use theme vars; checklist completed state strikethrough + muted; code chip; blockquote left border; compact spacing matching DetailSheet density.

**Step 2: Typecheck**

Run: `npm run typecheck`  
Expected: no errors from new files

**Step 3: Commit**

```bash
git add src/components/MarkdownView
git commit -m "feat(ui): add MarkdownView renderer"
```

---

### Task 4: DetailSheet read / edit / preview modes

**Files:**
- Modify: `src/components/DetailSheet/index.tsx`
- Modify: `src/components/DetailSheet/index.css`
- Modify: `src/pages/index/index.tsx` (save path for checklist without closing sheet)

**Step 1: Extend save API if needed**

Current:

```ts
onSave: (title: string, details: string) => void
// saveSelected closes sheet via setSelectedId(null)
```

Add optional:

```ts
onSave: (title: string, details: string, options?: { keepOpen?: boolean }) => void
```

Or separate:

```ts
onPatchDetails: (details: string) => void  // keep open, history label 更新清单
```

Implement in `index.tsx`:

- Full save: existing close + flash `修改已保存` + label `编辑任务`
- Patch details only: update idea, `recordIdeaChange` label `更新清单`, **do not** `setSelectedId(null)`

**Step 2: DetailSheet state machine**

```ts
type EditorMode = 'read' | 'edit'
const [mode, setMode] = useState<EditorMode>('read')
const [editTab, setEditTab] = useState<'source' | 'preview'>('source')
// title/details draft only used in edit; re-init when idea.id changes
```

When `idea.id` changes (key on component or `useEffect`): reset mode to `read`, re-sync title/details from `splitIdeaText(idea.text)`.

**Read mode UI:**

- Show title as `Text` (not Input)
- `MarkdownView` for details; empty → hint text
- Button「编辑内容」→ `setMode('edit')`, seed draft from current idea
- Checklist: `onToggleTask` → `toggleTaskAtLine` → `onPatchDetails` / `onSave(..., { keepOpen: true })` with **current title** + new details from idea (not draft)

**Edit mode UI:**

- Existing title Input + details Textarea when `editTab === 'source'`
- When `editTab === 'preview'`: `MarkdownView` with draft; toggle only updates local `details` state
- Tab control 源码 | 预览
- Save: require title; call `onSave(title, details)` (closes as today)
- Cancel: discard draft, `setMode('read')`
- Keep priority/tags/actions below as today

**Step 3: CSS for mode switcher, read title, empty hint**

**Step 4: Typecheck + manual mental check of close/open**

**Step 5: Commit**

```bash
git add src/components/DetailSheet src/pages/index/index.tsx
git commit -m "feat(detail): read/edit markdown modes and live checklist"
```

---

### Task 5: List summaries + Composer hint

**Files:**
- Modify: `src/components/OrganizeView/index.tsx` — replace `content.details.replace(/\s+/g, ' ')` with `stripMarkdown(content.details)`
- Modify: `src/pages/archive/index.tsx` — same
- Modify: `src/components/ComposerSheet/index.tsx` — helper text e.g. `支持基础 Markdown（列表、粗体、清单）`
- Modify: `src/components/ComposerSheet/index.css` if needed

**Step 1: Wire stripMarkdown imports and Composer copy**

**Step 2: Typecheck**

Run: `npm run typecheck`

**Step 3: Run unit tests**

Run: `npx tsx --test src/utils/markdown.test.ts`  
Expected: all PASS

**Step 4: Commit**

```bash
git add src/components/OrganizeView src/pages/archive src/components/ComposerSheet
git commit -m "feat: strip markdown in lists; hint markdown in composer"
```

---

### Task 6: Verification pass

**Step 1: Full automated checks**

```bash
npm run typecheck
npx tsx --test src/utils/markdown.test.ts
npm run test:history   # ensure history stack still green
```

**Step 2: Manual checklist (H5 if dev server available)**

1. 打开任务 → 默认阅读，无编辑框
2. 写含 `**粗体**`、列表、`- [ ]` 的详情 → 预览正确 → 保存 → 阅读渲染正确
3. 阅读中点清单 → 立刻变为完成样式，关开后仍保持；撤销应能回退（`更新清单`）
4. 编辑预览勾选 → 未保存前不落盘；保存后落盘
5. 整理页摘要无 `**` / `- [ ]` 符号噪音
6. 复制仍为源码

**Step 3: Final commit if polish only**

```bash
git add -A
git commit -m "chore: polish markdown detail UX"
```

---

## Execution notes

- Prefer TDD for `markdown.ts` (Tasks 1–2) before UI.
- Do not add `marked` / `markdown-it` / `dangerouslySetInnerHTML` for core path.
- Weapp-safe: only Taro `View`/`Text`/`Button`, no raw HTML.
- Keep commits small and green.

## Handoff

After plan approval, execute with:

1. **Subagent-Driven** (this session) — `superpowers:subagent-driven-development`
2. **Parallel Session** — new session with `superpowers:executing-plans`
