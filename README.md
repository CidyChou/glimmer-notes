# Idea Space — Taro 正式项目版

这是从之前单 HTML 原型重构出的正式代码结构。

技术栈：

- Taro 4.2.1
- React 18
- TypeScript
- Canvas 2D
- Taro Storage（Local First）
- 单用户云端同步（Node.js + 原子 JSON 存储）
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

## 云端同步

客户端始终先写入本地存储。登录云端后，新增、编辑、归类和删除会自动同步；断网期间仍可正常使用，恢复连接后按照每条 Idea 的更新时间合并。删除通过墓碑记录传播，避免离线设备恢复已删除内容。

本地开发后端：

```bash
node backend/scripts/init-auth.mjs .env.backend
set -a && source .env.backend && set +a
npm run test:backend
node backend/main.mjs
```

H5 默认连接 106 服务器的 `http://106.55.78.71:8769`，本地执行 `npm run dev:h5` 时也使用这套云端数据。后端当前不限制网页来源；仅在需要临时切换后端时，才通过构建时变量 `TARO_APP_API_BASE_URL` 覆盖。

## 部署到 106 服务器

部署使用 SSH 别名 `tc`，远端目录为 `/data/work/server/glimmer-notes`：

```bash
make up_client   # H5 -> 106.55.78.71:8770
make up_backend  # API -> 106.55.78.71:8769
make up_106      # 依次部署后端和客户端
```

首次执行 `make up_backend` 会输出一次 `GLIMMER_INITIAL_PASSWORD`。请立即保存，后续部署会保留服务端鉴权配置且不再显示明文口令。

当前两个端口使用 HTTP 公网访问，后端允许任意网页来源调用，但同步接口仍需要登录令牌。正式存放敏感内容前，应配置 HTTPS 域名，并通过 `API_BASE_URL` 切换地址。

## 注意

`IdeaSpaceCanvas` 已分别处理：

- 微信/小程序：Taro SelectorQuery 获取 `type="2d"` Canvas node。
- H5：直接获取浏览器 Canvas，并绑定 pointer 事件，方便桌面浏览器调试。

这不是把 HTML 塞进 web-view；页面结构本身已经全部改成 Taro React 组件。

更多结构说明见 `docs/ARCHITECTURE.md`。
