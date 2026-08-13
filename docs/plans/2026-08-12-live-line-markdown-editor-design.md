# 按行实时 Markdown 编辑器设计

**日期：** 2026-08-12  
**状态：** 已实现（2026-08-13）
**前置：** 任务详情基础 Markdown（方案 A）已落地

## 问题

当前详情是「阅读渲染 / 点编辑进源码 / 源码|预览 Tab」。用户期望：

1. **不必点编辑按钮切换**：只有正在编辑的那一行显示源码，其它行始终渲染 Markdown。
2. **列表自动续行**：`1.` / `-` / `- [ ]` 回车后自动补下一行前缀。
3. **失焦/换行即自动保存**，不必再点「保存修改」。

## 目标

- 详情区改为 **按行混合编辑器（Live Line Markdown）**。
- 聚焦行 = 源码输入；未聚焦行 = Markdown 渲染。
- 勾选框与「点文案进入编辑」分离。
- 列表（有序 / 无序 / 任务）回车续行；空列表项再回车结束列表。
- 失焦、换行、勾选 → 自动写回 `idea.text`（面板保持打开）。
- 存储仍为纯文本 markdown，不改 schema / sync。

## 非目标（首版）

- 真 WYSIWYG（一行内混排光标）
- 表格、围栏代码块、拖拽排序行
- Composer 新建同步改成行编辑器（二期）
- 完整「纯源码」模式（可选二期）

## 为什么不能继续用整段 Textarea

原生 `Textarea` 只能是纯文本，无法在「第 10 行编辑时把 1–9 行画成渲染结果」。必须按行拆成块：聚焦行用 `Input`，其它行用渲染组件。

## 交互

| 操作 | 行为 |
|------|------|
| 点普通渲染行 / 点清单文案 | `focusedIndex = i`，显示源码 |
| 点清单勾选框 | 切换 `- [ ]`/`- [x]`，不聚焦编辑，立刻保存 |
| 行失焦 | 该行回渲染；保存详情 |
| 回车（确认） | 在焦点行后插入新行并续前缀；焦点移到新行；保存 |
| 仅有列表前缀、内容空再回车 | 清除前缀，退出列表 |
| 标题 | 点编辑 / 失焦自动保存（可仍用单独 Input） |
| 关闭面板 | 若当前行仍聚焦，先 blur 保存再关 |

去掉首版中的「编辑内容」按钮与「源码 | 预览」Tab。

### 保存与历史

- 写回：更新 `idea.text`（`composeIdeaText(title, details)`）+ `updatedAt`，**不关面板**。
- 历史：建议 **每次失焦/换行/勾选各记一条**，label 如 `编辑详情` / `更新清单`；避免按键级记录。
- 若内容未变，不写历史。

## 列表续行规则

函数：`continueListMarker(line: string): { nextLine: string } | { endList: true } | null`

| 当前行（trim 后匹配） | 回车结果 |
|----------------------|----------|
| `^(\s*)(\d+)\.\s+(.*\S.*)$` | 新行：`indent + (n+1) + ". "` |
| `^(\s*)(\d+)\.\s*$`（仅前缀） | 结束列表：当前行变空 |
| `^(\s*)([-*])\s+\[([ xX])\]\s+(.*\S.*)$` | 新行：`indent + "- [ ] "` |
| `^(\s*)([-*])\s+\[([ xX])\]\s*$` | 结束列表 |
| `^(\s*)([-*])\s+(.*\S.*)$` | 新行：`indent + marker + " "` |
| `^(\s*)([-*])\s*$` | 结束列表 |
| 其它 | 普通新空行 `""`（仍插入一行） |

有内容时回车：当前行保留，下方插入 `nextLine`，焦点到新行。  
空列表前缀再回车：当前行清空为 `""`，不新增行（或删除该行），焦点仍在该行。

## 架构

```
details: string
    ↔  lines: string[]   (split/join \n，保留空行)
         │
         ▼
LineMarkdownEditor
  focusedIndex: number | null
  onChange(lines) / onCommit(details)
  onToggleTask(lineIndex) → toggleTaskAtLine → commit

每行：
  focused → Input (value=line, focus, onBlur, onConfirm)
  else    → LinePreview (单行 markdown 渲染 + 清单勾选 hit 区)
```

### 新增 / 修改

| 路径 | 职责 |
|------|------|
| `src/utils/listContinue.ts`（或并入 `markdown.ts`） | 续行 / 结束列表 |
| `src/utils/listContinue.test.ts` | 单测 |
| `src/components/LineMarkdownEditor/` | 行编辑器 UI |
| `src/components/MarkdownView/` | 可抽「单行/块预览」或编辑器内轻量渲染 |
| `src/components/DetailSheet/` | 去掉 read/edit 双模；接自动保存 |
| `src/pages/index/index.tsx` | `patchSelectedContent` / 失焦保存不关面板；勾选走现有 toggle |

## 渲染注意

- **单行预览**：对 `lines[i]` 用现有 `parseMarkdown` 时，单独一行会变成独立 block（一个 list item 或 paragraph）。整份 details 仍用 `join` 后全量 parse 也可，但行编辑时按行 parse 更简单。
- 多行引用 `>` 在「按行」模型下每行独立，可接受。
- 行内 `**` 等仅在该行渲染。

## 焦点与小程序风险

- Taro `Input` 的 `focus` 布尔控制；切换行时先设 index 再 focus。
- `onBlur` 与「点下一行」竞争：用短 `requestAnimationFrame` / `setTimeout(0)` 延迟清空 focus，避免点下一行时先 blur 丢焦点。
- 软键盘顶起 sheet：保持现有 sheet 可滚。

## 测试

- `continueListMarker`：有序递增、任务默认未完成、空前缀结束列表、缩进保留
- 行 join/split 往返（含尾空行策略：与 `split('\n')` 一致）
- 不强制组件 E2E 首版；手动验收清单见实现计划

## 决策记录

- 用户确认：按行混合编辑，不做整段 Textarea 混排。
- 保存：失焦/换行自动保存。
- 清单：勾选框切换完成；点文案进入行编辑。
- Composer 首版不改造。
