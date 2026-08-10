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
- `pages/settings`：外观设置、皮肤预览与本地隐私说明
- `components/IdeaSpaceCanvas`：Canvas 2D 绘制与拖拽手势
- `components/OrganizeView`：Swiper + 时间流
- `components/BottomBar`：日报 + 拖拽动作 Dock + 新增按钮
- `components/ComposerSheet`：快速记录
- `components/DetailSheet`：详情、优先级、收藏、删除
- `services/ideaStorage`：Taro Storage，本地优先与旧数据迁移
- `services/sync`：单用户认证、同步队列、离线恢复与状态通知
- `backend`：Node.js 同步 API、冲突合并与原子 JSON 持久化
- `theme`：全局皮肤定义、CSS 变量映射、主题状态与持久化
- `types/idea.ts`：数据模型
- `constants/priorities.ts`：优先级定义

## 为什么 Canvas 只负责 Idea Space

文字输入、时间流、弹层、按钮全部使用 Taro 原生组件；Canvas 只负责需要高自由度绘制的节点、连线、光晕与空间拖拽。这样后续编译微信/抖音/H5 时，编辑和列表交互更稳定。

## 皮肤与颜色数据

可见颜色统一由 `ThemeDefinition` 提供。CSS 页面通过主题变量继承颜色，Canvas 和优先级组件直接读取同一主题对象。当前包含暗色“荧光夜”“暮光紫”和亮色“晨光纸”；亮暗皮肤分别提供高光、边框和阴影根值。Idea 只保存七槽 `colorSlot`，切换皮肤时按槽位解析当前色板；v3 的十六进制颜色会在读取时兼容迁移到 v4 数据。

## 服务端同步

- Idea 使用 `updatedAt` 表示最后修改时间；旧数据读取时回退到 `createdAt`。
- 删除记录独立保存为墓碑 `{ id, deletedAt }`，时间相同时删除优先。
- 客户端所有写入先落本地，再串行提交服务端；服务端不可用不阻塞编辑。
- 单用户口令只用于换取有期限的签名令牌，服务端不保存口令明文。
- H5 API 地址由 `TARO_APP_API_BASE_URL` 在构建阶段注入。

## 后续扩展建议

- 多用户同步：在现有同步协议上增加用户标识和用户级数据隔离。
- AI 关联：在 Idea 上新增 links/embedding 元信息，Canvas 根据 links 绘制真实关系线。
- Web 版：当前 Taro 可直接输出 H5；若未来 Web 变成重度工作台，再决定是否独立 React Web。
