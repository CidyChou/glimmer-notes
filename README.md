# Idea Space — Taro 正式项目版

这是从之前单 HTML 原型重构出的正式代码结构。

技术栈：

- Taro 4.2.1
- React 18
- TypeScript
- Canvas 2D
- Taro Storage（Local First）
- 按自定义密钥隔离的云端同步（Node.js + 原子 JSON 存储）
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

在微信公众平台的开发设置中，将 `https://api.cidychou.com` 添加到 `request` 合法域名。执行 `make wechat` 会将小程序导出到 `dist-wechat/`，并用微信开发者工具打开该目录。执行 `make wechat WECHAT_DEVTOOLS_SYNC=0` 可以只导出。
首次导出时可以用 `WECHAT_APP_ID=你的AppID make wechat` 指定 AppID，后续导出会保留已配置的 AppID。

### H5

```bash
npm run dev:h5
```

### 抖音小程序

```bash
npm run dev:tt
```

## 云端同步

客户端始终先写入本地存储。用空间密钥连接云端后，新增、编辑、归类和删除会自动同步；断网期间仍可正常使用，恢复连接后按照每条 Idea 的更新时间合并。删除通过墓碑记录传播，避免离线设备恢复已删除内容。

不同的密钥对应独立空间。

本地开发后端：

```bash
node backend/scripts/init-auth.mjs .env.backend
set -a && source .env.backend && set +a
npm run test:backend
node backend/main.mjs
```

H5 的访问地址是 `https://notes.cidychou.com`。微信小程序和 H5 默认请求 `https://api.cidychou.com` 上的笔记接口。本地开发时可用 `TARO_APP_API_BASE_URL` 覆盖接口地址，通过 Makefile 打包时可用 `API_BASE_URL` 覆盖。

## SG 服务器

SSH 别名为 `sg`。Nginx 从 `/srv/glimmer-notes/client` 提供 H5，并将 API 域名上的 `/api/auth/login`、`/api/auth/session` 和 `/api/sync` 转发到本机的 `glimmer-notes.service`。后端代码在 `/srv/glimmer-notes/backend`，配置在 `/etc/glimmer-notes/backend.env`，数据在 `/var/lib/glimmer-notes`。

Makefile 中的 `up_client`、`up_backend` 和 `up_106` 是旧 106 部署入口。

## 注意

`IdeaSpaceCanvas` 已分别处理：

- 微信/小程序：Taro SelectorQuery 获取 `type="2d"` Canvas node。
- H5：直接获取浏览器 Canvas，并绑定 pointer 事件，方便桌面浏览器调试。

这不是把 HTML 塞进 web-view；页面结构本身已经全部改成 Taro React 组件。

更多结构说明见 `docs/ARCHITECTURE.md`。
