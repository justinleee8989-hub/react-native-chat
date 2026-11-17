# OpenIM 原版 React Native 组件离线演示

`openim-product-demo.html` 是现有 `example/app`、`example/features/im`、`example/components` 和聊天库编译后的 Expo Web，不是另画的 HTML 页面。179 个产品 TypeScript/TSX 文件与当前源文件逐字一致，完整路径与 SHA-256 见 `source-verification.json`。保留原登录、注册、找回密码、消息、通讯录、群组、我的、聊天和现有子页面；删除 Explore 路由和其 Stack 声明。

## 使用

打开 `openim-product-demo.html`。邮箱和密码填写任意非空演示值，例如 `demo@offline.local` / `demo123456`；无需真实账号，也不要输入真实凭据。身份、联系人、群和聊天记录均为虚构数据。通讯录可搜索 `offline-new` 或任意陌生 ID，系统生成虚构用户供发送申请；预置周宁的好友申请和产品讨论组入群申请，可在收到的申请中同意或拒绝。当前登录适配不验证真实密码，注册/验证码/密码修改仅模拟成功响应，不发送邮件、不修改真实账号。

单文件约 14.6 MB。52 个 JavaScript 分块、CSS、42 项字体/图片/声音资源均嵌入 HTML；分块通过本地 blob 执行。页面导航使用 `#`，刷新保留页面。CSP 禁止 HTTP/HTTPS/WebSocket 资源连接，仅放行内联代码和本地 data/blob 资源，SDK 已替换，不加载 WASM 或连接服务。

已在 Chrome 通过本地静态 HTTP 服务验证单 HTML 启动、原版登录、消息列表、聊天、消息发送和 hash 导航。浏览器自动化只支持 HTTP(S)，因此 **file:// 双击场景尚未经浏览器实测**；若浏览器限制本地文件存储或 blob，使用任意本地静态服务器托管此单文件即可，例如在本目录运行 `python3 -m http.server 36991`，打开 `http://127.0.0.1:36991/openim-product-demo.html`。静态服务器只负责交付 HTML，不提供后台 API。

## 离线范围

- 本机模拟：登录、联系人/群列表、资料和昵称、备注/黑名单、群成员管理、会话置顶/免打扰/归档、文本/引用/转发/名片/位置消息、历史搜索、编辑/表情回应、草稿。
- 图片、附件和头像只接受本机选择的 data/blob 文件。适配层转成 data URL 保存，演示附件限 3 MB。浏览器存储有配额，不适合长期大量媒体保存。
- 音视频通话明确提示“离线演示，不连接真实音视频服务”；录音/拍照等仍受浏览器权限和能力约束，不伪造真实接通或上传。注册验证码、密码服务是模拟。
- 未覆盖的 SDK 操作会显示“离线演示暂不支持此操作”，不会回退到真实后台。
- 存储隔离：会话 `offline-product:*`，数据 `openim-faithful-offline-v1`，草稿 `offline-product:im-composer:*`，附件 IndexedDB `offline-product-attachment-outbox-v1`。可在浏览器站点存储中清除本演示数据。

## 复现与原样证明

已有项目依赖可用时，在仓库执行：

```sh
python3 docs/offline/build.py
```

脚本在临时目录复制真实源码，链接现有依赖，不安装包；应用 `offline-patches.json` 中九个隔离改动文件后执行 Expo export，再由 `inline.py` 内联资产。不会改当前应用源码、后台、手机或提交 Git。

九处改动：Metro 固定 React 单例与依赖观察范围；Babel 使用 Web 普通 worklet 编译，避免写共享依赖；根 Stack 移除 Explore；SDK/HTTP 数据适配；离线头像 URI 校验/读取；会话、草稿和附件存储命名空间。所有 Screen/AuthForm/ProductTabs 页面组件保持原样。打包器只将编译代码的浏览器 location 读取映射到 hash 路由，不改变组件 DOM 或样式。

被拒绝的早期手写 HTML 已移至临时备份，不作为交付。
