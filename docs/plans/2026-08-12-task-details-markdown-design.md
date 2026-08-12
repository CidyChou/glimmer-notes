# 任务详情基础 Markdown 设计

**日期：** 2026-08-12  
**状态：** 已确认  
**方案：** A — 自研轻量子集渲染

## 问题

任务详情（`DetailSheet` / `ComposerSheet`）目前是纯文本 `Textarea`。用户希望详情支持基础 Markdown：编辑时可预览，查看时渲染，任务清单可点击勾选并写回源码。

## 目标

1. 详情仍以 **Markdown 源码字符串** 存储（兼容现有 `idea.text`，不改后端 schema / sync 协议）。
2. **阅读模式**渲染基础格式；**编辑模式**编辑源码并可切换预览。
3. 任务清单 `- [ ]` / `- [x]` 可点击，写回 details 并保存。
4. 整理页 / 归档列表继续一行纯文本摘要（去掉标记，不渲染格式）。

## 非目标（YAGNI）

- 所见即所得编辑器、工具栏插入语法
- 表格、图片、围栏代码块、HTML
- 列表行内渲染 Markdown
- 新建 `ComposerSheet` 完整预览（二期可选）
- Canvas 节点绘制 Markdown

## 架构

```
details 源码 (string)
    │
    ├─ parseMarkdown(source) → AST
    │       └─ MarkdownView 渲染（阅读 / 预览）
    │
    ├─ toggleTaskAtLine(source, lineIndex) → 新源码
    │       └─ 阅读模式即时 onSave / 编辑预览只改草稿
    │
    └─ stripMarkdown(source) → 一行摘要
            └─ OrganizeView / archive 列表
```

数据层不变：`composeIdeaText(title, details)` / `splitIdeaText` 继续使用。`idea.text` 第一行为标题，其后为 details 源码。

## 组件

| 路径 | 职责 |
|------|------|
| `src/utils/markdown.ts` | 解析、清单写回、摘要去格式 |
| `src/utils/markdown.test.ts` | 单元测试 |
| `src/components/MarkdownView/` | AST → Taro View/Text；清单可点 |
| `src/components/DetailSheet/` | 阅读 / 编辑 / 预览三态 |
| `src/components/ComposerSheet/` | 轻提示「支持基础 Markdown」 |
| `src/components/OrganizeView/` | 摘要用 `stripMarkdown` |
| `src/pages/archive/` | 同上 |
| `src/pages/index/index.tsx` | 勾选保存可不关面板 |

## DetailSheet 交互

**默认：阅读模式**

- 标题：纯文本
- 详情：`MarkdownView`；清单点击 → 写回 → 保存（面板不关）
- 「编辑内容」→ 进入编辑模式

**编辑模式**

- 标题 `Input` + 详情 `Textarea`（源码）
- 分段控件：源码 | 预览（预览复用 `MarkdownView`）
- 预览内勾选只改本地草稿，点「保存修改」才落盘
- 未保存提示 + 保存 / 取消（取消丢弃草稿回阅读）

项目、标签、优先级、收藏、复制、归档、删除等操作区保持现状。

## Markdown 子集

### 块级

| 语法 | 说明 |
|------|------|
| 空行 | 分段 |
| `#` `##` `###` | 标题（最多三级） |
| `> ...` | 引用（可连续多行） |
| `- ` / `* ` | 无序列表 |
| `1. ` | 有序列表 |
| `- [ ]` / `- [x]` / `- [X]` | 任务清单 |
| 其它行 | 普通段落 |

### 行内

| 语法 | 说明 |
|------|------|
| `**粗体**` | 粗体 |
| `*斜体*` / `_斜体_` | 斜体 |
| `` `代码` `` | 行内代码 |
| `[文字](url)` | 仅 `http(s)://` 可点；其它当纯文本 |

### 清单写回

1. 解析时为每个 task item 记录**源码行号**（0-based 或 1-based，实现统一即可）。
2. 点击：在该行将 `- [ ]` ↔ `- [x]`（保留缩进与后续文案）。
3. 拼回完整 `details`。
4. 阅读：`onSave(title, nextDetails)` 或专用 `onDetailsPatch`，**不关面板**。
5. 编辑预览：只更新本地 `details` 草稿。

### 列表摘要

`stripMarkdown(details)`：去掉标题/列表/强调/链接等标记，空白压成单行空格，用于整理与归档卡片。

### 复制

继续复制完整 `idea.text`（含 Markdown 源码）。

## 视觉

- 使用现有主题 CSS 变量（`--text-*`、`--accent`、`--surface-*`）
- 阅读详情约 14px / 行高 1.55
- 清单：可点勾选框；已完成 `text-muted` + 删除线
- 行内代码：浅底、略小字号
- 引用：左侧 accent 竖线
- 链接：accent 色
- 间距克制，贴合当前 sheet 密度

## 边界情况

| 情况 | 处理 |
|------|------|
| 空详情 | 弱提示「暂无详情，点编辑补充」 |
| 未闭合标记 | 当普通文本 |
| `javascript:` 等链接 | 不当可点链接 |
| 极长详情 | 阅读区滚动；编辑保持现有 max-height |
| 切换任务 / 关面板 | 丢弃未保存草稿 |
| 已有 markdown 文本 | 无需迁移，直接解析 |

## 历史与同步

- 全文编辑保存：现有 `saveSelected` + `recordIdeaChange`（`编辑任务`）
- 仅勾选：同一写回路径，label `更新清单`；不关面板
- 仍只更新 `idea.text` + `updatedAt`，sync 兼容

## 测试

- 解析：标题、列表、引用、行内组合
- 清单识别与 `toggleTaskAtLine`
- `stripMarkdown` 摘要
- 残缺/非法输入不抛错

## 决策记录

- 方案 A 自研子集，不引入 markdown 库（包体、小程序兼容、勾选写回）。
- 用户确认：编辑预览 + 查看渲染；语法含任务清单；清单可勾选写回。
- Composer 首版仅文案提示，不做完整预览。
