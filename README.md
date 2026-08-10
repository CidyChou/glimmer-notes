# Idea Space — Taro 正式项目版

这是从之前单 HTML 原型重构出的正式代码结构。

技术栈：

- Taro 4.2.1
- React 18
- TypeScript
- Canvas 2D
- Taro Storage（Local First）
- 微信小程序优先，同时预留 H5 / 抖音小程序构建脚本

## 目录

```text
idea-space-taro/
├── config/
├── docs/
├── src/
│   ├── components/
│   │   ├── IdeaSpaceCanvas/
│   │   ├── OrganizeView/
│   │   ├── BottomBar/
│   │   ├── ComposerSheet/
│   │   └── DetailSheet/
│   ├── constants/
│   ├── pages/index/
│   ├── services/
│   ├── types/
│   └── utils/
├── package.json
├── project.config.json
└── tsconfig.json
```

## 当前功能

- Idea Space Canvas 2D 粒子空间
- 节点漂浮、光晕、近距离连接线
- 点击 Idea 查看详情
- 拖拽 Idea，底部浮出三种优先级动作
- 默认新 Idea 进入「碎片池」
- 「整理」页面左右滑动：碎片池 / 现在做 / 计划做 / 快处理
- 时间流列表
- 搜索
- 收藏 / 删除
- Taro Storage 本地持久化

## 运行

先安装依赖：

```bash
npm install
```

### 微信小程序

```bash
npm run dev:weapp
```

然后使用微信开发者工具打开项目根目录。`project.config.json` 已把 `dist/` 配置为 `miniprogramRoot`。

首次真机开发时，把 `project.config.json` 的 `appid` 从 `touristappid` 替换成你自己的小程序 AppID。

### H5

```bash
npm run dev:h5
```

### 抖音小程序

```bash
npm run dev:tt
```

## 注意

`IdeaSpaceCanvas` 已分别处理：

- 微信/小程序：Taro SelectorQuery 获取 `type="2d"` Canvas node。
- H5：直接获取浏览器 Canvas，并绑定 pointer 事件，方便桌面浏览器调试。

这不是把 HTML 塞进 web-view；页面结构本身已经全部改成 Taro React 组件。

更多结构说明见 `docs/ARCHITECTURE.md`。
