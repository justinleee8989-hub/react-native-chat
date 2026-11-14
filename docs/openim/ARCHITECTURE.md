# OpenIM 二次开发结构与对接约定

产品已增加独立认证流程与四个主导航入口；官方聊天组件、原业务详情路由及本地数据保留。

## 目录职责

```text
src/                         官方可复用 RN 聊天组件，不包含 OpenIM 业务
example/app/                 Expo 路由，只负责装配页面
example/components/          原版 Explore 示例及共用视觉组件
example/features/im/
  navigation/                四个主入口、自适应导航、登录恢复守卫、我的功能入口
  auth/                      登录/注册/找回密码、共享认证表单、ChatServer HTTP 契约
  conversations/             真实会话列表、新建会话
  messages/                  真实聊天页面，使用官方 Chat 组件
  contacts/                  联系人和好友申请页面
  groups/                    群列表、建群、群详情和成员管理
  shared/                    RN 表单/确认组件、选择好友、异步操作和事件刷新钩子
  application/
    store.ts                 会话生命周期与 React 订阅，装配依赖
    runtime.ts               状态快照、通知订阅者、消息/会话合并
    messaging.ts             历史分页、聚焦、发送、上传及重试
    events.ts                SDK 连接/消息/进度事件与会话隔离
    directory.ts             联系人/群服务和事件的业务入口
  domain/                    业务数据类型、权限规则、消息显示映射
  infrastructure/
    openim/                  SDK 参数与响应适配、平台媒体处理
    storage/                 Web/原生会话存储适配
  config.ts                  平台 ID 和服务地址
```

业务仍使用现有 `example` 的 Expo 宿主和独立 Yarn 工程，避免在整理期间再复制一套构建系统。目录已隔离，未来可整体迁移为独立应用；这次没有宣称完成独立产品仓库拆分。

依赖方向：路由 → 功能页面 → application/domain → infrastructure。真实业务页面不能使用 demo 的 data/store；只有 infrastructure 能导入 OpenIM SDK。应用允许复用原版 theme、头像等视觉组件。`boundaries.test.mjs` 守护这些约束。页面内保留与表单紧密相关的局部状态，不把每个字段都做成全局状态。

## 对接边界

- 登录属于 ChatServer；`imToken` 仅交给 IM SDK，`chatToken` 单独保留用于后续 ChatServer 业务接口。密码按当前部署协议做 MD5 后提交；这不是替代 TLS 的加密方案。
- 业务只消费统一 `IMClient` 与目录服务。网页 SDK 返回 `{ data }`、RN SDK 返回原始数据的区别只存在于平台适配入口。
- 目录 SDK port 只包含实际使用字段，不把某一平台的枚举或所有 SDK 类型扩散到业务层。列表和建群响应在适配层检查基本结构。
- `groupType=2` 是建群类型；打开群会话使用 `sessionType=3`，不能混用。
- 上传由 SDK 创建和发送消息，Web 提供真实 File；界面显示进度、失败和按原消息 ID 重试。不能把 blob URL 当作永久服务端地址。
- SDK 事件负责刷新联系人和群缓存；操作响应不保证缓存已同步。保存资料先保留提交值，再接受事件更新。
- 群主/管理员按钮属于体验层限制，服务端仍是权限判断的最终依据。普通成员向需要审核的群邀请好友，接口成功只代表申请提交，不代表成员已经加入。
- SDK 版本的 invite/kick 返回 Promise<unknown>，部署服务端成功响应为空对象；不能虚构逐用户成功数组。当前只显示提交结果，并依赖成员事件刷新。

## 后端基线

具体镜像、对应源码提交和 SDK 版本见 `compatibility.json`。实际运行：Server v3.8.3-patch.18、ChatServer v1.8.4-patch.5，均已检查为 healthy。

本地 `open-im-server` 与 `chat` 当前开发分支 HEAD 和运行镜像所对应标签提交不同。这次按部署标签 `git show <tag>:<path>` 核对协议，没有重置开发分支，也没有将工作区源码误称为已部署版本。

以后修改 Go 服务前：从兼容清单对应的提交建立开发分支或隔离工作区；在原有 API/RPC/业务/存储分层里扩展；执行相关 Go 测试，再构建带提交号的镜像并更新清单。复用现有鉴权、错误码、事务及事件，不另造一套平行好友/群数据库，也不为前端样式修改消息核心服务。镜像标签用于当前本地基线，生产发布还应固定镜像摘要。

产品导航复用现有后端能力；服务端已有本地邮件、通话权限、消息增强与已读明细扩展。当前镜像以 local-deploy/compose.rtc-authority.yaml 为准，补丁可基于部署标签复现。

## 验证与限制

```sh
# 仓库根目录
node /tmp/im-tooling/yarn.cjs lint
node /tmp/im-tooling/yarn.cjs typecheck
node /tmp/im-tooling/yarn.cjs test --runInBand
node /tmp/im-tooling/yarn.cjs build
# example 内
node /tmp/im-tooling/yarn.cjs typecheck
node /tmp/im-tooling/yarn.cjs test:openim
node /tmp/im-tooling/yarn.cjs expo export --platform web
```

新增契约测试覆盖 email/platform/密码格式、双令牌、不完整登录响应、Web/RN 返回归一化、好友申请方向、分页、错误列表形状、登录迟到响应与退出竞态。保留离线消息、重复事件、重连加载、上传失败重试及权限测试。

尚未完成 iOS/Android 编译与真机验证；不能把 TypeScript 检查当作原生验收。当前 AsyncStorage 为原生本地开发存储，产品发布前应迁移为系统安全存储；Web 按标签页 sessionStorage 隔离。后续业务接口若遇到旧会话没有 chatToken，应要求重新登录，不能用 imToken 替代。消息系统通知、撤回、群审核等功能缺口不在本轮结构整理中补齐。

## 本轮实际验收

2026-11-14：449 项组件测试、27 项接入/结构测试通过，类型检查、lint、组件构建和 Web 导出通过。迁移后重新登录 Alice，检查好友与群成员、保存群资料，Alice/Bob 双向发送新消息，历史图片/文件仍显示、语音可播放。本轮没有重新录音或上传新文件；此前真实上传/录音已验证，这次保留其回归测试并检查历史媒体。

独立代码复查未发现本轮迁移引入的回归。原有恢复会话、异步存储与退出交错，以及迟到错误上报的边界仍需后续加固；本轮修复的是已经用失败测试复现的 HTTP 登录响应晚于退出的问题，不代表所有会话并发场景均已覆盖。


## 产品导航与网页部署（2026-11-15）

`app/auth` 为认证路由；`features/im/navigation` 负责会话恢复守卫、响应式主导航和我的功能入口。业务页面继续走原 application/domain/infrastructure，不在导航层直接调用 SDK。

网页使用 Expo `web.output=single`：浏览器恢复本地登录状态后决定登录或产品入口，不为私有聊天内容生成静态 HTML。部署静态产物时需将未知路径回退到 `index.html`，以支持刷新详情页。开发组件入口仍保留 `/explore`，不出现在主导航。


## 2026-11-15 v11：丰富消息与持久恢复

本节取代历史记录中“位置/名片未接入、只能文字引用、搜索与媒体仅本机历史、附件刷新后丢失”的说明。

- 位置与联系人名片调用 OpenIM 原生消息类型 109/108；位置使用手填 WGS84 坐标，名片查找真实用户。保留官方 Chat 组件，通过 RN 组件补充操作入口。
- 图片、文件、音视频、位置和名片可携带引用。附件保持真实原始消息类型，引用快照放在标准 `ex.imRichReplyV1` 字段；没有实现该扩展的其他客户端只显示原始内容。文字回复继续使用类型114。
- 搜索与图片/文件/链接汇总调用用户鉴权的 `/user/message/history`。服务端逐页验证会话所有权、当前群成员身份及用户可见序号，过滤已删除/撤回消息，并按编辑后的正文搜索。范围是服务端仍保留且当前用户有权访问的记录，不恢复已过期/删除内容。空匹配页也可继续。
- 搜索结果不混入聊天历史，点击定位时连续加载服务端历史至目标，离开页面终止后续请求。
- 附件任务：Web IndexedDB 保存实际 Blob，原生端保存应用目录文件。按账号及服务地址隔离，重新登录或刷新后只恢复待办，由用户手动继续。重试前查询服务端投递状态；已投递不再发，状态查询失败不发送。保存失败、容量不足均明确报错。此流程不是跨设备同步，也不承诺网络中断时分布式严格恰好一次投递。
- 草稿与提醒对象持久保存在本机，成功发送写入清空标记；账号/服务切换、并发保存及延迟清理受代次保护。旧的无服务器作用域提醒记录保留原样，不猜测迁移。

不包含真实外部邮件/短信和手机离线推送，实体多端验收及用户自测视频仍由约定排除。浏览器清除网站数据会移除本机草稿与附件待办。
