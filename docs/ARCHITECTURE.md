# Idea Space V3 架构

## 当前产品结构

只有两个主视图：

1. **空间**：Canvas 2D 灵感节点、漂浮、连线、拖拽归类。
2. **整理**：同一份 Idea 数据，使用 Swiper 左右切换四种优先级，以时间流显示。

四种优先级：

- `inbox`：碎片池 / 尚未整理 / 不重要且不紧急
- `urgent`：现在做 / 重要且紧急
- `important`：计划做 / 重要非紧急
- `quick`：快处理 / 非重要但紧急

拖动空间里的 Idea 时，只浮出后三个动作。没有命中动作，则 Idea 继续留在碎片池。

## 分层

- `pages/index`：页面组合与顶层状态
- `components/IdeaSpaceCanvas`：Canvas 2D 绘制与拖拽手势
- `components/OrganizeView`：Swiper + 时间流
- `components/BottomBar`：日报 + 拖拽动作 Dock + 新增按钮
- `components/ComposerSheet`：快速记录
- `components/DetailSheet`：详情、优先级、收藏、删除
- `services/ideaStorage`：Taro Storage，本地优先
- `types/idea.ts`：数据模型
- `constants/priorities.ts`：优先级定义

## 为什么 Canvas 只负责 Idea Space

文字输入、时间流、弹层、按钮全部使用 Taro 原生组件；Canvas 只负责需要高自由度绘制的节点、连线、光晕与空间拖拽。这样后续编译微信/抖音/H5 时，编辑和列表交互更稳定。

## 后续扩展建议

- 服务端同步：新增 `services/sync`，不修改页面数据模型。
- AI 关联：在 Idea 上新增 links/embedding 元信息，Canvas 根据 links 绘制真实关系线。
- Web 版：当前 Taro 可直接输出 H5；若未来 Web 变成重度工作台，再决定是否独立 React Web。
